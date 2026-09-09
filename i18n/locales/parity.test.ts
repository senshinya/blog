import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Vitest is not a project dependency; use Node's built-in runner.
import test from 'node:test'

function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
	return Object.entries(obj).flatMap(([k, v]) => {
		const key = prefix ? `${prefix}.${k}` : k
		return v && typeof v === 'object' && !Array.isArray(v)
			? flatten(v as Record<string, unknown>, key)
			: [key]
	})
}

// 递归遍历词条树，对每个叶子节点调用 visit —— 供下面两个测试共用，避免重复的遍历逻辑
function walkMessages(obj: Record<string, unknown>, visit: (key: string, value: unknown) => void, prefix = ''): void {
	for (const [k, v] of Object.entries(obj)) {
		const key = prefix ? `${prefix}.${k}` : k
		if (v && typeof v === 'object')
			walkMessages(v as Record<string, unknown>, visit, key)
		else
			visit(key, v)
	}
}

test('en and ja carry exactly the keys zh defines', async () => {
	const zh = (await import('./zh.ts')).default
	const en = (await import('./en.ts')).default
	const ja = (await import('./ja.ts')).default

	const expected = flatten(zh).sort()
	assert.deepEqual(flatten(en).sort(), expected, 'en 与 zh 的键不一致')
	assert.deepEqual(flatten(ja).sort(), expected, 'ja 与 zh 的键不一致')
})

test('no message is left empty', async () => {
	for (const locale of ['zh', 'en', 'ja']) {
		const messages = (await import(`./${locale}.ts`)).default
		walkMessages(messages, (key, v) => {
			assert.ok(typeof v === 'string' && v.length > 0, `${locale}.${key} 是空词条`)
		})
	}
})

test('en carries no untranslated Chinese', async () => {
	const en = (await import('./en.ts')).default
	// 汉字、假名、中日标点与全角符号 —— 英文界面文案不该出现任何一类
	// 用 \u 转义而非原始字符写区间，规避 regexp/no-obscure-range 与不可见空白告警
	const cjk = /[\u3000-\u303F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uFF00-\uFFEF]/
	walkMessages(en, (key, v) => {
		assert.ok(!cjk.test(String(v)), `en.${key} 疑似漏翻：${String(v)}`)
	})
})
