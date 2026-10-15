import type { StyleSpecification } from 'maplibre-gl'

export type TravelBasemap = 'simple' | 'osm' | 'satellite' | 'hybrid'
export type TravelTrackColor = keyof typeof travelTrackColors
export const travelTrackColors = {
	blue: { light: '#637f91', dark: '#9fb6c5' },
	sage: { light: '#70846b', dark: '#abbda2' },
	clay: { light: '#a07866', dark: '#d1aa92' },
	violet: { light: '#86768e', dark: '#bcb0c7' },
	pink: { light: '#a77c86', dark: '#d4aeb7' },
} as const
export function normalizeTravelBasemap(value: unknown): TravelBasemap {
	return value === 'osm' || value === 'satellite' || value === 'hybrid' ? value : 'simple'
}
export function normalizeTravelTrackColor(value: unknown): TravelTrackColor {
	return typeof value === 'string' && Object.hasOwn(travelTrackColors, value) ? value as TravelTrackColor : 'blue'
}
export function isSatelliteBasemap(basemap: TravelBasemap) {
	return basemap === 'satellite' || basemap === 'hybrid'
}
export function travelMapInteractive(basemap: TravelBasemap, exploring: boolean) {
	return exploring && !isSatelliteBasemap(basemap)
}

/** One shared promise per style; failed loads can be retried by selecting again. */
export function createTravelBasemapLoader(apiKey: string, locale: string, request: typeof fetch = fetch) {
	const cache = new Map<string, Promise<StyleSpecification>>()
	return (basemap: Exclude<TravelBasemap, 'simple'>) => {
		if (basemap === 'osm') {
			return Promise.resolve<StyleSpecification>({
				version: 8,
				sources: {
					osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, minzoom: 0, maxzoom: 19, attribution: '© OpenStreetMap contributors' },
				},
				layers: [{ id: 'osm-carto', type: 'raster', source: 'osm', paint: { 'raster-fade-duration': 0 } }],
			})
		}
		const existing = cache.get(basemap)
		if (existing)
			return existing
		const result = (async () => {
			try {
				if (!apiKey)
					throw new Error('Missing key')
				const url = new URL(`https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/${basemap === 'satellite' ? 'imagery/standard' : 'imagery'}`)
				url.searchParams.set('token', apiKey)
				if (basemap === 'hybrid')
					url.searchParams.set('language', locale === 'zh' ? 'zh-CN' : locale)
				const response = await request(url.toString(), { signal: AbortSignal.timeout(12000) })
				const style = await response.json()
				if (!response.ok || style.error || style.version !== 8 || !style.sources || !Array.isArray(style.layers))
					throw new Error('Invalid style')
				return style as StyleSpecification
			}
			catch {
				cache.delete(basemap)
				throw new Error('Travel basemap unavailable')
			}
		})()
		cache.set(basemap, result)
		return result
	}
}
export function travelStyleAttribution(style: StyleSpecification) {
	return [...new Set(Object.values(style.sources).flatMap(source => 'attribution' in source && source.attribution ? [source.attribution.replace(/<[^>]*>/g, '').replace(/&copy;/g, '©').replace(/&amp;/g, '&')] : []))].join(' · ')
}
