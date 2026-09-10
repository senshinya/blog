import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
// eslint-disable-next-line test/no-import-node-test -- Vitest is not a project dependency; use Node's built-in runner.
import test from 'node:test'

/**
 * 守住一条只在「生产构建 + 浏览器水合」这一格才会现形的规矩：
 * useAsyncData / useLazyAsyncData 的第一个参数（key）不能是就地写的函数。
 *
 * 本项目开了 experimental.extractAsyncDataHandlers。那个插件挑 handler 的办法是
 * `node.arguments.find(fn => 箭头函数或函数表达式)` —— 参数里第一个函数就算数。
 * key 写成 `() => 'posts:index:' + collection.value` 这种取值函数时，被挑中的是 key，
 * 它会被换成 `() => import('./async-data-chunk-N.js').then(...)`，
 * 于是 key 成了一个返回 Promise 的函数，useAsyncData 首行的
 * `typeof key.value !== 'string'` 当场抛 NUXT_E3008，页面主体在水合时被卸载。
 * 写成 ref（computed）就没这问题：ref 不是函数，find() 会正确地挑到 handler。
 *
 * 为什么非得用一条「读源码」的测试来守：
 * 该插件只在 `!nuxt.options.dev` 时注册，且 `addBuildPlugin(..., { server: false })`
 * 只作用于客户端 bundle。dev 正常，预渲染出来的 HTML 正常，`nuxt build` 也不报错 ——
 * 只有真浏览器跑那一遍 JS 才炸。任何读静态产物的检查都看不见它。
 */

const ROOT = join(import.meta.dirname, '..', '..')
const SKIP_DIRS = new Set(['node_modules', '.git', '.nuxt', '.output', '.data', 'dist', 'output', 'public', 'content', 'patches', 'docs'])
const SOURCE_EXT = /\.(?:vue|m?ts|m?js)$/
const CALL_RE = /\b(useAsyncData|useLazyAsyncData)\s*\(/g
const SCRIPT_RE = /<script\b[^>]*>([\s\S]*?)<\/script>/g
/** `function () {}` / `async function () {}` / `() => x` / `async (a) => x` / `x => x` */
const INLINE_FN_RE = /^(?:async\s+function\b|function\b|(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*=>)/

type FrameKind = 'code' | 'line' | 'block' | 'single' | 'double' | 'template'

interface Frame {
	kind: FrameKind
	/** 仅 code 帧使用：花括号深度，用来认出模板字面量插值 `${...}` 的收尾 */
	depth: number
}

interface ScanResult {
	/** 该字符是否是「真代码」：注释、字符串与模板字面量的内容都不算，插值里的表达式算 */
	isCode: Uint8Array
	/** 把注释抹成空格、其余原样保留的副本，长度与原文一致 */
	bare: string
}

function scanSource(src: string): ScanResult {
	const isCode = new Uint8Array(src.length)
	// 按 UTF-16 码元切，下标才与 src 对齐（[...src] 会把星平面字符并成一格）
	const bare = src.split('')
	const stack: Frame[] = [{ kind: 'code', depth: 0 }]
	let i = 0

	while (i < src.length) {
		const top = stack.at(-1)!
		const c = src[i]!
		const c2 = src[i + 1]

		if (top.kind === 'line') {
			if (c === '\n') {
				stack.pop()
			}
			else {
				bare[i] = ' '
			}
			i++
			continue
		}

		if (top.kind === 'block') {
			if (c === '*' && c2 === '/') {
				bare[i] = ' '
				bare[i + 1] = ' '
				stack.pop()
				i += 2
				continue
			}
			if (c !== '\n') {
				bare[i] = ' '
			}
			i++
			continue
		}

		if (top.kind === 'single' || top.kind === 'double') {
			if (c === '\\') {
				i += 2
				continue
			}
			if (c === (top.kind === 'single' ? '\'' : '"')) {
				stack.pop()
			}
			i++
			continue
		}

		if (top.kind === 'template') {
			if (c === '\\') {
				i += 2
				continue
			}
			if (c === '`') {
				stack.pop()
				i++
				continue
			}
			if (c === '$' && c2 === '{') {
				stack.push({ kind: 'code', depth: 0 })
				i += 2
				continue
			}
			i++
			continue
		}

		// 到这里 top.kind === 'code'
		if (c === '/' && (c2 === '/' || c2 === '*')) {
			stack.push({ kind: c2 === '/' ? 'line' : 'block', depth: 0 })
			bare[i] = ' '
			bare[i + 1] = ' '
			i += 2
			continue
		}
		if (c === '\'' || c === '"' || c === '`') {
			stack.push({ kind: c === '\'' ? 'single' : c === '"' ? 'double' : 'template', depth: 0 })
			i++
			continue
		}
		if (c === '{') {
			top.depth++
		}
		if (c === '}') {
			// depth 已经归零还遇到 }，说明这是模板字面量插值的收尾，回到 template 帧
			if (top.depth === 0 && stack.length > 1) {
				stack.pop()
				i++
				continue
			}
			top.depth--
		}
		isCode[i] = 1
		i++
	}

	return { isCode, bare: bare.join('') }
}

/** .vue 只扫 <script>：`<template>` 里的引号撇号不是 JS，混进来会把扫描器带偏 */
function scriptChunks(source: string, isVue: boolean) {
	if (!isVue) {
		return [{ text: source, offset: 0 }]
	}
	return [...source.matchAll(SCRIPT_RE)].map(m => ({
		text: m[1]!,
		offset: m.index + m[0].indexOf(m[1]!),
	}))
}

/** 从调用的左括号往后找第一个参数的结尾：顶层的逗号，或者配对的右括号 */
function firstArgumentEnd(text: string, isCode: Uint8Array, start: number) {
	let depth = 0
	let i = start

	while (i < text.length) {
		if (isCode[i]) {
			const c = text[i]
			if (c === '(' || c === '[' || c === '{') {
				depth++
			}
			else if (c === ']' || c === '}') {
				depth--
			}
			else if (c === ')') {
				if (depth === 0) {
					return i
				}
				depth--
			}
			else if (c === ',' && depth === 0) {
				return i
			}
		}
		i++
	}

	return i
}

export interface AsyncDataCall {
	fn: string
	/** 第一个参数的原文（注释已剔除） */
	key: string
	line: number
}

/** 找出源码里所有 useAsyncData / useLazyAsyncData 调用，连同它们第一个参数的原文 */
export function findAsyncDataCalls(source: string, isVue = false): AsyncDataCall[] {
	const calls: AsyncDataCall[] = []

	for (const { text, offset } of scriptChunks(source, isVue)) {
		const { isCode, bare } = scanSource(text)

		for (const match of text.matchAll(CALL_RE)) {
			// 注释或字符串里提到的 useAsyncData 不算调用
			if (!isCode[match.index]) {
				continue
			}
			const start = match.index + match[0].length
			calls.push({
				fn: match[1]!,
				key: bare.slice(start, firstArgumentEnd(text, isCode, start)).trim(),
				line: source.slice(0, offset + match.index).split('\n').length,
			})
		}
	}

	return calls
}

export function isInlineFunction(argument: string) {
	return INLINE_FN_RE.test(argument)
}

function* walkSources(dir: string): Generator<string> {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name.startsWith('.')) {
			continue
		}
		if (entry.isDirectory()) {
			if (!SKIP_DIRS.has(entry.name)) {
				yield* walkSources(join(dir, entry.name))
			}
		}
		else if (SOURCE_EXT.test(entry.name) && !entry.name.endsWith('.test.ts')) {
			yield join(dir, entry.name)
		}
	}
}

