import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Use the project's built-in Node test runner.
import test from 'node:test'
import { chooseMagneticSnap, createSnapField, inverseMagneticPosition, magneticScrollPosition, smoothTravelScrollPosition } from './travelScroll.ts'

const field = createSnapField([{ start: 0, end: 0 }, { start: 1000, end: 1000 }, { start: 2000, end: 2000 }], 3000, 3000, 1000)
test('departure resists in both directions', () => {
	assert.ok(magneticScrollPosition(40, field) < 20)
	assert.ok(magneticScrollPosition(1040, field) - 1000 < 20)
	assert.ok(1000 - magneticScrollPosition(960, field) < 20)
})
test('approach attracts without crossing the anchor', () => {
	assert.ok(magneticScrollPosition(960, field) > 960)
	assert.ok(magneticScrollPosition(960, field) < 1000)
	assert.ok(magneticScrollPosition(1040, field) < 1040)
})
test('mapping stays monotonic and continuous, with unaltered middle travel', () => {
	let last = -1
	for (let y = 0; y <= 3000; y++) {
		const next = magneticScrollPosition(y, field)
		assert.ok(next >= last)
		assert.ok(next - last < 1.4)
		last = next
	}
	assert.equal(magneticScrollPosition(500, field), 500)
})
test('interrupted gestures resume without a position jump', () => {
	for (const y of [10, 40, 200, 500, 860, 1000, 1020, 1980])
		assert.ok(Math.abs(magneticScrollPosition(inverseMagneticPosition(y, field), field) - y) < 0.001)
})
test('small departures return, decisive departures advance', () => {
	assert.equal(chooseMagneticSnap(80, 0, field), 0)
	assert.equal(chooseMagneticSnap(200, 0, field), 1000)
	assert.equal(chooseMagneticSnap(800, 1000, field), 0)
})
test('long text remains freely scrollable before its final boundary', () => {
	const tall = createSnapField([{ start: 0, end: 0, kind: 'chapter' }, { start: 1000, end: 1500, kind: 'photo' }, { start: 2500, end: 2500, kind: 'photo' }], 3500, 3500, 1000)
	for (const y of [1000, 1040, 1200, 1460, 1500]) {
		assert.equal(magneticScrollPosition(y, tall), y)
		assert.equal(chooseMagneticSnap(y, 1000, tall), null)
	}
})
const editorial = createSnapField([{ start: 0, end: 0, kind: 'chapter' }, { start: 1000, end: 1000, kind: 'photo' }, { start: 2000, end: 2000, kind: 'photo' }], 3000, 3000, 1000)
test('chapter departure is lighter than photo departure', () => {
	const chapter = magneticScrollPosition(40, editorial)
	const photo = magneticScrollPosition(1040, editorial) - 1000
	assert.ok(chapter > 30)
	assert.ok(photo < 15)
	assert.ok(chapter > photo * 2)
})
test('a single deliberate notch exits a chapter but two small notches do not exit a photo', () => {
	assert.equal(chooseMagneticSnap(100, 0, editorial), 1000)
	assert.equal(chooseMagneticSnap(1200, 1000, editorial), 1000)
	assert.equal(chooseMagneticSnap(1360, 1000, editorial), 2000)
})
test('different node strengths remain continuous and invertible', () => {
	let last = -1
	for (let y = 0; y <= 3000; y++) {
		const next = magneticScrollPosition(y, editorial)
		assert.ok(next >= last)
		assert.ok(next - last < 1.4)
		last = next
	}
	for (const y of [30, 950, 1040, 1260, 1920])
		assert.ok(Math.abs(magneticScrollPosition(inverseMagneticPosition(y, editorial), editorial) - y) < 0.001)
})
const boundaries = createSnapField([{ start: 0, end: 0, kind: 'photo' }, { start: 1060, end: 1060, kind: 'chapter' }, { start: 2060, end: 2060, kind: 'photo' }, { start: 3060, end: 3060, kind: 'photo' }], 4060, 4060, 1000)
test('chapter/photo transitions are easy in both directions', () => {
	assert.equal(chooseMagneticSnap(100, 0, boundaries), 1060)
	assert.equal(chooseMagneticSnap(1104, 1060, boundaries), 2060)
	assert.equal(chooseMagneticSnap(1016, 1060, boundaries), 0)
	assert.equal(chooseMagneticSnap(2016, 2060, boundaries), 1060)
	assert.ok(magneticScrollPosition(44, boundaries) > 38)
})
test('photo/photo retention stays strong beside an easier chapter boundary', () => {
	assert.equal(chooseMagneticSnap(2260, 2060, boundaries), 2060)
	assert.ok(magneticScrollPosition(2100, boundaries) - 2060 < 15)
})
test('a long final photo does not add a second stop before the next chapter', () => {
	const tall = createSnapField([{ start: 0, end: 500, kind: 'photo' }, { start: 1560, end: 1560, kind: 'chapter' }, { start: 2560, end: 2560, kind: 'photo' }], 3560, 3560, 1000)
	assert.equal(chooseMagneticSnap(400, 0, tall), null)
	assert.equal(chooseMagneticSnap(550, 0, tall), 1560)
})
test('rounded mobile scroll positions retain the correct source node', () => {
	const mobile = createSnapField([{ start: 19313.2109375, end: 19313.2109375, kind: 'photo' }, { start: 20071.2109375, end: 20078.2109375, kind: 'photo' }, { start: 20904.828125, end: 20922.828125, kind: 'chapter' }, { start: 21681.109375, end: 21681.109375, kind: 'photo' }], 23000, 23000, 758)
	const origin = inverseMagneticPosition(20071, mobile)
	assert.equal(chooseMagneticSnap(origin + 44, origin, mobile), 20904.828125)
	const chapterOrigin = inverseMagneticPosition(20905, mobile)
	assert.equal(chooseMagneticSnap(chapterOrigin + 44, chapterOrigin, mobile), 21681.109375)
})

