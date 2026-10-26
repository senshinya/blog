import type { FeatureCollection, MultiLineString } from 'geojson'
import type { ExpressionSpecification, Map as MapLibreMap } from 'maplibre-gl'
import type { TravelCoverMap, TravelTrack } from '../../../types/travel.ts'
import { matchesTravelCoverTrack } from '../../../utils/travelCoverMap.ts'

interface TrackScope { chapter: number, overview: boolean, selected?: { day: number }, coverMap?: TravelCoverMap }
const sourceId = 'travel-tracks'
const haloId = 'travel-track-halo'
const lineId = 'travel-track-line'

export function atlasTrackMatches(track: TravelTrack, scope: TrackScope) {
	if (scope.coverMap?.tracks)
		return matchesTravelCoverTrack(track, scope.coverMap.tracks)
	if (scope.overview && scope.selected)
		return track.day === scope.selected.day
	return scope.chapter < 0 || track.chapter === scope.chapter
}

/** Empty or unrelated recordings must not suppress the overview's photo locations. */
export function atlasHasVisibleTracks(scope: TrackScope, tracks: TravelTrack[] = [], visible = false) {
	return (visible || Boolean(scope.coverMap?.tracks))
		&& tracks.some(track => atlasTrackMatches(track, scope) && track.segments.some(segment => segment.length >= 2))
}

/** Install below photo markers on both the live atlas and snapshot renderer. */
export function installAtlasTracks(target: MapLibreMap, tracks: TravelTrack[] = []) {
	const data: FeatureCollection<MultiLineString> = {
		type: 'FeatureCollection',
		features: tracks.filter(track => track.segments.length).map(track => ({
			type: 'Feature',
			properties: { chapter: track.chapter, day: track.day },
			geometry: { type: 'MultiLineString', coordinates: track.segments },
		})),
	}
	if (!data.features.length)
		return
	target.addSource(sourceId, { type: 'geojson', data })
	const layout = { 'line-cap': 'round', 'line-join': 'round', 'visibility': 'none' } as const
	target.addLayer({ id: haloId, type: 'line', source: sourceId, layout, paint: { 'line-color': '#f5f5f7', 'line-width': 3.6, 'line-opacity': 0.45 } })
	target.addLayer({ id: lineId, type: 'line', source: sourceId, layout, paint: { 'line-color': '#637f91', 'line-width': 1.6, 'line-opacity': 0.68 } })
}

export function paintAtlasTracks(target: MapLibreMap, scope: TrackScope, colors: { track: string, paper: string }, visible = false) {
	if (!target.getLayer(lineId))
		return
	const coverTracks = scope.coverMap?.tracks
	let filter: ExpressionSpecification | null = scope.overview && scope.selected
		? ['==', ['get', 'day'], scope.selected.day]
		: scope.chapter >= 0 ? ['==', ['get', 'chapter'], scope.chapter] : null
	if (coverTracks) {
		const filters: ExpressionSpecification[] = []
		if (coverTracks.chapters !== undefined)
			filters.push(['in', ['get', 'chapter'], ['literal', coverTracks.chapters.map(chapter => chapter - 1)]])
		if (coverTracks.days !== undefined)
			filters.push(['in', ['get', 'day'], ['literal', coverTracks.days]])
		filter = filters.length > 1 ? ['any', ...filters] : filters[0] ?? null
		visible = true
	}
	target.setFilter(haloId, filter)
	target.setFilter(lineId, filter)
	target.setLayoutProperty(haloId, 'visibility', visible ? 'visible' : 'none')
	target.setLayoutProperty(lineId, 'visibility', visible ? 'visible' : 'none')
	target.setPaintProperty(haloId, 'line-color', colors.paper)
	target.setPaintProperty(lineId, 'line-color', colors.track)
	const overview = !scope.selected
	target.setPaintProperty(lineId, 'line-width', overview ? 2.2 : 1.6)
	target.setPaintProperty(lineId, 'line-opacity', overview ? 0.95 : 0.68)
	target.setPaintProperty(haloId, 'line-width', overview ? 4.6 : 3.6)
	target.setPaintProperty(haloId, 'line-opacity', overview ? 0.7 : 0.45)
}
