import type { FeatureCollection, MultiLineString } from 'geojson'
import type { ExpressionSpecification, Map as MapLibreMap } from 'maplibre-gl'
import type { TravelTrack } from '../../../types/travel.ts'

interface TrackScope { chapter: number, overview: boolean, selected?: { day: number } }
const sourceId = 'travel-tracks'
const haloId = 'travel-track-halo'
const lineId = 'travel-track-line'

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
	const filter: ExpressionSpecification | null = scope.overview && scope.selected
		? ['==', ['get', 'day'], scope.selected.day]
		: scope.chapter >= 0 ? ['==', ['get', 'chapter'], scope.chapter] : null
	target.setFilter(haloId, filter)
	target.setFilter(lineId, filter)
	target.setLayoutProperty(haloId, 'visibility', visible ? 'visible' : 'none')
	target.setLayoutProperty(lineId, 'visibility', visible ? 'visible' : 'none')
	target.setPaintProperty(haloId, 'line-color', colors.paper)
	target.setPaintProperty(lineId, 'line-color', colors.track)
}
