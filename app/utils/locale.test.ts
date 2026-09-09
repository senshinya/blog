import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Vitest is not a project dependency; use Node's built-in runner.
import test from 'node:test'

const LOCALES = ['zh', 'en', 'ja'] as const
const MANIFEST = {
	'/daily/gastritis': ['en', 'zh'],
	'/friends': ['zh'],
}

function input(over: Record<string, unknown> = {}) {
	return {
		path: '/daily/gastritis',
		stored: undefined,
		browser: [] as readonly string[],
		manifest: MANIFEST,
		locales: LOCALES,
		defaultLocale: 'zh',
		...over,
	} as never
}

test('splits the locale prefix off a path', async () => {
	const { stripLocale } = await import('./locale.ts')
	assert.deepEqual(stripLocale('/en/daily/gastritis', LOCALES, 'zh'), { locale: 'en', basePath: '/daily/gastritis' })
	assert.deepEqual(stripLocale('/daily/gastritis', LOCALES, 'zh'), { locale: 'zh', basePath: '/daily/gastritis' })
	assert.deepEqual(stripLocale('/ja', LOCALES, 'zh'), { locale: 'ja', basePath: '/' })
	assert.deepEqual(stripLocale('/', LOCALES, 'zh'), { locale: 'zh', basePath: '/' })
})

test('normalizes a trailing slash on basePath, but keeps the root path as /', async () => {
	const { stripLocale } = await import('./locale.ts')
	// 外部进站的旧链接、搜索引擎结果或手输 URL 可能带尾斜杠
	assert.deepEqual(stripLocale('/daily/foo/', LOCALES, 'zh'), { locale: 'zh', basePath: '/daily/foo' })
	assert.deepEqual(stripLocale('/ja/', LOCALES, 'zh'), { locale: 'ja', basePath: '/' })
})

test('takes the default locale from the argument, not from the array order', async () => {
	const { stripLocale } = await import('./locale.ts')
	// locales 数组的顺序是切换器按钮顺序，不能用来推默认语言
	assert.equal(stripLocale('/daily/gastritis', ['ja', 'en', 'zh'], 'zh').locale, 'zh')
})

test('resolvePreferred prefers the stored value, then the browser list', async () => {
	const { resolvePreferred } = await import('./locale.ts')
	assert.equal(resolvePreferred('en', ['ja'], LOCALES), 'en')
	assert.equal(resolvePreferred(undefined, ['ja-JP', 'en'], LOCALES), 'ja')
	assert.equal(resolvePreferred(undefined, ['de-DE'], LOCALES), undefined)
	// 存了一个本站不支持的值，应当忽略它并回退到浏览器语言
	assert.equal(resolvePreferred('de', ['en-US'], LOCALES), 'en')
})

test('stored preference wins over the browser languages', async () => {
	const { decideLocale } = await import('./locale.ts')
	assert.equal(decideLocale(input({ stored: 'en', browser: ['ja'] })), '/en/daily/gastritis')
})

test('falls back to browser languages when nothing is stored', async () => {
	const { decideLocale } = await import('./locale.ts')
	assert.equal(decideLocale(input({ browser: ['en-US', 'en'] })), '/en/daily/gastritis')
})

test('stays put when the preferred locale already matches', async () => {
	const { decideLocale } = await import('./locale.ts')
	assert.equal(decideLocale(input({ path: '/en/daily/gastritis', stored: 'en' })), undefined)
	assert.equal(decideLocale(input({ stored: 'zh' })), undefined)
})

test('stays put when the page has no translation in the preferred locale', async () => {
	const { decideLocale } = await import('./locale.ts')
	assert.equal(decideLocale(input({ stored: 'ja' })), undefined)
	assert.equal(decideLocale(input({ path: '/friends', stored: 'en' })), undefined)
})

test('treats paths outside the manifest as available in every locale', async () => {
	const { decideLocale } = await import('./locale.ts')
	assert.equal(decideLocale(input({ path: '/archive', stored: 'ja' })), '/ja/archive')
})

test('ignores browser languages the site does not support', async () => {
	const { decideLocale } = await import('./locale.ts')
	assert.equal(decideLocale(input({ browser: ['de-DE', 'fr'] })), undefined)
})

test('maps regional browser tags onto the base locale', async () => {
	const { decideLocale } = await import('./locale.ts')
	assert.equal(decideLocale(input({ path: '/archive', browser: ['ja-JP'] })), '/ja/archive')
})

test('builds default-locale targets without a prefix', async () => {
	const { decideLocale } = await import('./locale.ts')
	assert.equal(decideLocale(input({ path: '/en/daily/gastritis', stored: 'zh' })), '/daily/gastritis')
})
