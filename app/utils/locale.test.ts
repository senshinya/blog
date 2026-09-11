import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Vitest is not a project dependency; use Node's built-in runner.
import test from 'node:test'

const LOCALES = ['zh', 'en', 'ja'] as const

test('memo language routes retain page identity without merging different memos or article locales', async () => {
	const { localePageKey } = await import('./locale.ts')
	assert.equal(localePageKey('/en/memos', LOCALES, 'zh'), '/memos')
	assert.equal(localePageKey('/ja/memos/', LOCALES, 'zh'), '/memos')
	assert.equal(localePageKey('/en/memos/AbC', LOCALES, 'zh'), '/memos/AbC')
	assert.notEqual(localePageKey('/memos/AbC', LOCALES, 'zh'), localePageKey('/memos/abc', LOCALES, 'zh'))
	assert.equal(localePageKey('/en/daily/post/', LOCALES, 'zh'), '/en/daily/post')
	assert.equal(localePageKey('/en/memos-example', LOCALES, 'zh'), '/en/memos-example')
})
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
	const { suggestLocale } = await import('./locale.ts')
	assert.equal(suggestLocale(input({ stored: 'en', browser: ['ja'] })), '/en/daily/gastritis')
})

test('falls back to browser languages when nothing is stored', async () => {
	const { suggestLocale } = await import('./locale.ts')
	assert.equal(suggestLocale(input({ browser: ['en-US', 'en'] })), '/en/daily/gastritis')
})

test('stays put when the preferred locale already matches', async () => {
	const { suggestLocale } = await import('./locale.ts')
	assert.equal(suggestLocale(input({ path: '/en/daily/gastritis', stored: 'en' })), undefined)
	assert.equal(suggestLocale(input({ stored: 'zh' })), undefined)
})

test('stays put when the page has no translation in the preferred locale', async () => {
	const { suggestLocale } = await import('./locale.ts')
	assert.equal(suggestLocale(input({ stored: 'ja' })), undefined)
	assert.equal(suggestLocale(input({ path: '/friends', stored: 'en' })), undefined)
})

test('treats paths outside the manifest as available in every locale', async () => {
	const { suggestLocale } = await import('./locale.ts')
	assert.equal(suggestLocale(input({ path: '/archive', stored: 'ja' })), '/ja/archive')
})

test('ignores browser languages the site does not support', async () => {
	const { suggestLocale } = await import('./locale.ts')
	assert.equal(suggestLocale(input({ browser: ['de-DE', 'fr'] })), undefined)
})

test('maps regional browser tags onto the base locale', async () => {
	const { suggestLocale } = await import('./locale.ts')
	assert.equal(suggestLocale(input({ path: '/archive', browser: ['ja-JP'] })), '/ja/archive')
})

test('builds default-locale targets without a prefix', async () => {
	const { suggestLocale } = await import('./locale.ts')
	assert.equal(suggestLocale(input({ path: '/en/daily/gastritis', stored: 'zh' })), '/daily/gastritis')
})

test('does not redirect to protocol-relative or backslash paths after stripping the locale', async () => {
	const { suggestLocale } = await import('./locale.ts')
	for (const path of ['/en//example.org', '/en/\\example.org', '/en///example.org'])
		assert.equal(suggestLocale(input({ path, stored: 'zh' })), undefined)
})

test('locale redirects preserve query values and comment anchors for full-page and SPA navigation', async () => {
	const { localeRedirectPath } = await import('./locale.ts')
	const origin = 'https://blog.example.org'
	assert.equal(
		localeRedirectPath('/en/media', '/media?category=game&status=done&tag=a&tag=b&empty=#comment-43', origin),
		'/en/media?category=game&status=done&tag=a&tag=b&empty=#comment-43',
	)
	assert.equal(localeRedirectPath('/daily/foo', '/ja/daily/foo?q=%E6%97%A5%E6%9C%AC#%E6%A0%87%E9%A2%98', origin), '/daily/foo?q=%E6%97%A5%E6%9C%AC#%E6%A0%87%E9%A2%98')
	assert.equal(localeRedirectPath('/en', '/', origin), '/en')
})

