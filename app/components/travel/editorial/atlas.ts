import type { FeatureCollection, Point } from 'geojson'
import type { AllPaintProperties, ExpressionSpecification, GeoJSONSource, Map as MapLibreMap, NavigationControl, PaddingOptions, StyleSpecification } from 'maplibre-gl'
import type { TravelCoverMap, TravelTrack } from '../../../types/travel.ts'
import type { TravelBasemap, TravelTrackColor } from '../../../utils/travelMapSettings.ts'
import type { StoryPhoto } from '../../../utils/travelStory.ts'
import type { TravelPalette } from '../../../utils/travelTheme.ts'
import type { LocatedStoryPhoto } from './atlas-geometry.ts'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { getTravelMapLabelField } from '../../../utils/travelMapLocale.ts'
import { createTravelBasemapLoader, defaultTravelTrackColor, isSatelliteBasemap, travelMapInteractive, travelStyleAttribution, travelTrackColors } from '../../../utils/travelMapSettings.ts'
import { travelMotion, travelMotionEase } from '../../../utils/travelMotion.ts'
import { neutralTravelPaint, travelMapColors } from '../../../utils/travelTheme.ts'
import { atlasMobileBackdropPadding, atlasMobileCaptionWashTail, atlasMobileChapterRegion, atlasOverviewPoints, atlasPeekVisible, atlasSelection, atlasSnapshotEligible, atlasSnapshotsPaused, atlasVeil, atlasViewerPadding } from './atlas-geometry.ts'
import { atlasHasVisibleTracks, installAtlasTracks, paintAtlasTracks } from './atlas-tracks.ts'
import darkStyle from './map-styles/dark.json'
import lightStyle from './map-styles/light.json'
// This module is loaded by the editorial route only, including its CSS chunk.
import 'maplibre-gl/dist/maplibre-gl.css'

export interface TravelAtlasState {
	node: string
	focusIndex: number
	theme: 'light' | 'dark'
	palette: TravelPalette
	mobile: boolean
	exploring: boolean
	viewer: boolean
	viewerClosing: boolean
	reduced: boolean
	tracksVisible: boolean
	basemap: TravelBasemap
	trackColor: TravelTrackColor
}
export interface TravelAtlas {
	update: () => void
	resize: () => void
	project: (index: number) => { x: number, y: number } | undefined
	explore: (key: string, container?: HTMLElement, keepView?: boolean) => void
	restore: () => void
	dispose: () => void
}
interface AtlasOptions {
	root: HTMLElement
	scroller: HTMLElement
	canvas: HTMLElement
	mobileBackdrop?: HTMLElement
	photos: StoryPhoto[]
	tracks?: TravelTrack[]
	coverMap?: TravelCoverMap
	locale: string
	apiKey?: string
	onBasemap?: (basemap: TravelBasemap, attribution: string) => void
	onBasemapError?: () => void
	labels: { title: string, zoomIn: string, zoomOut: string, attribution: string, feedback: string }
	getState: () => TravelAtlasState
	onMove: () => void
	onFailure: () => void
}
interface SnapshotJob { key: string, image: HTMLImageElement, theme: string, generation: number, cacheKey: string, width: number, height: number, padding: Required<PaddingOptions>, backdrop: boolean }
const styles = { light: lightStyle as unknown as StyleSpecification, dark: darkStyle as unknown as StyleSpecification }
const sourceId = 'travel-photos'

function pointData(photos: LocatedStoryPhoto[]): FeatureCollection<Point> {
	return { type: 'FeatureCollection', features: photos.map(photo => ({
		type: 'Feature',
		geometry: { type: 'Point', coordinates: [photo.lng, photo.lat] },
		properties: { index: photo.index, chapter: photo.chapter },
	})) }
}