test('smooth input approaches its target gradually in either direction', () => {
	const down = smoothTravelScrollPosition(0, 100, 16)
	const up = smoothTravelScrollPosition(100, 0, 16)
	assert.ok(down > 0 && down < 50)
	assert.ok(up > 50 && up < 100)
	assert.equal(smoothTravelScrollPosition(40, 40, 16), 40)
	assert.equal(smoothTravelScrollPosition(0, 100, 0), 0)
})
test('smooth input is frame-rate independent and reverses from the displayed position', () => {
	const whole = smoothTravelScrollPosition(0, 100, 32)
	const half = smoothTravelScrollPosition(smoothTravelScrollPosition(0, 100, 16), 100, 16)
	assert.ok(Math.abs(whole - half) < 0.000001)
	assert.ok(smoothTravelScrollPosition(whole, 0, 16) < whole)
	assert.ok(smoothTravelScrollPosition(0, 100, 500) > 99)
})

test('small photo departures move visibly while retaining light resistance', () => {
	const moved = magneticScrollPosition(1040, editorial) - 1000
	assert.ok(moved >= 40 / 3 && moved < 20)
	assert.ok(magneticScrollPosition(960, editorial) > 960)
})
test('a moderate deliberate photo departure advances while a smaller input still returns', () => {
	assert.equal(chooseMagneticSnap(1320, 1000, editorial), 2000)
	assert.equal(chooseMagneticSnap(1200, 1000, editorial), 1000)
})

const desktop = createSnapField([{ start: 0, end: 0, kind: 'cover' }, { start: 1000, end: 1000, kind: 'photo' }, { start: 2000, end: 2000, kind: 'photo' }], 3000, 3000, 1000, true)
test('desktop photo departure moves at least half the small wheel input', () => {
	const moved = magneticScrollPosition(1040, desktop, 1000) - 1000
	assert.ok(moved >= 20 && moved < 40)
	assert.ok(moved > magneticScrollPosition(1040, editorial) - 1000)
})
test('desktop needs less wheel input to commit a photo transition', () => {
	assert.equal(chooseMagneticSnap(1240, 1000, desktop), 2000)
	assert.equal(chooseMagneticSnap(1040, 1000, desktop), 1000)
	assert.equal(chooseMagneticSnap(1240, 1000, editorial), 1000)
})
test('desktop stopping between pages always settles to a stable stop in either direction', () => {
	assert.equal(chooseMagneticSnap(1600, 1000, desktop), 2000)
	assert.equal(chooseMagneticSnap(1400, 2000, desktop), 1000)
	assert.equal(chooseMagneticSnap(1600, 1000, editorial), 2000)
})
test('desktop still attracts nearby stops and keeps deliberate page turns', () => {
	assert.equal(chooseMagneticSnap(1820, 1000, desktop), 2000)
	assert.equal(chooseMagneticSnap(1180, 2000, desktop), 1000)
	for (const y of [30, 950, 1040, 1260, 1920])
		assert.ok(Math.abs(magneticScrollPosition(inverseMagneticPosition(y, desktop), desktop) - y) < 0.001)
})

