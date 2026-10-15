import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
// eslint-disable-next-line test/no-import-node-test -- Use the repository's Node test runner.
import test from 'node:test'
import vm from 'node:vm'
import * as mapSettings from '../../../utils/travelMapSettings.ts'
import * as motion from '../../../utils/travelMotion.ts'
import { neutralTravelPaint, travelMapColors } from '../../../utils/travelTheme.ts'
import * as geometry from './atlas-geometry.ts'
import * as trackLayers from './atlas-tracks.ts'

async function harness(mobile: boolean, mapPeeks: any[] = [], continuous = false, snapshots = false, requestStyle?: typeof fetch) {
	const intersections: ((entries: unknown[]) => void)[] = []
	const allocations: any[] = []
	const cameras: any[] = []
	const paints: any[] = []
	const swaps: any[] = []
	const basemapEvents: string[] = []
	let styleLoaded: (() => void) | undefined
	let encodings = 0
	const overviewZoom = { value: 10 }
	const photoZoomOffset = { value: 0 }
	const mutations: any[] = []
	const interactiveClasses = new Set(['maplibregl-interactive'])
	const canvasContainer = { classList: {
		remove: (name: string) => interactiveClasses.delete(name),
		toggle(name: string, enabled: boolean) {
			enabled ? interactiveClasses.add(name) : interactiveClasses.delete(name)
		},
	} }
	let dragEnabled = false
	let stopped = 0
	let load: (() => void) | undefined
	let removals = 0
	const state = { mobile, node: 'intro', theme: 'dark', palette: 'mono', exploring: false, viewer: false, viewerClosing: false, focusIndex: -1, reduced: false, tracksVisible: false, basemap: 'simple', trackColor: 'blue' }
	const root = { isConnected: true, clientWidth: 375, append() {}, querySelector: () => null, querySelectorAll: () => mapPeeks, contains: () => true, style: { removeProperty() {} } }
	const home = {
		insertBefore(element: any) {
			element.parentElement = home
		},
	}
	const canvas = { dataset: {} as Record<string, string>, parentElement: home, nextSibling: null, clientWidth: 375, clientHeight: 758 }
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
		layers = new Map<string, any>([['background', { id: 'background' }]])
		sources = new Map<string, any>()
		constructor(options: unknown) { allocations.push(options) }
		on() {}
		once(event: string, callback: () => void) {
			if (event === 'style.load')
				styleLoaded = callback
			else if (snapshots)
				queueMicrotask(callback)
			else if (event === 'load')
				load = callback
		}

		off() {}
		resize() {}
		stop() { stopped++ }
		getStyle() { return { layers: [...this.layers.values()], sources: {} } }
		setStyle(style: any) {
			swaps.push(style)
			styleLoaded?.()
		}

		getLayer(id: string) { return this.layers.get(id) }
		addLayer(layer: any) { this.layers.set(layer.id, layer) }
		addSource(id: string) { this.sources.set(id, { setData() {} }) }
		getSource(id: string) { return this.sources.get(id) }
		setFilter() {}
		setPaintProperty(id: string, key: string, value: unknown) { paints.push({ id, key, value }) }
		setLayoutProperty() {}
		setPixelRatio() {}
		addControl() {}
		removeControl() {}
		easeTo(options: any) { cameras.push({ type: 'ease', ...options }) }
		fitBounds(bounds: any, options: any) { cameras.push({ type: 'fit', points: bounds.points, ...options }) }
		jumpTo(options: any) { cameras.push({ type: 'jump', ...options }) }
		setPadding() {}
		cameraForBounds() { return { zoom: overviewZoom.value } }
		dragPan = {
			enable() { dragEnabled = true },
			disable() { dragEnabled = false },
		}

		dragRotate = this.dragPan
		doubleClickZoom = { enable() {}, disable() {} }
		scrollZoom = this.doubleClickZoom
		touchZoomRotate = this.doubleClickZoom
		touchPitch = this.doubleClickZoom
		keyboard = this.doubleClickZoom
		boxZoom = this.doubleClickZoom
		getCanvas() { return { tabIndex: 0, toDataURL: () => `data:image/png;base64,${++encodings}` } }
		getCanvasContainer() { return canvasContainer }
		remove() { removals++ }
	}
	const source = stripTypeScriptTypes(readFileSync(new URL('./atlas.ts', import.meta.url), 'utf8'))
		.replace(/^import .*$/gm, '')
		.replace('export async function', 'async function')
		.replace('await import(\'maplibre-gl\')', 'await Promise.resolve(maplibreMock)')
	const runtime = await vm.runInNewContext(`${source}\ncreateTravelAtlas(options)`, {
		...geometry,
		...motion,
		...mapSettings,
		createTravelBasemapLoader: (key: string, locale: string) => mapSettings.createTravelBasemapLoader(key, locale, requestStyle ?? (async () => { throw new Error('No key') })),
		...trackLayers,
		setTimeout,
		clearTimeout,
		structuredClone,
		fetch: requestStyle ?? (async () => { throw new Error('No key') }),
		AbortSignal,
		document: { createElement: () => ({ style: {}, setAttribute() {}, remove() {} }) },
		console,
		workerUrl: 'test-worker',
		maplibreMock: { Map: MapMock, NavigationControl: class {}, setWorkerUrl() {}, LngLatBounds: class { points: any[] = []; extend(point: any) { this.points.push(point) } } },
		travelMapColors,
		neutralTravelPaint,
		window: { devicePixelRatio: 3 },
		lightStyle: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#fff' } }] },
		darkStyle: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#111' } }] },
		IntersectionObserver: Intersection,
		MutationObserver: Mutation,
		ResizeObserver: Observer,
		options: { root, canvas, mobileBackdrop: continuous ? backdrop : undefined, scroller, photos: continuous || snapshots
			? [
					{ index: 0, day: 0, chapter: 0, lat: 31.15, lng: 121.8, get mapZoomOffset() { return photoZoomOffset.value } },
					{ index: 1, day: 0, chapter: 0, lat: 31.16, lng: 121.81 },
					{ index: 2, day: 0, chapter: 1, lat: 34.2, lng: 135.5, mapView: 'day' },
				]
			: [], apiKey: requestStyle ? 'test-key' : '', onBasemap: (value: string) => basemapEvents.push(value), locale: 'zh', labels: {}, getState: () => state, onMove() {}, onFailure() {} },
	})
	return { state, allocations, runtime, swaps, basemapEvents, intersections, cameras, paints, encodings: () => encodings, overviewZoom, photoZoomOffset, canvas, home, backdrop, scroller, interactiveClasses, dragEnabled: () => dragEnabled, stopped: () => stopped, removals: () => removals, async loaded() {
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

test('viewer camera uses mode timing in both directions and resumes slower reading travel afterwards', async () => {
	const h = await harness(false, [], true)
	try {
		await h.loaded()
		h.state.node = 'photo-0'
		h.state.focusIndex = 0
		h.runtime.update()
		assert.equal(h.cameras.at(-1).duration, 650)
		h.state.viewer = true
		h.runtime.update()
		assert.equal(h.cameras.at(-1).duration, 280)
		h.state.viewer = false
		h.state.viewerClosing = true
		h.runtime.update()
		assert.equal(h.cameras.at(-1).duration, 280, 'exit camera must finish with the returning photograph')
		assert.equal(typeof h.cameras.at(-1).easing, 'function')
		h.runtime.resize()
		assert.equal(h.cameras.at(-1).duration, 280, 'layout updates during closing must retain mode timing')
		h.state.viewerClosing = false
		h.state.node = 'photo-1'
		h.state.focusIndex = 1
		h.runtime.update()
		assert.equal(h.cameras.at(-1).duration, 650)
		h.state.reduced = true
		h.state.viewer = true
		h.runtime.update()
		assert.equal(h.cameras.at(-1).duration, 0)
	}
	finally { h.runtime.dispose() }
})

test('entering and leaving map exploration use the same mode duration as the foreground', async () => {
	const h = await harness(false, [], true)
	try {
		await h.loaded()
		h.state.node = 'photo-0'
		h.runtime.update()
		h.state.exploring = true
		h.runtime.explore('chapter-0')
		assert.equal(h.cameras.at(-1).duration, 280)
		h.state.exploring = false
		h.runtime.restore()
		assert.equal(h.cameras.at(-1).duration, 280)
	}
	finally { h.runtime.dispose() }
})

test('desktop reading retains one live map and releases it on disposal', async () => {
	const h = await harness(false)
	assert.equal(h.allocations.length, 1)
	h.runtime.dispose()
	assert.equal(h.removals(), 1)
})

test('toggling tracks leaves the basemap and camera untouched while palette changes still repaint it', async () => {
	const h = await harness(false)
	try {
		await h.loaded()
		const backgrounds = () => h.paints.filter(paint => paint.id === 'background').length
		const before = backgrounds()
		const cameraCount = h.cameras.length
		h.state.tracksVisible = true
		h.runtime.update()
		assert.equal(backgrounds(), before, 'a route toggle must only repaint the overlay')
		assert.equal(h.cameras.length, cameraCount)
		h.state.palette = 'mist'
		h.runtime.update()
		assert.ok(backgrounds() > before, 'palette changes must still repaint the basemap')
	}
	finally { h.runtime.dispose() }
})

test('track visibility snapshots stay distinct and reuse the matching image when toggled back', async () => {
	let peek: any
	const image = {
		dataset: {} as Record<string, string>,
		src: '',
		classList: { add() {}, remove() {} },
		removeAttribute() { this.src = '' },
		closest: () => peek,
	}
	peek = {
		dataset: { mapImage: 'photo-0' },
		classList: { contains: () => false },
		closest: () => null,
		querySelector: () => image,
		style: { removeProperty() {} },
	}
	const h = await harness(true, [peek], false, true)
	const settle = async () => {
		for (let i = 0; i < 20; i++)
			await Promise.resolve()
	}
	try {
		h.intersections[0]!([{ target: peek, isIntersecting: true }])
		await settle()
		const hidden = image.src
		assert.ok(hidden.startsWith('data:image/png'))
		h.state.tracksVisible = true
		h.runtime.update()
		await settle()
		const visible = image.src
		assert.notEqual(visible, hidden)
		const encoded = h.encodings()
		h.state.tracksVisible = false
		h.runtime.update()
		assert.equal(image.src, hidden, 'returning to a rendered state should restore its cached image immediately')
		await settle()
		assert.equal(h.encodings(), encoded, 'the cached state must not need another PNG render')
		h.state.tracksVisible = true
		h.runtime.update()
		assert.equal(image.src, visible)
		h.state.theme = 'light'
		h.runtime.update()
		assert.equal(image.src, '', 'a different theme must invalidate both visibility states')
		await settle()
		const light = image.src
		assert.ok(light && light !== visible)
		h.state.tracksVisible = false
		h.runtime.update()
		h.state.tracksVisible = true
		h.runtime.update()
		assert.equal(image.src, light)
		await settle()
		assert.equal(image.src, light, 'an obsolete render must not overwrite the latest toggle state')
	}
	finally { h.runtime.dispose() }
})

test('dense city photographs zoom closer than their chapter overview instead of falling back to a wider fixed view', async () => {
	const h = await harness(false, [], true)
	try {
		h.overviewZoom.value = 15
		await h.loaded()
		h.state.node = 'photo-0'
		h.state.focusIndex = 0
		h.runtime.update()
		assert.equal(h.cameras.at(-1)?.type, 'ease')
		assert.equal(h.cameras.at(-1)?.zoom, 16)
		h.state.viewer = true
		h.runtime.update()
		assert.equal(h.cameras.at(-1)?.zoom, 16)
	}
	finally {
		h.runtime.dispose()
	}
})

test('photo framing accepts a small zoom adjustment on desktop and mobile without changing chapter bounds', async () => {
	for (const mobile of [false, true]) {
		const h = await harness(mobile, [], true)
		try {
			h.photoZoomOffset.value = 0.6
			h.state.node = 'photo-0'
			h.runtime.update()
			await h.loaded()
			h.runtime.update()
			assert.equal(h.cameras.at(-1)?.zoom, (mobile ? 12.8 : 14.3) + 0.6)
			h.state.node = 'chapter-0'
			h.runtime.update()
			assert.equal(h.cameras.at(-1)?.type, 'fit')
			assert.equal(h.cameras.at(-1)?.maxZoom, 15)
		}
		finally { h.runtime.dispose() }
	}
})

test('map drag cursor follows interaction through reading, exploration and photo preview', async () => {
	const h = await harness(false)
	try {
		assert.equal(h.interactiveClasses.has('maplibregl-interactive'), false, 'reading must not advertise dragging before map load')
		await h.loaded()
		assert.equal(h.dragEnabled(), false)
		assert.equal(h.interactiveClasses.has('maplibregl-interactive'), false)
		h.state.exploring = true
		h.runtime.update()
		assert.equal(h.dragEnabled(), true)
		assert.equal(h.interactiveClasses.has('maplibregl-interactive'), true)
		h.state.exploring = false
		h.state.viewer = true
		h.runtime.update()
		assert.equal(h.dragEnabled(), false)
		assert.equal(h.interactiveClasses.has('maplibregl-interactive'), false)
		h.state.viewer = false
		h.runtime.explore('photo-0')
		assert.equal(h.dragEnabled(), true)
		assert.equal(h.interactiveClasses.has('maplibregl-interactive'), true)
		h.runtime.restore()
		assert.equal(h.dragEnabled(), false)
		assert.equal(h.interactiveClasses.has('maplibregl-interactive'), false)
	}
	finally {
		h.runtime.dispose()
	}
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

test('satellite exploration locks panning and returning to simple restores dragging', async () => {
	const h = await harness(false)
	try {
		await h.loaded()
		h.state.exploring = true
		h.runtime.explore('intro')
		assert.equal(h.dragEnabled(), true)
		h.state.basemap = 'satellite'
		h.runtime.update()
		assert.equal(h.dragEnabled(), false)
		assert.equal(h.interactiveClasses.has('maplibregl-interactive'), false)
		h.state.basemap = 'hybrid'
		h.runtime.update()
		assert.equal(h.dragEnabled(), false)
		h.state.basemap = 'simple'
		h.runtime.update()
		assert.equal(h.dragEnabled(), true)
	}
	finally { h.runtime.dispose() }
})

test('changing track colors only repaints overlays and preserves camera and base paints', async () => {
	const h = await harness(false)
	try {
		await h.loaded()
		const backgrounds = h.paints.filter(paint => paint.id === 'background').length
		const cameras = h.cameras.length
		h.state.trackColor = 'clay'
		h.runtime.update()
		assert.equal(h.cameras.length, cameras)
		assert.equal(h.paints.filter(paint => paint.id === 'background').length, backgrounds)
	}
	finally { h.runtime.dispose() }
})

test('satellite photo navigation preserves automatic camera movement animation', async () => {
	const h = await harness(false, [], false, true)
	try {
		await h.loaded()
		h.state.basemap = 'satellite'
		h.state.node = 'photo-0'
		h.state.focusIndex = 0
		h.runtime.update()
		assert.equal(h.cameras.at(-1)?.duration, 650)
		h.state.node = 'photo-1'
		h.state.focusIndex = 1
		h.runtime.update()
		assert.equal(h.cameras.at(-1)?.duration, 650)
		h.state.viewer = true
		h.runtime.update()
		assert.equal(h.cameras.at(-1)?.duration, 280)
	}
	finally { h.runtime.dispose() }
})

test('late satellite response cannot overwrite a newer simple selection', async () => {
	let release!: (response: Response) => void
	const h = await harness(false, [], false, false, (() => new Promise<Response>((resolve) => {
		release = resolve
	})) as typeof fetch)
	try {
		await h.loaded()
		h.state.basemap = 'satellite'
		h.runtime.update()
		h.state.basemap = 'simple'
		h.runtime.update()
		release({ ok: true, json: async () => ({ version: 8, sources: {}, layers: [] }) } as Response)
		for (let i = 0; i < 10; i++) await Promise.resolve()
		assert.equal(h.swaps.length, 0, 'returning to the existing style must avoid a style reset')
		assert.equal(h.basemapEvents.length, 0)
	}
	finally { h.runtime.dispose() }
})

test('a basemap becomes visible when idle times out on a slow connection', async (context) => {
	context.mock.timers.enable({ apis: ['setTimeout'] })
	const h = await harness(false)
	try {
		await h.loaded()
		h.state.basemap = 'osm'
		h.runtime.update()
		for (let i = 0; i < 12; i++) await Promise.resolve()
		assert.equal(h.canvas.dataset.basemapLoading, 'true')
		context.mock.timers.tick(4500)
		for (let i = 0; i < 4; i++) await Promise.resolve()
		assert.equal(h.canvas.dataset.basemapLoading, 'false', 'slow tiles must not leave the whole map permanently transparent')
	}
	finally { h.runtime.dispose() }
})

test('satellite and simple style swaps retain photo overlays and current camera', async () => {
	const h = await harness(false, [], false, false, (async () => ({ ok: true, json: async () => ({ version: 8, sources: { imagery: { type: 'raster' } }, layers: [{ id: 'imagery', type: 'raster', source: 'imagery' }] }) })) as typeof fetch)
	try {
		await h.loaded()
		const cameras = h.cameras.length
		h.state.basemap = 'satellite'
		h.runtime.update()
		for (let i = 0; i < 12; i++) await Promise.resolve()
		assert.equal(h.basemapEvents.at(-1), 'satellite')
		assert.ok(h.swaps.at(-1).layers.some((layer: any) => layer.id === 'photo-points'))
		assert.equal(h.cameras.length, cameras)
		h.state.basemap = 'simple'
		h.runtime.update()
		for (let i = 0; i < 12; i++) await Promise.resolve()
		assert.equal(h.basemapEvents.at(-1), 'simple')
		assert.equal(h.cameras.length, cameras)
	}
	finally { h.runtime.dispose() }
})

test('OpenStreetMap Carto retains overlays, panning and automatic camera movement without a key', async () => {
	const h = await harness(false, [], false, true)
	try {
		await h.loaded()
		h.state.basemap = 'osm'
		h.runtime.update()
		for (let i = 0; i < 12; i++) await Promise.resolve()
		assert.equal(h.basemapEvents.at(-1), 'osm')
		assert.ok(h.swaps.at(-1).layers.some((layer: any) => layer.id === 'photo-points'))
		h.state.node = 'photo-0'
		h.state.focusIndex = 0
		h.runtime.update()
		assert.equal(h.cameras.at(-1)?.duration, 650)
		h.state.exploring = true
		h.runtime.explore('chapter-0')
		assert.equal(h.dragEnabled(), true)
		assert.ok(h.interactiveClasses.has('maplibregl-interactive'))
	}
	finally { h.runtime.dispose() }
})

for (const basemap of ['osm', 'satellite', 'hybrid']) {
	test(`${basemap} markers use light map colors in a dark journal and restore theme colors on the simple map`, async () => {
		const h = await harness(false, [], false, true, async () => ({ ok: true, json: async () => ({ version: 8, sources: {}, layers: [] }) }) as Response)
		try {
			await h.loaded()
			h.state.basemap = basemap
			h.runtime.update()
			for (let i = 0; i < 12; i++) await Promise.resolve()
			const paint = (id: string, key: string) => h.paints.findLast((item: any) => item.id === id && item.key === key)?.value
			const light = travelMapColors('mono', 'light')
			assert.equal(paint('photo-points', 'circle-color'), light.paper)
			assert.equal(paint('photo-current-ring', 'circle-stroke-color'), light.accent)
			assert.equal(paint('cover-points', 'circle-stroke-color'), light.muted)
			h.state.basemap = 'simple'
			h.runtime.update()
			for (let i = 0; i < 12; i++) await Promise.resolve()
			assert.equal(paint('photo-points', 'circle-color'), travelMapColors('mono', 'dark').paper)
		}
		finally { h.runtime.dispose() }
	})
}
