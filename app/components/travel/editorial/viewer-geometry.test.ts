import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- The project uses Node's built-in test runner.
import { test } from 'node:test'
import {
	clampViewerPose,
	fitViewerImage,
	orientedViewerRect,
	pinchViewerAt,
	viewerMorph,
	viewerSwipe,
	zoomViewerAt,
} from './viewer-geometry.ts'

test('tilted bounds retain their center without inflating the actual image dimensions', () => {
	const rect = orientedViewerRect({ left: 10, top: 20, width: 204, height: 108 }, { width: 200, height: 100 }, 1.2)
	assert.deepEqual(rect, { left: 12, top: 24, width: 200, height: 100, rotation: 1.2 })
	assert.equal(viewerMorph(rect, { left: 112, top: 224, width: 400, height: 200 }), 'translate3d(-200px, -250px, 0) rotate(1.2deg) scale(0.5, 0.5)')
})

test('fits portrait images inside the viewport without changing their aspect ratio', () => {
	assert.deepEqual(fitViewerImage({ width: 400, height: 800 }, { width: 1000, height: 500 }), { width: 250, height: 500 })
})

test('fits landscape images inside the viewport without changing their aspect ratio', () => {
	assert.deepEqual(fitViewerImage({ width: 1200, height: 600 }, { width: 500, height: 500 }), { width: 500, height: 250 })
})

test('does not upscale an image smaller than the viewport', () => {
	assert.deepEqual(fitViewerImage({ width: 200, height: 100 }, { width: 1000, height: 500 }), { width: 200, height: 100 })
})

test('invalid image or viewport dimensions produce an empty fit', () => {
	assert.deepEqual(fitViewerImage({ width: 0, height: 100 }, { width: 400, height: 300 }), { width: 0, height: 0 })
	assert.deepEqual(fitViewerImage({ width: Number.POSITIVE_INFINITY, height: 100 }, { width: 400, height: 300 }), { width: 0, height: 0 })
	assert.deepEqual(fitViewerImage({ width: 100, height: 100 }, { width: Number.NaN, height: 300 }), { width: 0, height: 0 })
})

test('clamps zoomed pan so no blank edge can enter the viewport', () => {
	assert.deepEqual(
		clampViewerPose({ scale: 2, x: 600, y: -600 }, { width: 600, height: 450 }, { width: 400, height: 300 }),
		{ scale: 2, x: 400, y: -300 },
	)
})

test('centers an axis when the scaled image does not fill that viewport axis', () => {
	assert.deepEqual(
		clampViewerPose({ scale: 2, x: 100, y: 500 }, { width: 200, height: 300 }, { width: 400, height: 300 }),
		{ scale: 2, x: 0, y: 150 },
	)
})

test('clamps zoom scale to the supported range', () => {
	assert.deepEqual(
		clampViewerPose({ scale: 8, x: 0, y: 0 }, { width: 800, height: 600 }, { width: 400, height: 300 }),
		{ scale: 4, x: 0, y: 0 },
	)
	assert.deepEqual(
		clampViewerPose({ scale: 0, x: 100, y: -100 }, { width: 400, height: 300 }, { width: 400, height: 300 }),
		{ scale: 1, x: 0, y: 0 },
	)
})

test('invalid fitted or viewport dimensions return a centered pose with bounded scale', () => {
	assert.deepEqual(clampViewerPose({ scale: 8, x: 40, y: -30 }, { width: Number.NaN, height: 300 }, { width: 400, height: 300 }), { scale: 4, x: 0, y: 0 })
	assert.deepEqual(clampViewerPose({ scale: 0, x: 40, y: -30 }, { width: 400, height: 300 }, { width: 0, height: 300 }), { scale: 1, x: 0, y: 0 })
})

