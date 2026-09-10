/**
 * 构建产物的 i18n 断言。手动工具，不是回归门禁：`pnpm test` 的 glob
 * （app/**、modules/**、i18n/**、shared/**）不含 scripts/**，且本脚本要读
 * `.output/public`，依赖一次完整的生产构建，不适合塞进那条自动跑的测试链路。
 *
 * 跑法：pnpm build && unrun scripts/verify-i18n.ts
 */
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative, resolve, sep } from 'node:path'
import { isTravelDraftSource } from '../app/travels/draft'
import blogConfig from '../blog.config'

const out = resolve('.output/public')
const at = (p: string) => resolve(out, p.replace(/^\//, ''))

// 中文 URL 逐字节不变
for (const p of ['/daily/anti-chronic-gastritis', '/travels/kansai-202504', '/archive', '/friends']) {
	assert.ok(existsSync(at(`${p}/index.html`)), `中文路径丢失：${p}`)
}

// 语言前缀页面存在（应用页，清单查不到时视为所有语言都有，i18n 为每个语言各生成一份）
for (const p of ['/en/archive', '/ja/archive', '/en/media', '/ja/media']) {
	assert.ok(existsSync(at(`${p}/index.html`)), `前缀路径缺失：${p}`)
}

// 三份订阅源
for (const p of ['/atom.xml', '/en/atom.xml', '/ja/atom.xml'])
	assert.ok(existsSync(at(p)), `订阅源缺失：${p}`)

// hreflang 只列真实存在的语言
const html = readFileSync(at('/daily/anti-chronic-gastritis/index.html'), 'utf8')
const tags = [...html.matchAll(/hreflang="([^"]+)"/g)].map(m => m[1]).sort()
const expectedLanguages = [
	'x-default',
	...blogConfig.locales
		.filter(l => existsSync(resolve('content', l.code, 'posts/daily/anti-chronic-gastritis.md')))
		.map(l => l.language),
].sort()
assert.deepEqual(tags, expectedLanguages, `hreflang 应与实际译文一致，实际：${tags.join(',')}`)

// 日文字体只在日语页
assert.ok(readFileSync(at('/ja/index.html'), 'utf8').includes('Noto+Serif+JP'))
assert.ok(!readFileSync(at('/index.html'), 'utf8').includes('Noto+Serif+JP'))

/**
 * /en、/ja 下的文章与游记产物必须恰好等于 content/{en,ja}、app/travels/{en,ja}
 * 里实际存在的内容推导出的集合 —— 而不是「某篇特定文章不应有 /en 产物」。
 *
 * 后者把「作者还没写这篇译文」编码成了永久规则：哪天他把译文写好，这条检查
 * 反而会因为「做对了事」而变红。这里改成两侧都在运行时从磁盘/产物现状推导，
 * 不给任何一侧硬编码固定值，新增或移除译文时无需手动调整期望集合。
 */

function walk(dir: string): string[] {
	let files: string[] = []
	let entries: string[]
	try {
		entries = readdirSync(dir)
	}
	catch {
		return files
	}
	for (const name of entries) {
		const full = join(dir, name)
		files = statSync(full).isDirectory() ? files.concat(walk(full)) : [...files, full]
	}
	return files
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/
const PERMALINK_LINE_RE = /^permalink:([^\r\n]*)\r?$/m

/** 与 modules/i18n-manifest/scan.ts 里的同名逻辑独立重写，避免验证脚本依赖被验证对象本身。 */
function extractPermalink(source: string): string | undefined {
	const frontmatter = source.match(FRONTMATTER_RE)?.[1]
	if (!frontmatter)
		return undefined
	const line = frontmatter.match(PERMALINK_LINE_RE)?.[1]
	if (line === undefined)
		return undefined
	const hashIndex = line.indexOf('#')
	const raw = hashIndex === -1 ? line : line.slice(0, hashIndex)
	const value = raw.trim().replace(/^['"]|['"]$/g, '')
	return value || undefined
}

const hidePostPrefix = blogConfig.article.hidePostPrefix
const categoryIds = Object.keys(blogConfig.article.categories)
// 分类文章落在 content/<locale>/posts/<category>/**，路由是否带 /posts 前缀取决于 hidePostPrefix
const categoryPrefixes = categoryIds.map(id => hidePostPrefix ? `/${id}` : `/posts/${id}`)

/** 从磁盘现状推导某语言「应当存在」的文章 / 游记路由集合（不带语言前缀）。 */
function expectedArticleRoutes(locale: string): string[] {
	const routes: string[] = []

	const contentRoot = resolve('content', locale)
	for (const file of walk(contentRoot)) {
		if (extname(file) !== '.md')
			continue
		const permalink = extractPermalink(readFileSync(file, 'utf8'))
		if (permalink) {
			routes.push(permalink.startsWith('/') ? permalink : `/${permalink}`)
			continue
		}
		const rel = relative(contentRoot, file).split(sep).join('/').replace(/\.md$/, '')
		const withSlash = `/${rel}`
		routes.push(hidePostPrefix && withSlash.startsWith('/posts/') ? withSlash.slice('/posts'.length) : withSlash)
	}

	const travelsRoot = resolve('app/travels', locale)
	for (const file of walk(travelsRoot)) {
		if (extname(file) !== '.yaml')
			continue
		if (isTravelDraftSource(readFileSync(file, 'utf8')))
			continue
		const slug = relative(travelsRoot, file).split(sep).join('/').replace(/\.yaml$/, '')
		routes.push(`/travels/${slug}`)
	}

	return routes.sort()
}

/**
 * 从构建产物推导某语言「实际存在」的文章 / 游记路由集合：只认落在文章分类前缀、
 * /travels/ 前缀，或磁盘推导出的自定义链接路径下的页面，避免把 /archive、/media
 * 这类语言无关的应用页也算进「文章」里。
 */
function actualArticleRoutes(locale: string, permalinks: readonly string[]): string[] {
	const localeRoot = at(`/${locale}`)
	const routes: string[] = []
	for (const file of walk(localeRoot)) {
		if (!/(?:^|[/\\])index\.html$/.test(file))
			continue
		const rel = relative(localeRoot, file).split(sep).join('/')
		const withoutIndex = rel.replace(/(^|\/)index\.html$/, '')
		const routePath = withoutIndex ? `/${withoutIndex}` : '/'

		const underCategory = categoryPrefixes.some(p => routePath === p || routePath.startsWith(`${p}/`))
		// /travels 本身是与语言无关的游记列表应用页（对齐 /archive），不是某篇游记，故要求至少一段 slug
		const underTravels = routePath.startsWith('/travels/')
		const isPermalink = permalinks.includes(routePath)
		if (underCategory || underTravels || isPermalink)
			routes.push(routePath)
	}
	return routes.sort()
}

for (const locale of ['en', 'ja']) {
	const expected = expectedArticleRoutes(locale)
	const permalinks = expected.filter(p =>
		!categoryPrefixes.some(c => p === c || p.startsWith(`${c}/`)) && p !== '/travels' && !p.startsWith('/travels/'),
	)
	const actual = actualArticleRoutes(locale, permalinks)
	assert.deepEqual(
		actual,
		expected,
		[
			`/${locale}/* 的文章/游记产物应恰好等于 content/${locale}、app/travels/${locale} 现有内容推导出的集合`,
			`期望：${JSON.stringify(expected)}`,
			`实际：${JSON.stringify(actual)}`,
		].join('\n'),
	)
}

console.info('✓ i18n 构建产物验证通过')