test('the scanner tells a getter key apart from a ref key', () => {
	// eslint-disable-next-line no-template-curly-in-string -- 这些是被扫描的源码原文，不是漏写的模板字符串
	const getterSource = 'const { data } = await useAsyncData(\n\t() => `posts:index:${collection.value}`,\n\t() => query(collection.value),\n\t{ default: () => [] },\n)\n'
	const getter = findAsyncDataCalls(getterSource)
	assert.equal(getter.length, 1)
	// eslint-disable-next-line no-template-curly-in-string -- 同上
	assert.equal(getter[0]!.key, '() => `posts:index:${collection.value}`')
	assert.equal(isInlineFunction(getter[0]!.key), true)

	const refSource = 'const { data } = await useAsyncData(\n\tlistKey,\n\t() => query(collection.value),\n\t{ default: () => [] },\n)\n'
	const ref = findAsyncDataCalls(refSource)
	assert.equal(ref.length, 1)
	assert.equal(ref[0]!.key, 'listKey')
	assert.equal(isInlineFunction(ref[0]!.key), false)

	// 合法写法：定值、模板字面量、变量名
	// eslint-disable-next-line no-template-curly-in-string -- 同上
	for (const key of ['\'memo-detail\'', '`github:${props.repo}`', 'dataKey']) {
		assert.equal(isInlineFunction(key), false, `${key} 不是就地函数`)
	}

	// 各种就地函数写法都要认出来
	for (const key of ['() => `a`', 'async () => `a`', '(a) => a', 'x => x', 'function () { return 1 }', 'async function () { return 1 }']) {
		assert.equal(isInlineFunction(key), true, `${key} 是就地函数`)
	}

	// 注释与字符串里的 useAsyncData( 不算调用
	assert.deepEqual(findAsyncDataCalls('// await useAsyncData() 会阻塞渲染\nconst s = \'useAsyncData(\'\n/* useAsyncData( */\n'), [])

	// .vue 只看 <script>，<template> 里的撇号不该把扫描器带偏
	const vueSource = '<script setup lang="ts">\nconst { data } = await useAsyncData(dataKey, () => q())\n</script>\n\n<template>\n<p>别在意这里的 \' 撇号</p>\n</template>\n'
	const vue = findAsyncDataCalls(vueSource, true)
	assert.equal(vue.length, 1)
	assert.equal(vue[0]!.key, 'dataKey')
})

test('no useAsyncData key is an inline function', () => {
	const offenders: string[] = []
	let total = 0

	for (const file of walkSources(ROOT)) {
		const source = readFileSync(file, 'utf8')
		if (!source.includes('useAsyncData') && !source.includes('useLazyAsyncData')) {
			continue
		}
		for (const call of findAsyncDataCalls(source, file.endsWith('.vue'))) {
			total++
			if (isInlineFunction(call.key)) {
				offenders.push(`${relative(ROOT, file)}:${call.line} ${call.fn}(${call.key.split('\n')[0]}…)`)
			}
		}
	}

	// 扫描器要是哪天失灵、一个调用都找不到，这条测试会变成永远通过的摆设
	assert.ok(total >= 9, `只找到 ${total} 处 useAsyncData 调用，扫描器可能失灵了`)
	assert.deepEqual(
		offenders,
		[],
		'key 不能写成就地函数，会被 extractAsyncDataHandlers 当作 handler 抽走，'
		+ '水合时抛 NUXT_E3008 清空正文。改成 computed 再传进去，'
		+ '缘由见 app/composables/useArticle.ts 的 useContentCollection',
	)
})
