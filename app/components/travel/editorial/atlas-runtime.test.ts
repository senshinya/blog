import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
// eslint-disable-next-line test/no-import-node-test -- Use the repository's Node test runner.
import test from 'node:test'
import vm from 'node:vm'
import * as geometry from './atlas-geometry.ts'

async function harness(mobile: boolean, mapPeeks: any[] = [], continuous = false) {
	const intersections: ((entries: unknown[]) => void)[] = []
	const allocations: any[] = []
	const cameras: any[] = []
	const mutations: any[] = []
	let stopped = 0
	let load: (() => void) | undefined
	let removals = 0
	const state = { mobile, node: 'intro', theme: 'dark', palette: 'mono', exploring: false, viewer: false, focusIndex: -1, reduced: false }
	const root = { isConnected: true, clientWidth: 375, querySelector: () => null, querySelectorAll: () => mapPeeks, contains: () => true, style: { removeProperty() {} } }
	const home = {
		insertBefore(element: any) {
			element.parentElement = home
		},
	}
	const canvas = { parentElement: home, nextSibling: null, clientWidth: 375, clientHeight: 758 }
	const backdrop = {
		clientWidth: 375,
		clientHeight: 758,
		dataset: {} as Record<string, string>,
		append(element: any) {
			element.parentElement = backdrop
		},
	}
	const scroller = { dataset: { snapState: 'settled' }, contains: () => true }
	class Observer {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
	class Mutation extends Observer {
		constructor(callback: any) {
			super()
			mutations.push(callback)
		}
	}
	class Intersection extends Observer {
		constructor(callback: (entries: unknown[]) => void) {
			super()
			intersections.push(callback)
		}
	}
	class MapMock {
		constructor(options: unknown) { allocations.push(options) }
		on() {}
		once(event: string, callback: () => void) {
			if (event === 'load')
				load = callback
		}

		off() {}
		resize() {}
		stop() { stopped++ }
		getStyle() { return { layers: [] } }
		getLayer() { return false }
		addLayer() {}
		addSource() {}
		setFilter() {}
		setPaintProperty() {}
		setLayoutProperty() {}
		setPixelRatio() {}
		easeTo(options: any) { cameras.push({ type: 'ease', ...options }) }
		fitBounds(bounds: any, options: any) { cameras.push({ type: 'fit', points: bounds.points, ...options }) }
		dragPan = { disable() {} }
		dragRotate = this.dragPan
		doubleClickZoom = this.dragPan
		scrollZoom = this.dragPan
		touchZoomRotate = this.dragPan
		touchPitch = this.dragPan
		keyboard = this.dragPan
		boxZoom = this.dragPan
		getCanvas() { return { tabIndex: 0 } }
		remove() { removals++ }
	}
	const source = stripTypeScriptTypes(readFileSync(new URL('./atlas.ts', import.meta.url), 'utf8'))
		.replace(/^import .*$/gm, '')
		.replace('export async function', 'async function')
		.replace('await import(\'maplibre-gl\')', 'await Promise.resolve(maplibreMock)')
	const runtime = await vm.runInNewContext(`${source}\ncreateTravelAtlas(options)`, {
		...geometry,
		setTimeout,
		clearTimeout,
		structuredClone,
		console,
		workerUrl: 'test-worker',
		maplibreMock: { Map: MapMock, setWorkerUrl() {}, LngLatBounds: class { points: any[] = []; extend(point: any) { this.points.push(point) } } },
		travelMapColors: () => ({ paper: '#1d1d1f', accent: '#ab7159', muted: '#aaa' }),
		window: { devicePixelRatio: 3 },
		lightStyle: { layers: [] },
		darkStyle: { layers: [] },
		IntersectionObserver: Intersection,
		MutationObserver: Mutation,
		ResizeObserver: Observer,
		options: { root, canvas, mobileBackdrop: continuous ? backdrop : undefined, scroller, photos: continuous
			? [
					{ index: 0, day: 0, chapter: 0, lat: 31.15, lng: 121.8 },
					{ index: 1, day: 0, chapter: 0, lat: 31.16, lng: 121.81 },
					{ index: 2, day: 0, chapter: 1, lat: 34.2, lng: 135.5, mapView: 'day' },
				]
			: [], locale: 'zh', labels: {}, getState: () => state, onMove() {}, onFailure() {} },
	})
	return { state, allocations, runtime, intersections, cameras, canvas, home, backdrop, scroller, stopped: () => stopped, removals: () => removals, async loaded() {
		load?.()
		await Promise.resolve()
		await Promise.resolve()
	}, snap(value: string) {
		scroller.dataset.snapState = value
		mutations[0]([{ target: scroller, attributeName: 'data-snap-state', addedNodes: [] }])
	} }
}

test('mobile reading allocates no hidden desktop map and creates it on desktop transition', async () => {
	const h = await harness(true)
	try {
		assert.equal(h.allocations.length, 0)
		h.runtime.update()
		assert.equal(h.allocations.length, 0)
		h.state.mobile = false
		h.runtime.update()
		assert.equal(h.allocations.length, 1)
		h.runtime.update()
		assert.equal(h.allocations.length, 1)
	}
	finally {
		h.runtime.dispose()
	}
	assert.equal(h.removals(), 1)
})

test('desktop reading retains one live map and releases it on disposal', async () => {
	const h = await harness(false)
	assert.equal(h.allocations.length, 1)
	h.runtime.dispose()
	assert.equal(h.removals(), 1)
})

test('offscreen mobile map backdrops release their decoded image resources', async () => {
	let ready = true
	let source = true
	let background = true
	const image = {
		classList: { remove() { ready = false } },
		removeAttribute() { source = false },
	}
	const peek = {
		dataset: { mapImage: 'photo-0' },
		classList: { contains: (name: string) => name === 'reading-map' },
		closest: () => null,
		querySelector: () => image,
		style: { removeProperty() { background = false } },
	}
	const h = await harness(true, [peek])
	ready = source = background = true
	try {
		h.intersections[0]!([{ target: peek, isIntersecting: false }])
		assert.equal(ready, false)
		assert.equal(source, false)
		assert.equal(background, false)
	}
	finally {
		h.runtime.dispose()
	}
})

test('continuous mobile atlas reuses its geographic camera and waits for scroll settlement', async () => {
	const h = await harness(true, [], true)
	try {
		assert.equal(h.allocations.length, 0, 'cover has no map')
		h.snap('spring')
		h.state.node = 'photo-0'
		h.runtime.update()
		assert.equal(h.allocations.length, 0, 'first renderer waits until scroll settles')
		h.snap('settled')
		await h.loaded()
		assert.equal(h.allocations.length, 1)
		assert.equal(h.canvas.parentElement, h.backdrop)
		assert.equal(h.allocations[0].pixelRatio, 1.5)
		assert.deepEqual([...h.cameras.at(-1).center], [121.8, 31.15])
		assert.equal(h.cameras.at(-1).duration, 0, 'initial scene never flies from world origin')
		const count = h.cameras.length
		h.snap('dragging')
		h.state.node = 'photo-1'
		h.runtime.update()
		assert.equal(h.cameras.length, count, 'drag retains current map without camera work')
		assert.ok(h.stopped() > 0)
		h.snap('settled')
		assert.deepEqual([...h.cameras.at(-1).center], [121.81, 31.16])
		assert.equal(h.cameras.at(-1).duration, 650)
		assert.equal(h.allocations.length, 1, 'no replacement renderer or raster snapshot map')
		h.runtime.update()
		assert.equal(h.cameras.length, count + 1, 'same scene does not restart the animation')
	}
	finally { h.runtime.dispose() }
})

test('mobile day views fit all day points, reduced motion is immediate, desktop reuses its own framing', async () => {
	const h = await harness(true, [], true)
	try {
		h.state.node = 'photo-0'
		h.runtime.update()
		await h.loaded()
		h.state.reduced = true
		h.state.node = 'photo-2'
		h.runtime.update()
		assert.equal(h.cameras.at(-1).type, 'fit')
		assert.equal(h.cameras.at(-1).points.length, 3)
		assert.equal(h.cameras.at(-1).maxZoom, 8)
		assert.equal(h.cameras.at(-1).duration, 0)
		h.state.node = 'intro'
		h.runtime.update()
		assert.equal(h.backdrop.dataset.visible, 'false')
		h.state.mobile = false
		h.state.node = 'photo-1'
		h.runtime.update()
		assert.equal(h.canvas.parentElement, h.home)
		assert.equal(h.cameras.at(-1).zoom, 14.3)
		assert.equal(h.allocations.length, 1)
	}
	finally { h.runtime.dispose() }
})
