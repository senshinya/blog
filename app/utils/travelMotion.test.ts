import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Repository Node test runner.
import test from 'node:test'
import { travelMotion, travelMotionEase, travelMotionStyles } from './travelMotion.ts'

test('CSS and map easing describe the same curve at intermediate times', () => {
	const [x1, y1, x2, y2] = travelMotion.easing.match(/[\d.]+/g)!.map(Number) as [number, number, number, number]
	const coordinate = (t: number, a: number, b: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3
	for (const t of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
		const x = coordinate(t, x1, x2)
		const y = coordinate(t, y1, y2)
		assert.ok(Math.abs(travelMotionEase(x) - y) < 0.00001, `CSS and map drift at ${x}`)
	}
})

test('map easing never overshoots and has exact endpoints', () => {
	assert.equal(travelMotionEase(0), 0)
	assert.equal(travelMotionEase(1), 1)
	let previous = 0
	for (let i = 1; i <= 100; i++) {
		const value = travelMotionEase(i / 100)
		assert.ok(value >= previous && value <= 1)
		previous = value
	}
})

test('CSS timing tokens are derived from the same durations as JavaScript', () => {
	for (const [kind, duration] of Object.entries(travelMotion.duration))
		assert.equal(travelMotionStyles[`--travel-motion-${kind}` as keyof typeof travelMotionStyles], `${duration}ms`)
	assert.equal(travelMotionStyles['--travel-motion-easing'], travelMotion.easing)
})
