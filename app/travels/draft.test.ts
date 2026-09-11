import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Vitest is not a project dependency; use Node's built-in runner.
import test from 'node:test'

test('recognizes a top-level YAML draft flag', async () => {
	const { isTravelDraftSource } = await import('../../modules/publication/sources.ts')

	assert.equal(isTravelDraftSource('slug: korea-202510\ndraft: true\ntitle: 南韩\n'), true)
})

test('ignores values that are not a top-level boolean draft flag', async () => {
	const { isTravelDraftSource } = await import('../../modules/publication/sources.ts')

	assert.equal(isTravelDraftSource('draft: false\n'), false)
	assert.equal(isTravelDraftSource('draft: "true"\n'), false)
	assert.equal(isTravelDraftSource('metadata:\n  draft: true\n'), false)
})

test('removes draft travels outside development', async () => {
	const { getVisibleTravels } = await import('./draft.ts')
	const travels = [
		{ slug: 'korea-202510', draft: true },
		{ slug: 'kansai-202504' },
	]

	assert.deepEqual(getVisibleTravels(travels, false), [travels[1]])
})

test('keeps draft travels in development', async () => {
	const { getVisibleTravels } = await import('./draft.ts')
	const travels = [
		{ slug: 'korea-202510', draft: true },
		{ slug: 'kansai-202504' },
	]

	assert.deepEqual(getVisibleTravels(travels, true), travels)
})

/** Build-time YAML classification and runtime filtering must agree. */
test('both draft checks classify every YAML spelling the same way', async () => {
	const { isTravelDraftSource } = await import('../../modules/publication/sources.ts')
	const { getVisibleTravels } = await import('./draft.ts')

	const cases: { source: string, parsed: unknown, draft: boolean }[] = [
		{ source: 'draft: true', parsed: true, draft: true },
		{ source: 'draft: True', parsed: true, draft: true },
		{ source: 'draft: TRUE', parsed: true, draft: true },
		{ source: 'draft: false', parsed: false, draft: false },
		{ source: 'draft: "true"', parsed: 'true', draft: false },
		{ source: 'draft: "false"', parsed: 'false', draft: false },
		{ source: 'draft: yes', parsed: 'yes', draft: false },
		{ source: 'metadata:\n  draft: true', parsed: undefined, draft: false },
	]

	for (const { source, parsed, draft } of cases) {
		assert.equal(isTravelDraftSource(source), draft, `原文判断：${JSON.stringify(source)}`)

		const travels = [{ slug: 'x', draft: parsed as boolean | undefined }]
		const hidden = getVisibleTravels(travels, false).length === 0
		assert.equal(hidden, draft, `解析后判断：${JSON.stringify(source)}`)
	}
})
