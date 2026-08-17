import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Vitest is not a project dependency; use Node's built-in runner.
import test from 'node:test'

test('recognizes a top-level YAML draft flag', async () => {
	const { isTravelDraftSource } = await import('./draft.ts')

	assert.equal(isTravelDraftSource('slug: korea-202510\ndraft: true\ntitle: 南韩\n'), true)
})

test('ignores values that are not a top-level boolean draft flag', async () => {
	const { isTravelDraftSource } = await import('./draft.ts')

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
