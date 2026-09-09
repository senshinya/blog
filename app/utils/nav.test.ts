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
