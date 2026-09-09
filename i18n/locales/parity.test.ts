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
		const walk = (obj: Record<string, unknown>, prefix = ''): void => {
			for (const [k, v] of Object.entries(obj)) {
				const key = prefix ? `${prefix}.${k}` : k
				if (v && typeof v === 'object')
					walk(v as Record<string, unknown>, key)
				else
					assert.ok(typeof v === 'string' && v.length > 0, `${locale}.${key} 是空词条`)
			}
		}
		walk(messages)
	}
})
