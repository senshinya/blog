import type { StoryPhoto } from '../../../utils/travelStory.ts'
import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- The project uses Node's built-in test runner.
import { test } from 'node:test'
import { atlasPeekVisible, atlasSelection } from './atlas-geometry.ts'

const photo = (index: number, chapter: number, lat: number, lng: number): StoryPhoto => ({ index, day: chapter, chapter, chapterIndex: index, lat, lng, src: '', alt: '' })
const photos = [photo(0, 0, 31.23, 121.47), photo(1, 1, 35.01, 135.77), photo(2, 1, 34.68, 135.5), photo(3, 2, Number.NaN, 135), photo(4, 2, 95, 135)]

test('intro keeps Shanghai and Japan in the real trip extent', () => {
	assert.deepEqual(atlasSelection(photos, 'intro').points.map(p => p.index), [0, 1, 2])
})
test('chapter scope excludes neighboring chapters and invalid coordinates', () => {
	assert.deepEqual(atlasSelection(photos, 'chapter-1').points.map(p => p.index), [1, 2])
	assert.deepEqual(atlasSelection(photos, 'chapter-2').points, [])
})
test('photo focus keeps its chapter context and recorded coordinate', () => {
	const selection = atlasSelection(photos, 'photo-2')
	assert.equal(selection.selected?.index, 2)
	assert.deepEqual(selection.points.map(p => p.index), [1, 2])
	assert.deepEqual([selection.selected?.lng, selection.selected?.lat], [135.5, 34.68])
})
test('viewer focus overrides the reading node', () => {
	const selection = atlasSelection(photos, 'chapter-0', 2)
	assert.equal(selection.chapter, 1)
	assert.equal(selection.selected?.index, 2)
})
test('an unlocated photograph never invents a position', () => {
	const selection = atlasSelection(photos, 'photo-3')
	assert.equal(selection.selected, undefined)
	assert.deepEqual(selection.points, [])
})

const viewport = { width: 375, height: 812 }
const visibleBox = { width: 210, height: 158, top: 400, right: 350, bottom: 558, left: 140 }

test('closed dialog maps do not generate snapshots despite retained bounds', () => {
	assert.equal(atlasPeekVisible(visibleBox, viewport, false), false)
})
test('a current viewer map queues only when it intersects the viewport', () => {
	assert.equal(atlasPeekVisible(visibleBox, viewport, true), true)
	assert.equal(atlasPeekVisible({ ...visibleBox, top: 900, bottom: 1058 }, viewport, true), false)
	assert.equal(atlasPeekVisible({ ...visibleBox, top: -100, bottom: 58 }, viewport, true), true)
})
test('desktop-hidden viewer map peeks do not generate snapshots', () => {
	assert.equal(atlasPeekVisible({ ...visibleBox, width: 0, height: 0 }, viewport, true), false)
})

test('desktop snapshots reject story peeks and closed or hidden viewer peeks', async () => {
	const { atlasSnapshotEligible } = await import('./atlas-geometry.ts')
	assert.equal(typeof atlasSnapshotEligible, 'function')
	assert.equal(atlasSnapshotEligible(false, false, false), false)
	assert.equal(atlasSnapshotEligible(false, true, false), false)
})
test('desktop snapshots permit a visible peek in an open viewer', async () => {
	const { atlasSnapshotEligible } = await import('./atlas-geometry.ts')
	assert.equal(typeof atlasSnapshotEligible, 'function')
	assert.equal(atlasSnapshotEligible(false, true, true), true)
})
test('mobile snapshots permit story peeks while retaining dialog visibility checks', async () => {
	const { atlasSnapshotEligible } = await import('./atlas-geometry.ts')
	assert.equal(typeof atlasSnapshotEligible, 'function')
	assert.equal(atlasSnapshotEligible(true, false, false), true)
	assert.equal(atlasSnapshotEligible(true, true, false), false)
	assert.equal(atlasSnapshotEligible(true, true, true), true)
})