export async function createTravelAtlas(options: AtlasOptions): Promise<TravelAtlas> {
	const { root, scroller, canvas, mobileBackdrop, photos, tracks, coverMap, locale, labels, getState, onMove, onFailure } = options
	let disposed = false
	let ready = false
	let failureReported = false
	let map: MapLibreMap | undefined
	let snapshotMap: MapLibreMap | undefined
	let renderer: HTMLElement | undefined
	let snapshotLoading: Promise<boolean> | undefined
	let snapshotBusy = false
	let snapshotBroken = false
	let snapshotGeneration = 0
	let snapshotQueue: SnapshotJob[] = []
	const snapshotCache = new Map<string, string>()
	const observed = new Map<HTMLElement, IntersectionObserver>()
	const near = new Set<HTMLElement>()
	const pending = new Set<() => void>()
	let observer: IntersectionObserver | undefined
	let viewportObserver: IntersectionObserver | undefined
	let domObserver: MutationObserver | undefined
	let resizeObserver: ResizeObserver | undefined
	let resizeFrame = 0
	let navigation: NavigationControl | undefined
	let navigationAdded = false
	let explorationKey: string | undefined
	let keepExplorationView = false
	let explorationTracksVisible = false
	let cameraKey = ''
	let cameraMode = 'reading'
	let basemapKey = ''
	let appearanceKey = ''
	let previousMobile = getState().mobile
	let snapshotWidth = root.clientWidth
	const home = canvas.parentElement!
	const nextSibling = canvas.nextSibling
	let maplibre: typeof import('maplibre-gl')
	let mobileCameraInitialized = false
	let deferredResize = false
	const loadBasemap = createTravelBasemapLoader(options.apiKey ?? '', locale)
	let activeBasemap: TravelBasemap = 'simple'
	let requestedBasemap: TravelBasemap = 'simple'
	let snapshotBasemap: TravelBasemap = 'simple'
	let basemapRequest = 0
	let styleMatchesActive = true

	function mapColors() {
		const state = getState()
		return { ...travelMapColors(state.palette, state.basemap === 'simple' ? state.theme : 'light'), track: travelTrackColors[state.trackColor ?? defaultTravelTrackColor][isSatelliteBasemap(state.basemap) ? 'dark' : state.basemap !== 'simple' ? 'light' : state.theme] }
	}
	function withOverlays(target: MapLibreMap, style: StyleSpecification): StyleSpecification {
		const current = target.getStyle()
		const overlays = current.layers.filter(layer => 'source' in layer && ['travel-photos', 'travel-tracks', 'snapshot-position'].includes(String(layer.source)))
		const sources = Object.fromEntries(Object.entries(current.sources).filter(([key]) => ['travel-photos', 'travel-tracks', 'snapshot-position'].includes(key)))
		const base = structuredClone(style)
		return { ...base, sources: { ...base.sources, ...sources }, layers: [...base.layers, ...overlays] }
	}
	async function applyBasemap(target: MapLibreMap, basemap: TravelBasemap) {
		const style = basemap === 'simple' ? styles[getState().theme] : await loadBasemap(basemap)
		if (disposed)
			return false
		const loaded = waitFor(target, 'style.load', 15000)
		target.setStyle(withOverlays(target, style), { diff: true })
		return loaded
	}
	function syncBasemap() {
		if (!map)
			return
		const desired = getState().basemap ?? 'simple'
		if (!ready && basemapRequest === 0)
			return
		if (desired === requestedBasemap)
			return
		requestedBasemap = desired
		const request = ++basemapRequest
		if (desired === activeBasemap && ready && styleMatchesActive)
			return
		void (async () => {
			try {
				const style = desired === 'simple' ? styles[getState().theme] : await loadBasemap(desired)
				if (disposed || request !== basemapRequest || !map)
					return
				ready = false
				styleMatchesActive = false
				canvas.dataset.basemapLoading = 'true'
				const loaded = waitFor(map, 'style.load', 15000)
				map.setStyle(withOverlays(map, style), { diff: true })
				if (!await loaded)
					throw new Error('Basemap style timed out')
				if (disposed || request !== basemapRequest)
					return
				activeBasemap = desired
				styleMatchesActive = true
				ready = true
				if (desired === 'simple')
					localize(map)
				options.onBasemap?.(desired, travelStyleAttribution(style))
				paintBasemap(map)
				paintPoints()
				// Keep the current camera, including an explored position.
				update()
				const settled = await waitFor(map, 'idle', 4500)
				if (settled && !disposed && request === basemapRequest)
					canvas.dataset.basemapLoading = 'false'
			}
			catch {
				if (disposed || request !== basemapRequest)
					return
				ready = true
				canvas.dataset.basemapLoading = 'false'
				options.onBasemapError?.()
			}
		})()
	}

	function mobileReading() {
		const state = getState()
		return Boolean(mobileBackdrop && state.mobile && !state.exploring && explorationKey === undefined)
	}
	function placeCanvas() {
		const target = mobileReading() ? mobileBackdrop! : home
		if (explorationKey !== undefined || canvas.parentElement === target)
			return
		if (target === home)
			home.insertBefore(canvas, nextSibling?.parentNode === home ? nextSibling : null)
		else
			target.append(canvas)
		map?.setPixelRatio(mobileReading() ? Math.min(window.devicePixelRatio, 1.5) : window.devicePixelRatio)
		map?.resize()
		cameraKey = ''
	}

	function failure() {
		if (disposed || failureReported)
			return
		failureReported = true
		onFailure()
	}
	function themeKey() {
		const state = getState()
		return `${state.theme}:${state.palette}:${state.tracksVisible}:${state.trackColor ?? defaultTravelTrackColor}:${state.basemap ?? 'simple'}`
	}
	function liveMapVisible() {
		const state = getState()
		return !state.mobile || state.exploring || explorationKey !== undefined || (mobileReading() && Boolean(mobileMapKey()))
	}
	/** Every wait is cancellable; removing a map cannot strand its snapshot queue. */
	function waitFor(target: MapLibreMap, event: 'load' | 'idle' | 'style.load', timeout: number): Promise<boolean> {
		return new Promise((resolve) => {
			let timer: ReturnType<typeof setTimeout>
			const finish = (success: boolean) => {
				clearTimeout(timer)
				target.off(event, settled)
				pending.delete(cancel)
				resolve(success && !disposed)
			}
			function settled() {
				finish(true)
			}
			function cancel() {
				finish(false)
			}
			pending.add(cancel)
			target.once(event, settled)
			timer = setTimeout(finish, timeout, event === 'idle')
		})
	}
	function localize(target: MapLibreMap) {
		for (const layer of target.getStyle().layers) {
			if (layer.type === 'symbol' && layer.layout?.['text-field'] && JSON.stringify(layer.layout['text-field']).includes('name'))
				target.setLayoutProperty(layer.id, 'text-field', getTravelMapLabelField(locale))
		}
	}
	/** Only known basemap layers own these paints; selection expressions stay untouched. */
	function paintBasemap(target: MapLibreMap, snapshot = false) {
		if ((target === map ? activeBasemap : snapshotBasemap) !== 'simple')
			return
		const state = getState()
		const other = new Map(styles[state.theme === 'dark' ? 'light' : 'dark'].layers.map(layer => [layer.id, layer]))
		const factor = snapshot || mobileReading() ? 1 : state.exploring || explorationKey !== undefined ? 1 : state.theme === 'dark' ? 0.45 : 0.55
		for (const layer of styles[state.theme].layers) {
			if (!target.getLayer(layer.id))
				continue
			const paint = layer.paint as Record<string, unknown> | undefined
			const previous = other.get(layer.id)?.paint
			for (const property of new Set([...Object.keys(paint ?? {}), ...Object.keys(previous ?? {})])) {
				const value = paint?.[property] ?? null
				target.setPaintProperty(layer.id, property as keyof AllPaintProperties, (state.palette === 'mono' ? neutralTravelPaint(value) : value) as AllPaintProperties[keyof AllPaintProperties])
			}
			if (layer.type === 'symbol') {
				const opacity = paint?.['text-opacity'] ?? 1
				target.setPaintProperty(layer.id, 'text-opacity', typeof opacity === 'number' ? opacity * factor : ['*', opacity as ExpressionSpecification, factor])
			}
		}
		if (state.palette === 'mono' && target.getLayer('background'))
			target.setPaintProperty('background', 'background-color', travelMapColors(state.palette, state.theme).paper)
	}
	function select(node: string, focusIndex = -1) {
		return atlasSelection(photos, node, focusIndex, coverMap)
	}
	function selection() {
		const state = getState()
		return select(explorationKey ?? state.node, explorationKey === undefined ? state.focusIndex : -1)
	}
	function installPoints(target: MapLibreMap) {
		target.addSource(sourceId, { type: 'geojson', data: pointData(atlasSelection(photos, 'intro').points) })
		const layers = [
			{ id: 'photo-halo', paint: { 'circle-color': '#a4513e', 'circle-radius': 19, 'circle-opacity': 0 } },
			{ id: 'photo-points', paint: { 'circle-color': '#fff', 'circle-radius': 5, 'circle-stroke-color': '#a4513e', 'circle-stroke-width': 1 } },
			{ id: 'photo-centers', paint: { 'circle-color': '#a4513e', 'circle-radius': 1.8 } },
			{ id: 'photo-current-ring', paint: { 'circle-color': '#fff', 'circle-radius': 10, 'circle-stroke-color': '#a4513e', 'circle-stroke-width': 1.5 } },
			{ id: 'photo-current-center', paint: { 'circle-color': '#a4513e', 'circle-radius': 4 } },
			{ id: 'cover-points', paint: { 'circle-color': '#fff', 'circle-radius': 3.8, 'circle-stroke-color': '#a4513e', 'circle-stroke-width': 1.1 } },
			{ id: 'cover-centers', paint: { 'circle-color': '#a4513e', 'circle-radius': 1.2 } },
		] as const
		for (const layer of layers)
			target.addLayer({ ...layer, type: 'circle', source: sourceId })
	}
	function paintPoints() {
		if (!map || !ready)
			return
		const scope = selection()
		const { points, chapter, selected } = scope
		const index = selected?.index ?? -1
		const colors = mapColors()
		const showPoints = Boolean(selected) || !atlasHasVisibleTracks(scope, tracks, getState().tracksVisible)
		paintAtlasTracks(map, scope, colors, getState().tracksVisible)
		const active: ExpressionSpecification = ['==', ['get', 'index'], index]
		for (const id of ['photo-halo', 'photo-points', 'photo-centers']) {
			map.setFilter(id, chapter >= 0 ? ['in', ['get', 'index'], ['literal', points.map(photo => photo.index)]] : null)
			map.setLayoutProperty(id, 'visibility', chapter >= 0 && showPoints ? 'visible' : 'none')
		}
		for (const id of ['cover-points', 'cover-centers'])
			map.setLayoutProperty(id, 'visibility', chapter < 0 && showPoints ? 'visible' : 'none')
		for (const id of ['photo-current-ring', 'photo-current-center']) {
			map.setFilter(id, ['==', ['get', 'index'], index])
			map.setLayoutProperty(id, 'visibility', index >= 0 ? 'visible' : 'none')
		}
		for (const id of ['photo-current-ring', 'photo-points', 'cover-points']) {
			map.setPaintProperty(id, 'circle-color', colors.paper)
			map.setPaintProperty(id, 'circle-stroke-color', colors.accent)
		}
		for (const id of ['photo-current-center', 'photo-halo', 'cover-centers'])
			map.setPaintProperty(id, 'circle-color', colors.accent)
		map.setPaintProperty('cover-centers', 'circle-radius', 1.4)
		map.setPaintProperty('photo-halo', 'circle-opacity', ['case', active, 0.09, 0])
		map.setPaintProperty('photo-points', 'circle-radius', index >= 0 ? ['case', active, 10, 5] : 5.5)
		map.setPaintProperty('photo-points', 'circle-stroke-color', index >= 0 ? ['case', active, colors.accent, colors.muted] : colors.accent)
		map.setPaintProperty('photo-points', 'circle-stroke-width', ['case', active, 1.5, 1])
		map.setPaintProperty('photo-centers', 'circle-color', colors.accent)
		map.setPaintProperty('photo-centers', 'circle-radius', index >= 0 ? ['case', active, 4, 0] : 2)
	}
	function padding(): Required<PaddingOptions> {
		if (!map)
			return { top: 25, bottom: 35, left: 20, right: 20 }
		const state = getState()
		if (state.mobile) {
			const key = mobileMapKey()
			const peek = [...observed.keys()].find(peek => peek.classList.contains('reading-map') && peek.dataset.mapImage === key)
			return peek ? snapshotFrame(peek).padding : { top: 25, bottom: 35, left: 20, right: 20 }
		}
		const width = canvas.clientWidth
		if (state.viewer && !state.exploring && explorationKey === undefined) {
			const stage = root.querySelector<HTMLElement>('dialog.viewer[open] .lightbox-stage')
			const photo = root.querySelector<HTMLElement>('dialog.viewer[open] .lightbox-photo')
			const notes = root.querySelector<HTMLElement>('dialog.viewer[open] .lightbox-info')
			if (stage && photo) {
				const origin = canvas.getBoundingClientRect()
				const box = stage.getBoundingClientRect()
				// Layout dimensions stay stable while the photo morphs, zooms or pans.
				const photoRight = box.left - origin.left + (box.width + photo.offsetWidth) / 2
				const caption = notes?.getBoundingClientRect()
				return atlasViewerPadding({ width, height: canvas.clientHeight }, photoRight, caption && { left: caption.left - origin.left, right: caption.right - origin.left, top: caption.top - origin.top, bottom: caption.bottom - origin.top })
			}
		}
		let left = 260
		if (!state.exploring && explorationKey === undefined) {
			const content = root.querySelector<HTMLElement>('.story-content')
			if (content) {
				const origin = canvas.getBoundingClientRect().left
				const gutter = Number.parseFloat(getComputedStyle(content).paddingRight) || 0
				const readingRight = content.getBoundingClientRect().right - origin - gutter
				const { selected, chapter } = selection()
				const node = root.querySelector<HTMLElement>(`[data-node="${selected ? `photo-${selected.index}` : chapter >= 0 ? `chapter-${chapter}` : 'intro'}"]`)
				const image = node?.querySelector('.photo-open img, .cover-image img')
				const prose = node?.querySelector('figcaption, .chapter-head, .cover')
				let contentRight = image ? image.getBoundingClientRect().right - origin : 0
				if (prose) {
					const walker = root.ownerDocument.createTreeWalker(prose, NodeFilter.SHOW_TEXT)
					const range = root.ownerDocument.createRange()
					while (walker.nextNode()) {
						if (!walker.currentNode.textContent?.trim())
							continue
						range.selectNodeContents(walker.currentNode)
						for (const rect of range.getClientRects())
							contentRight = Math.max(contentRight, rect.right - origin)
					}
				}
				const veil = atlasVeil(contentRight, readingRight)
				root.querySelector<HTMLElement>('.map-cover')?.style.setProperty('--travel-map-fade-start', `${veil.start}px`)
				left = veil.end
			}
		}
		// fitBounds must retain a positive exposed viewport even during layout changes.
		return { top: Math.min(100, canvas.clientHeight / 4), bottom: Math.min(70, canvas.clientHeight / 4), left: Math.round(Math.max(0, Math.min(left, width - 100))), right: Math.min(40, width / 4) }
	}
	function fitPoints(target: MapLibreMap, points: { lng: number, lat: number }[], pad: PaddingOptions, duration: number, maxZoom = 15) {
		if (!points.length)
			return
		const bounds = new maplibre.LngLatBounds()
		for (const photo of points)
			bounds.extend([photo.lng, photo.lat])
		target.fitBounds(bounds, { padding: pad, maxZoom, duration, easing: travelMotionEase })
	}
	function photoZoom(target: MapLibreMap, points: LocatedStoryPhoto[], pad: PaddingOptions, mobile: boolean, selected: LocatedStoryPhoto) {
		const baseline = mobile ? 12.8 : 14.3
		const bounds = new maplibre.LngLatBounds()
		for (const photo of points)
			bounds.extend([photo.lng, photo.lat])
		const overviewZoom = points.length ? target.cameraForBounds(bounds, { padding: pad, maxZoom: 15 })?.zoom : undefined
		// A compact city overview can already be closer than the old fixed photo zoom.
		const zoom = overviewZoom === undefined ? baseline : Math.max(baseline, Math.min(16, overviewZoom + 1))
		const offset = Number.isFinite(selected.mapZoomOffset) ? selected.mapZoomOffset! : 0
		return Math.max(0, Math.min(16, zoom + offset))
	}
	function camera(force = false) {
		if (!map || !ready || !liveMapVisible() || (mobileReading() && snapshotsPaused()) || !canvas.clientWidth || !canvas.clientHeight)
			return
		const state = getState()
		const scope = selection()
		const { points, selected, overview } = scope
		const exploring = state.exploring || explorationKey !== undefined
		const pad = padding()
		const overviewTracks = (!selected || overview) && (Boolean(scope.coverMap?.tracks) || state.tracksVisible)
		const key = `${explorationKey ?? state.node}:${state.focusIndex}:${state.mobile}:${exploring}:${state.viewer}:${overviewTracks}:${JSON.stringify(pad)}`
		if (!force && key === cameraKey)
			return
		cameraKey = key
		const mode = state.viewer ? 'viewer' : exploring ? 'exploring' : 'reading'
		const switchingMode = mode !== cameraMode || state.viewerClosing
		cameraMode = mode
		if (keepExplorationView) {
			const tracksChanged = overviewTracks !== explorationTracksVisible
			explorationTracksVisible = overviewTracks
			// Retain manual panning too; only an explicit overview route toggle reframes it.
			if (!tracksChanged)
				return
		}
		const duration = state.reduced || (state.mobile && !mobileCameraInitialized) ? 0 : state.viewer || switchingMode ? travelMotion.duration.mode : travelMotion.duration.map
		if (state.mobile)
			mobileCameraInitialized = true
		if (selected && !overview && (!exploring || state.mobile)) {
			map.easeTo({ center: [selected.lng, selected.lat], zoom: photoZoom(map, points, pad, state.mobile, selected), padding: { top: 0, bottom: 0, left: 0, right: 0 }, offset: [(pad.left - pad.right) / 2, (pad.top - pad.bottom) / 2], duration, easing: travelMotionEase })
		}
		else {
			fitPoints(map, atlasOverviewPoints(scope, tracks, overviewTracks), pad, duration, overview ? 8 : 15)
		}
	}
	function interaction() {
		if (!map)
			return
		const enabled = getState().exploring || explorationKey !== undefined
		const draggable = travelMapInteractive(getState().basemap ?? 'simple', enabled)
		for (const handler of [map.dragPan, map.dragRotate])
			draggable ? handler.enable() : handler.disable()
		for (const handler of [map.doubleClickZoom, map.scrollZoom, map.touchZoomRotate, map.touchPitch, map.keyboard, map.boxZoom])
			enabled ? handler.enable() : handler.disable()
		map.getCanvasContainer().classList.toggle('maplibregl-interactive', draggable)
		map.getCanvas().tabIndex = -1
		if (enabled && !navigationAdded) {
			navigation ??= new maplibre.NavigationControl({ showCompass: false })
			map.addControl(navigation, getState().mobile ? 'top-right' : 'bottom-right')
			navigationAdded = true
		}
		else if (!enabled && navigationAdded && navigation) {
			map.removeControl(navigation)
			navigationAdded = false
		}
	}
	function peekObserver(peek: HTMLElement) {
		return observed.get(peek) ?? (scroller.contains(peek) ? observer : viewportObserver)
	}
	function visibleDialogPeek(peek: HTMLElement) {
		const dialog = peek.closest<HTMLDialogElement>('dialog.viewer')
		return Boolean(dialog && atlasPeekVisible(peek.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight }, dialog.open))
	}
	function snapshotEligible(peek: HTMLElement) {
		return atlasSnapshotEligible(getState().mobile, Boolean(peek.closest('dialog.viewer')), visibleDialogPeek(peek))
	}
	function snapshotsEnabled() {
		return (!mobileBackdrop && getState().mobile) || [...root.querySelectorAll<HTMLElement>('dialog.viewer[open] .map-peek[data-map-image]')].some(visibleDialogPeek)
	}
	function snapshotsPaused() {
		return atlasSnapshotsPaused(getState().mobile, scroller.dataset.snapState)
	}
	function observePeeks() {
		if (!observer || disposed)
			return
		for (const peek of root.querySelectorAll<HTMLElement>('.map-peek[data-map-image]')) {
			if (!observed.has(peek)) {
				const targetObserver = peekObserver(peek)
				if (targetObserver) {
					observed.set(peek, targetObserver)
					targetObserver.observe(peek)
					resizeObserver?.observe(peek)
					const foreground = peek.closest('.reading-stage')?.querySelector<HTMLElement>('.cover, .chapter-head, .story-photo')
					if (foreground)
						resizeObserver?.observe(foreground)
				}
			}
			// A reused viewer image may change map key without changing intersection.
			if (visibleDialogPeek(peek))
				queueSnapshot(peek)
		}
		for (const peek of observed.keys()) {
			if (!root.contains(peek)) {
				peekObserver(peek)?.unobserve(peek)
				resizeObserver?.unobserve(peek)
				observed.delete(peek)
				near.delete(peek)
			}
		}
	}
	function mobileMapKey() {
		const state = getState()
		if (!state.mobile || state.node === 'intro')
			return undefined
		const selection = atlasSelection(photos, state.node)
		return state.node.startsWith('photo-') && !selection.selected && selection.chapter >= 0 ? `chapter-${selection.chapter}` : state.node
	}
	function updateMobileBackdrop() {
		if (!mobileBackdrop)
			return
		const key = mobileMapKey()
		mobileBackdrop.dataset.visible = String(Boolean(key))
		if (mobileReading() && snapshotsPaused()) {
			map?.stop()
			cameraKey = ''
			return
		}
		if (key) {
			mobileBackdrop.dataset.mapKey = key
			if (deferredResize) {
				deferredResize = false
				resize()
			}
		}
	}
	function snapshotFrame(peek: HTMLElement) {
		const backdrop = peek.classList.contains('reading-map')
		const width = (backdrop && mobileBackdrop?.clientWidth) || peek.clientWidth || 335
		const height = (backdrop && mobileBackdrop?.clientHeight) || peek.clientHeight || 200
		let padding: Required<PaddingOptions> = { top: 18, bottom: 30, left: 18, right: 18 }
		if (backdrop) {
			const box = peek.getBoundingClientRect()
			const stage = peek.parentElement!
			const heading = stage.querySelector<HTMLElement>('.photo-place')?.getBoundingClientRect()
			const summary = stage.querySelector<HTMLElement>('.chapter-summary')?.getBoundingClientRect()
			const top = heading ? heading.top - box.top - 8 : height * 0.55
			const bottom = heading ? heading.bottom - box.top + 8 : top + 180
			const region = !heading && summary
				? atlasMobileChapterRegion({ width, height }, { top: summary.top - box.top, bottom: summary.bottom - box.top })
				: { left: heading ? width * 0.54 : 20, right: width - 20, top: Math.max(0, top), bottom: Math.min(height - 16, bottom) }
			peek.style.setProperty('--map-clear-top', `${region.top}px`)
			peek.style.setProperty('--map-clear-bottom', `${region.bottom}px`)
			const description = stage.querySelector<HTMLElement>('.photo-caption')?.getBoundingClientRect()
			if (description) {
				const start = `${Math.max(0, description.top - box.top)}px`
				peek.style.setProperty('--map-description-start', start)
				stage.style.setProperty('--map-description-start', start)
				stage.style.setProperty('--map-wash-tail', `${atlasMobileCaptionWashTail(box.height, description.bottom - box.top)}px`)
			}
			padding = atlasMobileBackdropPadding({ width, height }, region)
		}
		return { width, height, padding, backdrop }
	}
	function queueSnapshot(peek: HTMLElement) {
		const key = peek.dataset.mapImage
		const image = peek.querySelector('img')
		if (mobileBackdrop && peek.classList.contains('reading-map')) {
			if (getState().mobile && !snapshotsPaused())
				snapshotFrame(peek)
			return
		}
		if (disposed || !snapshotEligible(peek) || snapshotBroken || !key || !image)
			return
		const scope = select(key)
		if (!scope.points.length && !atlasOverviewPoints(scope, tracks, getState().tracksVisible).length)
			return
		const theme = themeKey()
		const frame = snapshotFrame(peek)
		const desired = `${theme}:${key}:${frame.width}:${frame.height}:${JSON.stringify(frame.padding)}`
		if (image.dataset.atlasSnapshot !== desired) {
			image.dataset.atlasSnapshot = desired
			image.classList.remove('ready')
			image.removeAttribute('src')
			if (frame.backdrop)
				peek.style.removeProperty('background-image')
		}
		const cached = snapshotCache.get(desired)
		if (cached) {
			paintSnapshot(image, cached)
			return
		}
		if (!snapshotQueue.some(item => item.image === image && item.cacheKey === desired))
			snapshotQueue.push({ key, image, theme, generation: snapshotGeneration, cacheKey: desired, ...frame })
		void pumpSnapshots()
	}
	function paintSnapshot(image: HTMLImageElement, data: string) {
		image.src = data
		image.classList.add('ready')
		const peek = image.parentElement
		if (peek?.classList.contains('reading-map') && !mobileBackdrop)
			peek.style.backgroundImage = `url("${data}")`
		updateMobileBackdrop()
	}
	async function startSnapshots(): Promise<boolean> {
		if (disposed || !snapshotsEnabled() || snapshotBroken)
			return false
		if (snapshotLoading)
			return snapshotLoading
		snapshotLoading = (async () => {
			try {
				renderer = document.createElement('div')
				renderer.className = 'snapshot-renderer'
				renderer.setAttribute('aria-hidden', 'true')
				Object.assign(renderer.style, { position: 'absolute', left: '-10000px', top: '0', width: '210px', height: '158px', pointerEvents: 'none' })
				root.append(renderer)
				snapshotMap = new maplibre.Map({ container: renderer, style: structuredClone(styles[getState().theme]), interactive: false, attributionControl: false, center: [0, 0], zoom: 0, canvasContextAttributes: { preserveDrawingBuffer: true }, fadeDuration: 0 })
				if (!await waitFor(snapshotMap, 'load', 15000) || disposed)
					return false
				localize(snapshotMap)
				installAtlasTracks(snapshotMap, tracks)
				snapshotMap.addSource('snapshot-position', { type: 'geojson', data: pointData([]) })
				snapshotMap.addLayer({ id: 'snapshot-pin', type: 'circle', source: 'snapshot-position', paint: { 'circle-radius': 9, 'circle-color': '#fff', 'circle-stroke-color': '#a4513e', 'circle-stroke-width': 1.2 } })
				snapshotMap.addLayer({ id: 'snapshot-center', type: 'circle', source: 'snapshot-position', paint: { 'circle-radius': 3, 'circle-color': '#a4513e' } })
				return true
			}
			catch (error) {
				if (!disposed)
					console.warn('[travel] Inline map snapshots unavailable', error)
				return false
			}
		})()
		return snapshotLoading
	}
	function snapshotRelevant(item: SnapshotJob) {
		const peek = item.image.closest<HTMLElement>('.map-peek')
		return root.contains(item.image) && item.image.dataset.atlasSnapshot === item.cacheKey && peek?.dataset.mapImage === item.key && snapshotEligible(peek)
	}
	async function pumpSnapshots() {
		if (disposed || snapshotBusy || snapshotBroken || !snapshotQueue.length || !snapshotsEnabled() || snapshotsPaused())
			return
		snapshotBusy = true
		try {
			if (!await startSnapshots() || !snapshotMap || !renderer) {
				if (disposed || !snapshotsEnabled() || snapshotsPaused())
					return
				snapshotBroken = true
				snapshotQueue = []
				return
			}
			while (snapshotQueue.length) {
				if (disposed || !snapshotsEnabled() || snapshotsPaused())
					break
				const item = snapshotQueue.shift()!
				if (item.generation !== snapshotGeneration || item.theme !== themeKey() || !snapshotRelevant(item))
					continue
				const cached = snapshotCache.get(item.cacheKey)
				if (cached) {
					paintSnapshot(item.image, cached)
					continue
				}
				const scope = select(item.key)
				const { points, selected, overview } = scope
				const chapter = item.key.startsWith('chapter-')
				const intro = item.key === 'intro'
				const list = points
				const boundsPoints = atlasOverviewPoints(scope, tracks, (!selected || overview) && getState().tracksVisible)
				if (!boundsPoints.length)
					continue
				const { width, height } = item
				renderer.style.width = `${width}px`
				renderer.style.height = `${height}px`
				snapshotMap.resize()
				const positionSnapshot = () => {
					// Reset photo padding so each page receives exactly one inset.
					snapshotMap!.setPadding({ top: 0, bottom: 0, left: 0, right: 0 })
					if (item.backdrop && selected && !overview)
						snapshotMap!.jumpTo({ center: [selected.lng, selected.lat], zoom: photoZoom(snapshotMap!, list, item.padding, true, selected), padding: item.padding })
					else
						fitPoints(snapshotMap!, boundsPoints, item.backdrop ? item.padding : chapter ? { top: 20, bottom: 45, left: 20, right: 20 } : item.padding, 0, overview ? 8 : selected ? 12.8 : 15)
				}
				const desiredBasemap = getState().basemap ?? 'simple'
				// Activate OSM only at the visible preview's camera, avoiding offscreen tile requests.
				if (desiredBasemap === 'osm' && snapshotBasemap !== desiredBasemap)
					positionSnapshot()
				if (snapshotBasemap !== desiredBasemap) {
					if (!await applyBasemap(snapshotMap, desiredBasemap) || disposed)
						continue
					snapshotBasemap = desiredBasemap
					if (item.generation !== snapshotGeneration || item.theme !== themeKey())
						continue
				}
				paintBasemap(snapshotMap, true)
				const colors = mapColors()
				paintAtlasTracks(snapshotMap, scope, colors, getState().tracksVisible)
				const showPoints = Boolean(selected) || !atlasHasVisibleTracks(scope, tracks, getState().tracksVisible)
				for (const id of ['snapshot-pin', 'snapshot-center'])
					snapshotMap.setLayoutProperty(id, 'visibility', showPoints ? 'visible' : 'none')
				snapshotMap.setPaintProperty('snapshot-pin', 'circle-color', colors.paper)
				const active: ExpressionSpecification = ['==', ['get', 'index'], selected?.index ?? -1]
				snapshotMap.setPaintProperty('snapshot-pin', 'circle-radius', selected ? ['case', active, 8, 3.8] : intro ? 3 : 5.5)
				snapshotMap.setPaintProperty('snapshot-pin', 'circle-stroke-color', selected ? ['case', active, colors.accent, colors.muted] : colors.accent)
				snapshotMap.setPaintProperty('snapshot-center', 'circle-radius', selected ? ['case', active, 3, 0] : intro ? 1.4 : 2)
				snapshotMap.setPaintProperty('snapshot-center', 'circle-color', colors.accent)
				;(snapshotMap.getSource('snapshot-position') as GeoJSONSource).setData(pointData(list))
				const settled = waitFor(snapshotMap, 'idle', 4500)
				positionSnapshot()
				if (!await settled || disposed || item.generation !== snapshotGeneration || item.theme !== themeKey() || !snapshotsEnabled() || !snapshotRelevant(item))
					continue
				if (snapshotsPaused()) {
					snapshotQueue.unshift(item)
					break
				}
				const data = snapshotMap.getCanvas().toDataURL('image/png')
				snapshotCache.set(item.cacheKey, data)
				paintSnapshot(item.image, data)
			}
		}
		catch (error) {
			if (!disposed)
				console.warn('[travel] Inline map snapshot unavailable', error)
		}
		finally {
			snapshotBusy = false
			if (!disposed && snapshotQueue.length && snapshotsEnabled() && !snapshotBroken)
				void pumpSnapshots()
		}
	}
	function refreshSnapshots(clearCache = true) {
		snapshotGeneration++
		snapshotQueue = []
		if (clearCache)
			snapshotCache.clear()
		for (const peek of observed.keys()) {
			const image = peek.querySelector('img')
			image?.classList.remove('ready')
			image?.removeAttribute('src')
			if (peek.classList.contains('reading-map'))
				peek.style.removeProperty('background-image')
		}
		for (const peek of observed.keys()) {
			if (near.has(peek) || visibleDialogPeek(peek))
				queueSnapshot(peek)
		}
	}
	function startLiveMap() {
		if (map || !maplibre || disposed || failureReported || !liveMapVisible() || (mobileReading() && snapshotsPaused()))
			return
		try {
			placeCanvas()
			map = new maplibre.Map({
				container: canvas,
				pixelRatio: mobileReading() ? Math.min(window.devicePixelRatio, 1.5) : undefined,
				style: structuredClone(styles[getState().theme]),
				center: [0, 0],
				zoom: 0,
				dragPan: false,
				dragRotate: false,
				scrollZoom: false,
				doubleClickZoom: false,
				touchZoomRotate: false,
				touchPitch: false,
				keyboard: false,
				boxZoom: false,
				attributionControl: false,
				locale: { 'Map.Title': labels.title, 'NavigationControl.ZoomIn': labels.zoomIn, 'NavigationControl.ZoomOut': labels.zoomOut, 'AttributionControl.ToggleAttribution': labels.attribution, 'AttributionControl.MapFeedback': labels.feedback },
				fadeDuration: 0,
			})
			map.on('move', onMove)
			map.on('webglcontextlost', failure)
			map.getCanvasContainer().classList.remove('maplibregl-interactive')
			map.getCanvas().tabIndex = -1
			void waitFor(map, 'load', 15000).then((loaded) => {
				if (disposed)
					return
				if (!loaded || !map) {
					failure()
					return
				}
				try {
					localize(map)
					installAtlasTracks(map, tracks)
					installPoints(map)
					ready = true
					paintBasemap(map)
					update()
					if (mobileBackdrop) {
						map.once('idle', () => {
							if (!disposed)
								mobileBackdrop.dataset.ready = 'true'
						})
					}
					onMove()
				}
				catch (error) {
					console.warn('[travel] Map unavailable', error)
					failure()
				}
			})
		}
		catch (error) {
			console.warn('[travel] Map initialization unavailable', error)
			failure()
		}
	}
	function update() {
		if (disposed)
			return
		placeCanvas()
		startLiveMap()
		observePeeks()
		updateMobileBackdrop()
		const state = getState()
		interaction()
		syncBasemap()
		const basemapAppearance = `${state.theme}:${state.palette}:${state.exploring || explorationKey !== undefined}:${state.mobile}`
		if (basemapAppearance !== basemapKey) {
			basemapKey = basemapAppearance
			if (ready && map)
				paintBasemap(map)
		}
		const appearance = themeKey()
		if (appearance !== appearanceKey) {
			const changedTheme = appearance.split(':').slice(0, 2).join(':') !== appearanceKey.split(':').slice(0, 2).join(':')
			appearanceKey = appearance
			// Visibility is part of the PNG key; keep both states for instant return toggles.
			refreshSnapshots(changedTheme)
		}
		if (previousMobile !== state.mobile) {
			previousMobile = state.mobile
			snapshotGeneration++
			snapshotQueue = []
			for (const peek of observed.keys()) {
				peekObserver(peek)?.unobserve(peek)
				peekObserver(peek)?.observe(peek)
			}
			for (const peek of observed.keys()) {
				if (near.has(peek) || visibleDialogPeek(peek))
					queueSnapshot(peek)
			}
		}
		if (ready && liveMapVisible() && !(mobileReading() && snapshotsPaused())) {
			interaction()
			paintPoints()
			camera()
		}
	}
	function resize() {
		if (disposed)
			return
		if (mobileReading() && snapshotsPaused()) {
			deferredResize = true
			return
		}
		if (snapshotWidth !== root.clientWidth) {
			snapshotWidth = root.clientWidth
			if (getState().mobile)
				refreshSnapshots()
		}
		if (liveMapVisible())
			map?.resize()
		const previousCameraKey = cameraKey
		update()
		for (const peek of near) {
			if (root.contains(peek))
				queueSnapshot(peek)
		}
		// update() may already have started a mode transition; don't restart it.
		if (cameraKey === previousCameraKey)
			camera(true)
		onMove()
	}
	function restore() {
		if (disposed)
			return
		explorationKey = undefined
		keepExplorationView = false
		if (canvas.parentElement !== home)
			home.insertBefore(canvas, nextSibling?.parentNode === home ? nextSibling : null)
		cameraKey = ''
		resize()
	}
	const atlas: TravelAtlas = {
		update,
		resize,
		project(index) {
			if (disposed || !ready || !map)
				return
			const photo = atlasSelection(photos, `photo-${index}`).selected
			if (!photo)
				return
			const point = map.project([photo.lng, photo.lat])
			const box = canvas.getBoundingClientRect()
			return { x: point.x + box.left, y: point.y + box.top }
		},
		explore(key, container, keepView = false) {
			if (disposed)
				return
			keepExplorationView = Boolean(keepView && map && cameraKey && !container && !getState().mobile)
			explorationKey = key
			if (keepExplorationView) {
				map!.stop()
				const scope = selection()
				explorationTracksVisible = (!scope.selected || scope.overview) && (Boolean(scope.coverMap?.tracks) || getState().tracksVisible)
			}
			if (container)
				container.append(canvas)
			cameraKey = ''
			resize()
		},
		restore,
		dispose() {
			if (disposed)
				return
			disposed = true
			basemapRequest++
			observer?.disconnect()
			viewportObserver?.disconnect()
			domObserver?.disconnect()
			resizeObserver?.disconnect()
			if (resizeFrame)
				cancelAnimationFrame(resizeFrame)
			observed.clear()
			near.clear()
			snapshotGeneration++
			snapshotQueue = []
			snapshotCache.clear()
			if (mobileBackdrop) {
				delete mobileBackdrop.dataset.ready
				delete mobileBackdrop.dataset.mapKey
			}
			for (const cancel of [...pending])
				cancel()
			map?.off('move', onMove)
			map?.off('webglcontextlost', failure)
			map?.remove()
			snapshotMap?.remove()
			renderer?.remove()
			root.querySelector<HTMLElement>('.map-cover')?.style.removeProperty('--travel-map-fade-start')
		},
	}
	try {
		maplibre = await import('maplibre-gl')
		if (!root.isConnected)
			return atlas
		maplibre.setWorkerUrl(workerUrl)

		const handleIntersections = (entries: IntersectionObserverEntry[]) => {
			for (const entry of entries) {
				const peek = entry.target as HTMLElement
				if (entry.isIntersecting) {
					near.add(peek)
					queueSnapshot(peek)
				}
				else {
					near.delete(peek)
					snapshotQueue = snapshotQueue.filter(item => item.image.parentElement !== peek)
					if (getState().mobile && peek.classList.contains('reading-map')) {
						// Keep the encoded cache; release decoded backdrops outside the preload window.
						const image = peek.querySelector('img')
						image?.classList.remove('ready')
						image?.removeAttribute('src')
						peek.style.removeProperty('background-image')
					}
				}
			}
		}
		observer = new IntersectionObserver(handleIntersections, { root: scroller, rootMargin: '600px 0px' })
		viewportObserver = new IntersectionObserver(handleIntersections)
		domObserver = new MutationObserver((records) => {
			if (records.some(record => record.target === scroller && record.attributeName === 'data-snap-state')) {
				void pumpSnapshots()
				update()
			}
			if (records.some(record => (record.type === 'attributes' && record.target instanceof Element && record.target.matches('.map-peek, dialog.viewer')) || [...record.addedNodes].some(node => node instanceof Element && (node.matches('.map-peek') || node.querySelector('.map-peek')))))
				observePeeks()
		})
		domObserver.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-map-image', 'open', 'data-snap-state'] })
		// Container sizes change within desktop mode and when the canvas moves inline.
		// Coalesce layout notifications; map.resize() changes its inner canvas only.
		resizeObserver = new ResizeObserver(() => {
			if (disposed || resizeFrame)
				return
			resizeFrame = requestAnimationFrame(() => {
				resizeFrame = 0
				resize()
			})
		})
		resizeObserver.observe(root)
		resizeObserver.observe(canvas)
		update()
	}
	catch (error) {
		console.warn('[travel] Map initialization unavailable', error)
		failure()
	}
	return atlas
}
