import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Vitest is not a project dependency; use Node's built-in runner.
import test from 'node:test'

// 假 t()：把 key 和插值参数拼回可断言的字符串，不依赖真正的词条表
function fakeT(key: string, named?: Record<string, string | number>) {
	return named ? `${key}(${JSON.stringify(named)})` : key
}

test('resolveNavText returns the literal text untranslated when textKey is absent', async () => {
	const { resolveNavText } = await import('./nav.ts')
	assert.equal(resolveNavText({ icon: 'x', url: '/', text: 'GitHub: senshinya' }, fakeT), 'GitHub: senshinya')
})

test('resolveNavText calls t() with the key when textKey is present', async () => {
	const { resolveNavText } = await import('./nav.ts')
	assert.equal(resolveNavText({ icon: 'x', url: '/', textKey: 'footer.atom' }, fakeT), 'footer.atom')
})

test('resolveNavText forwards textParams as named interpolation values', async () => {
	const { resolveNavText } = await import('./nav.ts')
	const result = resolveNavText({ icon: 'x', url: '/', textKey: 'footer.theme', textParams: { name: 'Clarity', version: '3.7.2' } }, fakeT)
	assert.equal(result, 'footer.theme({"name":"Clarity","version":"3.7.2"})')
})

test('resolveNavTitle prefers titleKey over the literal title', async () => {
	const { resolveNavTitle } = await import('./nav.ts')
	assert.equal(resolveNavTitle({ titleKey: 'footer.explore' }, fakeT), 'footer.explore')
	assert.equal(resolveNavTitle({ title: '' }, fakeT), '')
})
