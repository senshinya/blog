import type { TravelTrack } from '../../../types/travel.ts'
import type { StoryPhoto } from '../../../utils/travelStory.ts'
import { hasTravelCoordinates } from '../../../utils/travelStory.ts'

export type LocatedStoryPhoto = StoryPhoto & { lat: number, lng: number }

/** The cover includes every real coordinate, including far-away departure points. */
export function atlasSelection(photos: StoryPhoto[], node: string, focusIndex = -1): { points: LocatedStoryPhoto[], chapter: number, overview: boolean, selected?: LocatedStoryPhoto } {
	const index = focusIndex >= 0 ? focusIndex : /^photo-\d+$/.test(node) ? Number(node.slice(6)) : -1
	const focus = photos.find(photo => photo.index === index)
	const chapter = focus?.chapter ?? (/^chapter-\d+$/.test(node) ? Number(node.slice(8)) : -1)
	const overview = focus?.mapView === 'day'
	const points = photos.filter((photo): photo is LocatedStoryPhoto => hasTravelCoordinates(photo) && (overview ? photo.day === focus.day : chapter < 0 || photo.chapter === chapter))
	return { points, chapter, overview, selected: focus && hasTravelCoordinates(focus) ? focus as LocatedStoryPhoto : undefined }
}

/** Overview bounds follow the same chapter/day scope as the visible track layers. */
export function atlasOverviewPoints(selection: ReturnType<typeof atlasSelection>, tracks: TravelTrack[] = [], tracksVisible = false): { lng: number, lat: number }[] {
	if (!tracksVisible)
		return selection.points
	const route = tracks.filter(track => selection.overview && selection.selected
		? track.day === selection.selected.day
		: selection.chapter < 0 || track.chapter === selection.chapter)
	return [...selection.points, ...route.flatMap(track => track.segments.flat().map(([lng, lat]) => ({ lng, lat })))]
}

/** Dialog peeks use viewport geometry because the dialog is outside the story scroller. */
export function atlasPeekVisible(box: { width: number, height: number, top: number, right: number, bottom: number, left: number }, viewport: { width: number, height: number }, open: boolean) {
	return open && box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < viewport.height && box.right > 0 && box.left < viewport.width
}

/** Story peeks render on mobile; viewer peeks render whenever their open dialog is visible. */
export function atlasSnapshotEligible(mobile: boolean, inViewer: boolean, visibleDialog: boolean) {
	return inViewer ? visibleDialog : mobile
}

/** Keep mobile snapshot rendering and PNG encoding outside active scroll frames. */
export function atlasSnapshotsPaused(mobile: boolean, state?: string) {
	return mobile && state !== undefined && !['idle', 'settled', 'free'].includes(state)
}

/** Vary the transition length while keeping the clear-map boundary stable. */
export function atlasVeil(contentRight: number, readingRight: number) {
	const end = readingRight + 120
	return { start: Math.max(end - 360, Math.min(end - 96, contentRight + 24)), end }
}

/** Keep the wash opaque through the caption, then fade only in its trailing space. */
export function atlasMobileCaptionWashTail(stageHeight: number, captionBottom: number) {
	return Math.max(0, Math.min(96, stageHeight - captionBottom))
}

/** Dense chapter text leaves a clearer map window beside its photo entry. */
export function atlasMobileChapterRegion(viewport: { width: number, height: number }, summary: { top: number, bottom: number }) {
	const { width, height } = viewport
	const below = summary.bottom + 24
	if (height - 16 - below >= 120)
		return { left: 20, right: width - 20, top: below, bottom: Math.min(height - 16, below + 180) }
	const half = Math.min(56, Math.max(0, (height - 32) / 2))
	const center = Math.max(16 + half, Math.min((summary.top + summary.bottom) / 2, height - Math.max(72, half + 16)))
	return { left: width * 0.54, right: width - 20, top: center - half, bottom: center + half }
}

/** Fit the mobile map into the exposed part of its scrolling page background. */
export function atlasMobileBackdropPadding(viewport: { width: number, height: number }, region: { left: number, right: number, top: number, bottom: number }) {
	function axis(size: number, start: number, end: number) {
		const minimum = Math.min(48, size)
		const low = Math.max(0, Math.min(size - minimum, start))
		const high = Math.max(low + minimum, Math.min(size, end))
		const gutter = Math.min(16, (high - low - 1) / 2)
		return [low + gutter, size - high + gutter] as const
	}
	const [left, right] = axis(viewport.width, region.left, region.right)
	const [top, bottom] = axis(viewport.height, region.top, region.bottom)
	return { left, right, top, bottom }
}

/** Use the largest clear rectangle to the right of the enlarged photograph. */
export function atlasViewerPadding(viewport: { width: number, height: number }, photoRight: number, notes?: { left: number, right: number, top: number, bottom: number }) {
	const right = Math.max(1, viewport.width - 24)
	const region = { left: Math.max(0, Math.min(photoRight + 24, right - 48)), right, top: 24, bottom: Math.max(25, viewport.height - 32) }
	let clear = region
	if (notes && notes.right + 24 > region.left && notes.left - 24 < region.right && notes.bottom + 24 > region.top && notes.top - 24 < region.bottom) {
		const candidates = [
			{ ...region, right: Math.min(region.right, notes.left - 24) },
			{ ...region, left: Math.max(region.left, notes.right + 24) },
			{ ...region, bottom: Math.min(region.bottom, notes.top - 24) },
			{ ...region, top: Math.max(region.top, notes.bottom + 24) },
		].filter(box => box.right > box.left && box.bottom > box.top)
		clear = candidates.sort((a, b) => (b.right - b.left) * (b.bottom - b.top) - (a.right - a.left) * (a.bottom - a.top))[0] ?? region
	}
	return { left: Math.round(clear.left), right: Math.round(viewport.width - clear.right), top: Math.round(clear.top), bottom: Math.round(viewport.height - clear.bottom) }
}
