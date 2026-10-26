import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- The project uses Node's built-in test runner.
import test from 'node:test'

test('cover bounds retain longitude-latitude order and reject malformed or reversed extents', async () => {
	const { normalizeTravelCoverMap } = await import('./travelCoverMap.ts')
	const bounds = [[166, -47], [175, -40]]
	assert.deepEqual(normalizeTravelCoverMap({ bounds })?.bounds, bounds)
	for (const invalid of [null, [], [[166, -47]], [[175, -40], [166, -47]], [[166, -47], [181, -40]], [[166, -91], [175, -40]], [[166, -47], [166, -40]], [['166', -47], [175, -40]]])
		assert.equal(normalizeTravelCoverMap({ bounds: invalid })?.bounds, undefined)
	assert.equal(normalizeTravelCoverMap(undefined), undefined)
	assert.equal(normalizeTravelCoverMap('south-island'), undefined)
})

test('cover selectors use positive chapter numbers and actual day numbers including day zero', async () => {
	const { normalizeTravelCoverMap } = await import('./travelCoverMap.ts')
	assert.deepEqual(normalizeTravelCoverMap({ tracks: { chapters: [1, 3, 3, 0, -1, 1.5, '2'], days: [0, 7, 7, -1, '3'] } }), { tracks: { chapters: [1, 3], days: [0, 7] } })
	assert.deepEqual(normalizeTravelCoverMap({ tracks: {} }), { tracks: {} })
	assert.deepEqual(normalizeTravelCoverMap({ tracks: { chapters: 'all', days: [Number.NaN] } }), { tracks: { chapters: [], days: [] } })
	assert.equal(normalizeTravelCoverMap({ tracks: true }), undefined)
})