test('desktop origin has a small strong hold and its neighbors attract from farther away', () => {
	assert.ok(magneticScrollPosition(1004, desktop, 1000) - 1000 < 1)
	assert.ok(magneticScrollPosition(1040, desktop, 1000) < 1040)
	assert.ok(magneticScrollPosition(1180, desktop, 1000) > 1180)
	assert.ok(magneticScrollPosition(820, desktop, 1000) < 820)
	assert.ok(magneticScrollPosition(1180, desktop, 1000) > magneticScrollPosition(1180, desktop))
})
test('a short desktop gesture reaches either neighbor and a tiny gesture returns', () => {
	assert.equal(chooseMagneticSnap(1120, 1000, desktop), 2000)
	assert.equal(chooseMagneticSnap(880, 1000, desktop), 0)
	assert.equal(chooseMagneticSnap(1040, 1000, desktop), 1000)
	assert.equal(chooseMagneticSnap(960, 1000, desktop), 1000)
})
test('asymmetric desktop fields remain continuous and invertible in both directions', () => {
	let last = -1
	for (let y = 0; y <= 3000; y++) {
		const next = magneticScrollPosition(y, desktop, 1000)
		assert.ok(next >= last)
		assert.ok(next - last < 1.4)
		last = next
	}
	for (const y of [30, 900, 960, 1008, 1040, 1100, 1260, 1920])
		assert.ok(Math.abs(magneticScrollPosition(inverseMagneticPosition(y, desktop, 1000), desktop, 1000) - y) < 0.001)
})
test('asymmetric desktop attraction preserves long content reading', () => {
	const tall = createSnapField([{ start: 0, end: 500, kind: 'photo' }, { start: 1500, end: 1500, kind: 'photo' }], 2500, 2500, 1000, true)
	for (const y of [0, 80, 120, 400, 500]) {
		assert.equal(magneticScrollPosition(y, tall, 0), y)
		assert.equal(chooseMagneticSnap(y, 0, tall), null)
	}
})

test('a smaller departure region reaches a neighbor with eighty pixels in either direction', () => {
	assert.equal(chooseMagneticSnap(1080, 1000, desktop), 2000)
	assert.equal(chooseMagneticSnap(920, 1000, desktop), 0)
	assert.equal(chooseMagneticSnap(1025, 1000, desktop), 1000)
})
test('mobile-sized asymmetric fields have a small origin and broad neighbor attraction', () => {
	const mobile = createSnapField([{ start: 0, end: 0, kind: 'photo' }, { start: 758, end: 758, kind: 'photo' }, { start: 1516, end: 1516, kind: 'photo' }], 2274, 2274, 758, true)
	assert.equal(chooseMagneticSnap(818, 758, mobile), 1516)
	assert.equal(chooseMagneticSnap(698, 758, mobile), 0)
	assert.equal(chooseMagneticSnap(783, 758, mobile), 758)
	assert.ok(magneticScrollPosition(838, mobile, 758) > 838)
	assert.ok(magneticScrollPosition(678, mobile, 758) < 678)
})

test('a fresh gesture near the current stop reaches a neighbor without paying unfinished settling distance', () => {
	for (const origin of [900, 980, 1020, 1100]) {
		assert.equal(chooseMagneticSnap(origin + 80, origin, desktop), 2000)
		assert.equal(chooseMagneticSnap(origin - 80, origin, desktop), 0)
	}
	assert.equal(chooseMagneticSnap(1005, 980, desktop), 1000)
})