test('locale redirect paths cannot resolve outside the current origin', async () => {
	const { localeRedirectPath } = await import('./locale.ts')
	for (const target of ['//example.org', '/\\example.org', 'https://example.org', '/\n/example.org', '/safe/..//example.org'])
		assert.equal(localeRedirectPath(target, '/en/media?category=game#comment-43', 'https://blog.example.org'), undefined)
	assert.equal(localeRedirectPath('/%2Fexample.org', '/', 'https://blog.example.org'), '/%2Fexample.org')
})

test('buildPath prefixes the root path without a trailing slash', async () => {
	const { buildPath } = await import('./locale.ts')
	// trailingSlash: false —— 非默认语言的首页是 /en，不是 /en/
	assert.equal(buildPath('/', 'en', 'zh'), '/en')
	assert.equal(buildPath('/', 'ja', 'zh'), '/ja')
})

test('buildPath prefixes a non-root path', async () => {
	const { buildPath } = await import('./locale.ts')
	assert.equal(buildPath('/daily/gastritis', 'en', 'zh'), '/en/daily/gastritis')
})

test('buildPath leaves the default locale unprefixed, root path included', async () => {
	const { buildPath } = await import('./locale.ts')
	assert.equal(buildPath('/daily/gastritis', 'zh', 'zh'), '/daily/gastritis')
	assert.equal(buildPath('/', 'zh', 'zh'), '/')
})

test('resolveContentPath leaves the default locale (zh) unprefixed', async () => {
	const { resolveContentPath } = await import('./locale.ts')
	assert.equal(resolveContentPath('/daily/gastritis', 'zh'), '/daily/gastritis')
})

test('resolveContentPath prefixes a non-default locale', async () => {
	const { resolveContentPath } = await import('./locale.ts')
	assert.equal(resolveContentPath('/daily/gastritis', 'en'), '/en/daily/gastritis')
	assert.equal(resolveContentPath('/daily/gastritis', 'ja'), '/ja/daily/gastritis')
})

test('resolveContentPath passes undefined through untouched', async () => {
	// PostSurround 的上一篇/下一篇在文章边界处为空，SearchItem 的 props 是 Partial<>
	const { resolveContentPath } = await import('./locale.ts')
	assert.equal(resolveContentPath(undefined, 'en'), undefined)
})

test('resolveContentPath does not guard against a path that already carries a prefix', async () => {
	// 同 buildPath 的既有约定：basePath 必须是不带语言前缀的，调用方（content collection
	// 查询结果、stem 拼接）保证这一点，这里不做二次纠正——传入已带前缀的路径会照样
	// 再拼一层前缀，产生错误但可预期的结果，而不是静默地“看起来对”
	const { resolveContentPath } = await import('./locale.ts')
	assert.equal(resolveContentPath('/en/daily/gastritis', 'en'), '/en/en/daily/gastritis')
})

test('isLocaleSwitch: same page, different language', async () => {
	const { isLocaleSwitch } = await import('./locale.ts')
	assert.equal(isLocaleSwitch('/', '/en', LOCALES, 'zh'), true)
	assert.equal(isLocaleSwitch('/en', '/', LOCALES, 'zh'), true)
	assert.equal(isLocaleSwitch('/en/archive', '/ja/archive', LOCALES, 'zh'), true)
	// 尾斜杠归一化后仍是同一页
	assert.equal(isLocaleSwitch('/daily/foo/', '/en/daily/foo', LOCALES, 'zh'), true)
})

test('isLocaleSwitch: a different page is not a language switch', async () => {
	const { isLocaleSwitch } = await import('./locale.ts')
	assert.equal(isLocaleSwitch('/', '/en/archive', LOCALES, 'zh'), false)
	assert.equal(isLocaleSwitch('/archive', '/friends', LOCALES, 'zh'), false)
	// 语言没变就不是切换语言，哪怕路径一样
	assert.equal(isLocaleSwitch('/archive', '/archive', LOCALES, 'zh'), false)
})

test('isLocaleSwitch: 没有来路时为 false', async () => {
	const { isLocaleSwitch } = await import('./locale.ts')
	// 首次进站（START_LOCATION）没有上一个路由，此时是「到达」，入场动画应当照常播
	assert.equal(isLocaleSwitch(undefined, '/en', LOCALES, 'zh'), false)
})
