import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Use the project's built-in Node test runner.
import test from 'node:test'
import { activeReadingHeading, createReadingRail, flattenReadingHeadings, readingPercent } from './readingProgress.ts'

test('reading progress follows the article range and clamps before and after it', () => {
	assert.equal(readingPercent(0, 300, 2000, 800), 0)
	assert.equal(readingPercent(500, 300, 2000, 800), 35)
	assert.equal(readingPercent(1500, 300, 2000, 800), 100)
	assert.equal(readingPercent(5000, 300, 2000, 800), 100)
	assert.equal(readingPercent(500, 300, 0, 800), 0)
})

test('heading selection respects a 100px top offset and preserves the root chapter', () => {
	const headings = flattenReadingHeadings([
		{ id: 'a', text: 'A', depth: 2, children: [{ id: 'a1', text: 'A1', depth: 3 }] },
		{ id: 'b', text: 'B', depth: 2 },
	])
	assert.deepEqual(headings.map(h => [h.id, h.rootId]), [['a', 'a'], ['a1', 'a'], ['b', 'b']])
	const measured = headings.map((h, index) => ({ ...h, top: [300, 700, 1200][index]!, height: 24, ratio: index / 3 }))
	assert.equal(activeReadingHeading(measured, 0, 800)?.id, 'a')
	assert.equal(activeReadingHeading(measured, 601, 800)?.id, 'a1')
	assert.equal(activeReadingHeading(measured, 625, 800)?.id, 'b')
	assert.equal(activeReadingHeading(measured, 850, 300)?.id, 'a1')
	assert.equal(activeReadingHeading(measured, 1100, 800)?.id, 'b')
	assert.equal(activeReadingHeading(measured, 0, 200), undefined)
	assert.equal(activeReadingHeading([], 100, 800), undefined)
})

test('curved rail and dots remain finite and bounded at the article edges', () => {
	for (const height of [0, 40, 583]) {
		for (const progress of [0, 1, 50, 99, 100]) {
			const rail = createReadingRail(height, progress / 100 * height, 1, 14)
			assert.doesNotMatch(rail.path, /NaN|Infinity/)
			assert.ok(rail.y >= 0 && rail.y <= height)
			assert.ok(rail.dotX(0) >= 8)
			assert.equal(rail.dotX(-1000), 8)
			if (progress === 0 || progress === 100)
				assert.equal(rail.bulge, 0)
		}
	}
	const rail = createReadingRail(583, 291.5, 1, 0)
	assert.ok(rail.dotX(291.5) > 18)
	assert.equal(rail.dotX(0), 8)
	assert.equal(createReadingRail(583, 291.5, 0, 14).bulge, 0)
})
