import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Vitest is not a project dependency; use Node's built-in runner.
import test from 'node:test'

// 用 node:test 内置的 mock，而不是一个纯拼接字符串的假 t()：
// 后者会让 "调用了 t() 返回 key 本身" 和 "根本没调 t()、直接透传 key 当 text"
// 产生完全相同的输出，测不出这个抽象真正要守住的东西——text 分支绝不能碰 t()，
// 否则字面量（GitHub 账号、邮箱等专有名词）会被当成词条 key 传给 $t()，
// 在开发环境下触发会抛错的漏键 handler。

test('resolveNavText returns the literal text and never calls t() when textKey is absent', async (t) => {
	const { resolveNavText } = await import('./nav.ts')
	const mockT = t.mock.fn(() => 'SHOULD NOT BE USED')

	const result = resolveNavText({ icon: 'x', url: '/', text: 'GitHub: senshinya' }, mockT)

	assert.equal(result, 'GitHub: senshinya')
	assert.equal(mockT.mock.calls.length, 0, 'text 分支不能调用 t()，否则字面量会被当成词条 key')
})

test('resolveNavText calls t() exactly once with the key when textKey is present', async (t) => {
	const { resolveNavText } = await import('./nav.ts')
	const mockT = t.mock.fn(() => 'Atom feed')

	const result = resolveNavText({ icon: 'x', url: '/', textKey: 'footer.atom' }, mockT)

	assert.equal(result, 'Atom feed')
	assert.equal(mockT.mock.calls.length, 1)
	assert.deepEqual(mockT.mock.calls[0].arguments, ['footer.atom', undefined])
})

test('resolveNavText forwards textParams as the second argument to t()', async (t) => {
	const { resolveNavText } = await import('./nav.ts')
	const mockT = t.mock.fn(() => 'Theme: Clarity 3.7.2')
	const params = { name: 'Clarity', version: '3.7.2' }

	const result = resolveNavText({ icon: 'x', url: '/', textKey: 'footer.theme', textParams: params }, mockT)

	assert.equal(result, 'Theme: Clarity 3.7.2')
	assert.equal(mockT.mock.calls.length, 1)
	assert.deepEqual(mockT.mock.calls[0].arguments, ['footer.theme', params])
})

test('resolveNavUrl prefixes a localized url with the current non-default locale', async () => {
	const { resolveNavUrl } = await import('./nav.ts')

	const result = resolveNavUrl({ icon: 'x', url: '/atom.xml', textKey: 'footer.atom', localized: true }, 'en')

	assert.equal(result, '/en/atom.xml')
})

test('resolveNavUrl returns the bare url when the locale is the default locale', async () => {
	const { resolveNavUrl } = await import('./nav.ts')

	const result = resolveNavUrl({ icon: 'x', url: '/atom.xml', textKey: 'footer.atom', localized: true }, 'zh')

	assert.equal(result, '/atom.xml')
})

test('resolveNavUrl leaves an unmarked url unchanged even off the default locale', async () => {
	const { resolveNavUrl } = await import('./nav.ts')

	const result = resolveNavUrl({ icon: 'x', url: '/archive', textKey: 'nav.archive' }, 'en')

	assert.equal(result, '/archive')
})

// localized 是个不受类型约束的可选字段：配置里手滑把它标到一条外部链接上，
// tsc 也不会拦——而这个仓库的任何验证命令都不跑 tsc，类型层面的正确性
// 形同虚设。下面三个用例锁住运行时兜底：无论 localized 标没标，只要 url
// 本身不是站内路径，就必须原样返回，绝不能拼出 /en/https://... 这种坏链接。
test('resolveNavUrl never prefixes an absolute https url, even if marked localized', async () => {
	const { resolveNavUrl } = await import('./nav.ts')

	const result = resolveNavUrl({ icon: 'x', url: 'https://github.com/senshinya', text: 'GitHub: senshinya', localized: true }, 'en')

	assert.equal(result, 'https://github.com/senshinya')
})

test('resolveNavUrl never prefixes a mailto url, even if marked localized', async () => {
	const { resolveNavUrl } = await import('./nav.ts')

	const result = resolveNavUrl({ icon: 'x', url: 'mailto:shinya@example.com', text: 'shinya@example.com', localized: true }, 'en')

	assert.equal(result, 'mailto:shinya@example.com')
})

test('resolveNavUrl never prefixes a protocol-relative url, even if marked localized', async () => {
	const { resolveNavUrl } = await import('./nav.ts')

	const result = resolveNavUrl({ icon: 'x', url: '//cdn.example.com/x', text: 'cdn', localized: true }, 'en')

	assert.equal(result, '//cdn.example.com/x')
})

test('resolveNavUrl honours an explicitly passed defaultLocale', async () => {
	const { resolveNavUrl } = await import('./nav.ts')

	const result = resolveNavUrl({ icon: 'x', url: '/atom.xml', textKey: 'footer.atom', localized: true }, 'zh', 'en')

	assert.equal(result, '/zh/atom.xml')
})

// 根路径的导航项（如 nav.articles，url 为 '/'）标了 localized 时，绝不能拼出
// 带尾斜杠的 /en/ —— 本站 trailingSlash: false，那是个不存在的 URL。
// resolveNavUrl 委托给 buildPath 做拼接，这里锁住这个根路径特判确实生效。
test('resolveNavUrl prefixes the root path without a trailing slash', async () => {
	const { resolveNavUrl } = await import('./nav.ts')

	assert.equal(resolveNavUrl({ icon: 'x', url: '/', textKey: 'nav.articles', localized: true }, 'en'), '/en')
	assert.equal(resolveNavUrl({ icon: 'x', url: '/', textKey: 'nav.articles', localized: true }, 'ja'), '/ja')
})

test('resolveNavTitle returns the literal title and never calls t() when titleKey is absent', async (t) => {
	const { resolveNavTitle } = await import('./nav.ts')
	const mockT = t.mock.fn(() => 'SHOULD NOT BE USED')

	const result = resolveNavTitle({ title: '' }, mockT)

	assert.equal(result, '')
	assert.equal(mockT.mock.calls.length, 0, 'title 分支不能调用 t()，否则字面量会被当成词条 key')
})

test('resolveNavTitle calls t() exactly once with the key when titleKey is present', async (t) => {
	const { resolveNavTitle } = await import('./nav.ts')
	const mockT = t.mock.fn(() => 'Explore')

	const result = resolveNavTitle({ titleKey: 'footer.explore' }, mockT)

	assert.equal(result, 'Explore')
	assert.equal(mockT.mock.calls.length, 1)
	assert.deepEqual(mockT.mock.calls[0].arguments, ['footer.explore'])
})