test('mobile snapshots wait through touch and spring, while desktop viewer peeks stay available', async () => {
	const { atlasSnapshotsPaused } = await import('./atlas-geometry.ts')
	assert.equal(typeof atlasSnapshotsPaused, 'function')
	for (const state of ['holding', 'resisting', 'attracting', 'dragging', 'spring']) {
		assert.equal(atlasSnapshotsPaused(true, state), true)
		assert.equal(atlasSnapshotsPaused(false, state), false)
	}
	for (const state of [undefined, 'idle', 'settled', 'free'])
		assert.equal(atlasSnapshotsPaused(true, state), false)
})

test('day overview includes sibling chapters on the same day and preserves the active point', () => {
	const flight = { ...photo(10, 1, 31, 122), day: 1, mapView: 'day' as const }
	const sameDay = { ...photo(11, 2, 35, 135), day: 1 }
	const nextDay = { ...photo(12, 3, 34, 136), day: 2 }
	const selection = atlasSelection([flight, sameDay, nextDay], 'photo-10')
	assert.equal(selection.overview, true)
	assert.deepEqual(selection.points.map(p => p.index), [10, 11])
	assert.equal(selection.selected?.index, 10)
	assert.deepEqual(atlasSelection([flight, sameDay, nextDay], 'chapter-0', 10), selection)
})
test('ordinary photos still focus locally and chapter pages retain chapter scope', () => {
	const flight = { ...photo(10, 1, 31, 122), day: 1, mapView: 'day' as const }
	const ground = { ...photo(11, 2, 35, 135), day: 1 }
	assert.equal(atlasSelection([flight, ground], 'photo-11').overview, false)
	assert.deepEqual(atlasSelection([flight, ground], 'chapter-1').points.map(p => p.index), [10])
})

test('a narrower reading footprint gets a longer veil with the same final boundary', async () => {
	const { atlasVeil } = await import('./atlas-geometry.ts')
	assert.equal(typeof atlasVeil, 'function')
	const narrow = atlasVeil(700, 850)
	const dense = atlasVeil(845, 850)
	assert.equal(narrow.end, dense.end)
	assert.ok(narrow.end - narrow.start > dense.end - dense.start)
	assert.ok(narrow.start >= 724)
	assert.ok(dense.start >= 869)
})
test('veil limits keep dense content readable and spare the clear map area', async () => {
	const { atlasVeil } = await import('./atlas-geometry.ts')
	assert.equal(typeof atlasVeil, 'function')
	const sparse = atlasVeil(100, 850)
	const dense = atlasVeil(850, 850)
	assert.ok(sparse.end - sparse.start <= 360)
	assert.ok(dense.end - dense.start >= 96)
	assert.equal(sparse.end, 970)
})

test('enlarged landscape places the focus to the right of the photo and outside its notes', async () => {
	const { atlasViewerPadding } = await import('./atlas-geometry.ts')
	assert.equal(typeof atlasViewerPadding, 'function')
	const padding = atlasViewerPadding({ width: 1874, height: 879 }, 1387, { left: 1499, right: 1799, top: 260, bottom: 563 })
	const x = (padding.left + 1874 - padding.right) / 2
	const y = (padding.top + 879 - padding.bottom) / 2
	assert.ok(x > 1387 + 20)
	assert.ok(y < 260 - 20 || y > 563 + 20)
	assert.ok(1874 - padding.left - padding.right > 100)
})
test('enlarged portrait uses the tall gap between the photo and its notes', async () => {
	const { atlasViewerPadding } = await import('./atlas-geometry.ts')
	const padding = atlasViewerPadding({ width: 1874, height: 879 }, 1073, { left: 1499, right: 1799, top: 260, bottom: 563 })
	const x = (padding.left + 1874 - padding.right) / 2
	assert.ok(x > 1073 + 20 && x < 1499 - 20)
	assert.ok(879 - padding.top - padding.bottom > 700)
})
test('enlarged stacked notes leave a right-hand map region at tablet width', async () => {
	const { atlasViewerPadding } = await import('./atlas-geometry.ts')
	const padding = atlasViewerPadding({ width: 800, height: 832 }, 720, { left: 24, right: 776, top: 545, bottom: 700 })
	const x = (padding.left + 800 - padding.right) / 2
	const y = (padding.top + 832 - padding.bottom) / 2
	assert.ok(x > 720)
	assert.ok(y < 545 - 20 || y > 700 + 20)
	assert.ok(800 - padding.left - padding.right > 0)
})