test('zoom keeps the image point under the cursor fixed when pan limits allow', () => {
	const fitted = { width: 400, height: 267 }
	const viewport = { width: 400, height: 300 }
	const pose = { scale: 1, x: 0, y: 0 }
	const point = { x: 300, y: 100 }
	const zoomed = zoomViewerAt(pose, 2, point, fitted, viewport)
	assert.deepEqual(zoomed, { scale: 2, x: -100, y: 50 })
	const before = { x: (point.x - viewport.width / 2 - pose.x) / pose.scale, y: (point.y - viewport.height / 2 - pose.y) / pose.scale }
	const after = { x: (point.x - viewport.width / 2 - zoomed.x) / zoomed.scale, y: (point.y - viewport.height / 2 - zoomed.y) / zoomed.scale }
	assert.deepEqual(after, before)
})

test('zooming out reverses cursor-relative pan while clamping at fit', () => {
	const fitted = { width: 400, height: 267 }
	const viewport = { width: 400, height: 300 }
	const zoomed = zoomViewerAt({ scale: 2, x: 100, y: -100 }, 1, { x: 300, y: 100 }, fitted, viewport)
	assert.deepEqual(zoomed, { scale: 1, x: 0, y: 0 })
})

test('zoom clamps pan when preserving the cursor point would expose a blank edge', () => {
	assert.deepEqual(
		zoomViewerAt({ scale: 1, x: 0, y: 0 }, 2, { x: 200, y: 0 }, { width: 400, height: 200 }, { width: 400, height: 300 }),
		{ scale: 2, x: 0, y: 50 },
	)
})

test('pinch applies centroid movement before clamping the final pose', () => {
	assert.deepEqual(
		pinchViewerAt(
			{ scale: 2, x: 200, y: 0 },
			1.5,
			{ x: 350, y: 150 },
			{ x: 250, y: 150 },
			{ width: 400, height: 300 },
			{ width: 400, height: 300 },
		),
		{ scale: 1.5, x: 87.5, y: 0 },
	)
})

test('pinch clamps only after applying both anchor scale and centroid movement', () => {
	assert.deepEqual(
		pinchViewerAt(
			{ scale: 2, x: 200, y: 0 },
			1.5,
			{ x: 400, y: 150 },
			{ x: 0, y: 150 },
			{ width: 400, height: 300 },
			{ width: 400, height: 300 },
		),
		{ scale: 1.5, x: -100, y: 0 },
	)
})

test('swipes move to the next or previous photo only when horizontal and at fit', () => {
	assert.equal(viewerSwipe(-80, 10, 1), 1)
	assert.equal(viewerSwipe(80, -10, 1.01), -1)
	assert.equal(viewerSwipe(-60, 0, 1), 1)
	assert.equal(viewerSwipe(80, 0, 1.02), 0)
	assert.equal(viewerSwipe(-59, 0, 1), 0)
	assert.equal(viewerSwipe(-100, 80, 1), 0)
	assert.equal(viewerSwipe(-130, 100, 1), 0)
	assert.equal(viewerSwipe(Number.NaN, 0, 1), 0)
	assert.equal(viewerSwipe(100, Number.POSITIVE_INFINITY, 1), 0)
	assert.equal(viewerSwipe(100, 0, Number.POSITIVE_INFINITY), 0)
})

test('morph maps a centered target element back to the source rectangle', () => {
	assert.equal(
		viewerMorph(
			{ left: 10, top: 20, width: 100, height: 50 },
			{ left: 110, top: 220, width: 200, height: 100 },
		),
		'translate3d(-150px, -225px, 0) scale(0.5, 0.5)',
	)
})

test('morph safely declines rectangles with a zero dimension', () => {
	assert.equal(viewerMorph({ left: 0, top: 0, width: 0, height: 20 }, { left: 0, top: 0, width: 100, height: 100 }), 'none')
	assert.equal(viewerMorph({ left: 0, top: 0, width: 10, height: 20 }, { left: 0, top: 0, width: 100, height: 0 }), 'none')
	assert.equal(viewerMorph({ left: Number.NaN, top: 0, width: 10, height: 20 }, { left: 0, top: 0, width: 100, height: 100 }), 'none')
	assert.equal(viewerMorph({ left: 0, top: 0, width: Number.POSITIVE_INFINITY, height: 20 }, { left: 0, top: 0, width: 100, height: 100 }), 'none')
})
