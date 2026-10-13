import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- The repository uses Node's test runner.
import test from 'node:test'
import { createTravelScrollRenderer, readTravelScrollVisualPosition } from './travelScrollRenderer.ts'

function harness() {
	let native = 0
	let enabled = true
	const scroller = {
		clientHeight: 600,
		get scrollTop() { return native },
		set scrollTop(value: number) { native = Math.floor(value) },
	} as HTMLElement
	const layers = [0, 1, 2, 3].map(i => ({ start: i * 600, end: (i + 1) * 600, element: { style: { transform: '' } } as HTMLElement }))
	const renderer = createTravelScrollRenderer(scroller, () => enabled)
	renderer.measure(layers, 600)
	return {
		scroller,
		layers,
		renderer,
		disable() { enabled = false },
	}
}

test('fractional native scroll writes remain visibly continuous between integer offsets', () => {
	const h = harness()
	try {
		h.renderer.write(0.25)
		assert.equal(h.scroller.scrollTop, 0)
		assert.equal(readTravelScrollVisualPosition(h.scroller), 0.25)
		assert.equal(h.layers[0]!.element.style.transform, 'translate3d(0, -0.25px, 0)')
		h.renderer.write(0.75)
		assert.equal(h.scroller.scrollTop, 0)
		assert.equal(readTravelScrollVisualPosition(h.scroller), 0.75)
		h.renderer.write(1.25)
		assert.equal(h.scroller.scrollTop, 1)
		assert.equal(readTravelScrollVisualPosition(h.scroller), 1.25)
		assert.equal(h.layers[0]!.element.style.transform, 'translate3d(0, -0.25px, 0)')
		assert.equal(h.renderer.quantized, true)
	}
	finally { h.renderer.dispose() }
})

test('only visible pages receive compensation; offscreen layers are released', () => {
	const h = harness()
	try {
		h.renderer.write(300.5)
		assert.equal(h.layers[0]!.element.style.transform, 'translate3d(0, -0.5px, 0)')
		assert.equal(h.layers[1]!.element.style.transform, 'translate3d(0, -0.5px, 0)')
		assert.equal(h.layers[2]!.element.style.transform, '')
		assert.equal(h.renderer.offsetFor(h.layers[0]!.element), -0.5)
		assert.equal(h.renderer.offsetFor(h.layers[2]!.element), 0)
		h.renderer.write(1500.5)
		assert.equal(h.layers[0]!.element.style.transform, '')
		assert.equal(h.layers[1]!.element.style.transform, '')
		assert.equal(h.layers[2]!.element.style.transform, 'translate3d(0, -0.5px, 0)')
	}
	finally { h.renderer.dispose() }
})

test('native input, desktop mode and disposal release the visual offset', () => {
	const h = harness()
	h.renderer.write(0.5)
	h.scroller.scrollTop = 100
	assert.equal(readTravelScrollVisualPosition(h.scroller), 100)
	h.renderer.sync()
	assert.equal(h.renderer.position, 100)
	assert.equal(h.layers[0]!.element.style.transform, '')
	h.renderer.write(100.75)
	h.disable()
	h.renderer.sync()
	assert.equal(h.renderer.position, 100)
	assert.equal(h.layers[0]!.element.style.transform, '')
	h.renderer.dispose()
	assert.equal(readTravelScrollVisualPosition(h.scroller), 100)
})

test('browsers with fractional native offsets keep their native rendering path', () => {
	let native = 0
	const scroller = {
		clientHeight: 600,
		get scrollTop() { return native },
		set scrollTop(value: number) { native = value },
	} as HTMLElement
	const layer = { element: { style: { transform: '' } } as HTMLElement, start: 0, end: 600 }
	const renderer = createTravelScrollRenderer(scroller, () => true)
	try {
		renderer.measure([layer], 600)
		renderer.write(0.75)
		assert.equal(renderer.position, 0.75)
		assert.equal(renderer.quantized, false)
		assert.equal(layer.element.style.transform, '')
	}
	finally { renderer.dispose() }
})