test('mobile photo map focuses in the exposed region outside the heading and prose', async () => {
	const { atlasMobileBackdropPadding } = await import('./atlas-geometry.ts')
	assert.equal(typeof atlasMobileBackdropPadding, 'function')
	const pad = atlasMobileBackdropPadding({ width: 375, height: 758 }, { left: 205, right: 355, top: 395, bottom: 565 })
	const center = { x: (pad.left + 375 - pad.right) / 2, y: (pad.top + 758 - pad.bottom) / 2 }
	assert.ok(center.x > 221 && center.x < 339)
	assert.ok(center.y > 411 && center.y < 549)
	assert.ok(375 - pad.left - pad.right >= 100)
})
test('mobile chapter overview retains a wide clear area and clamps delayed measurements', async () => {
	const { atlasMobileBackdropPadding } = await import('./atlas-geometry.ts')
	const pad = atlasMobileBackdropPadding({ width: 375, height: 758 }, { left: 20, right: 355, top: 520, bottom: 730 })
	assert.ok(375 - pad.left - pad.right > 300)
	assert.ok(758 - pad.top - pad.bottom > 170)
	const small = atlasMobileBackdropPadding({ width: 40, height: 30 }, { left: 100, right: -10, top: 100, bottom: -10 })
	assert.ok(small.left >= 0 && small.right >= 0 && small.top >= 0 && small.bottom >= 0)
	assert.ok(40 - small.left - small.right > 0)
	assert.ok(30 - small.top - small.bottom > 0)
})

test('dense mobile chapters lift their points beside the photo entry instead of against the bottom edge', async () => {
	const { atlasMobileChapterRegion } = await import('./atlas-geometry.ts')
	const region = atlasMobileChapterRegion({ width: 375, height: 514 }, { top: 429, bottom: 473 })
	const x = (region.left + region.right) / 2
	const y = (region.top + region.bottom) / 2
	assert.ok(x > 250, 'keep the points to the right of the chapter action')
	assert.ok(y < 454, 'leave at least60px beneath the framing center')
	assert.ok(region.bottom <= 498)
	assert.ok(region.bottom - region.top >= 100)
})

test('short mobile chapter introductions retain their existing map area below the notes', async () => {
	const { atlasMobileChapterRegion } = await import('./atlas-geometry.ts')
	const region = atlasMobileChapterRegion({ width: 375, height: 758 }, { top: 256, bottom: 300 })
	assert.deepEqual(region, { left: 20, right: 355, top: 324, bottom: 504 })
})

test('chapter framing stays within a short viewport even if the introduction exceeds one screen', async () => {
	const { atlasMobileChapterRegion } = await import('./atlas-geometry.ts')
	const region = atlasMobileChapterRegion({ width: 320, height: 350 }, { top: 760, bottom: 804 })
	assert.ok(region.top >= 0)
	assert.ok(region.bottom <= 334)
	assert.ok(region.right <= 300)
	assert.ok(region.right > region.left)
})

test('caption washes fade within empty page space while leaving the full description protected', async () => {
	const { atlasMobileCaptionWashTail } = await import('./atlas-geometry.ts')
	assert.equal(atlasMobileCaptionWashTail(758, 630), 96)
	assert.equal(atlasMobileCaptionWashTail(758, 734), 24)
	assert.equal(atlasMobileCaptionWashTail(1000, 976), 24)
	assert.equal(atlasMobileCaptionWashTail(514, 500), 14)
	assert.equal(atlasMobileCaptionWashTail(514, 530), 0)
})
