import type { TravelCoverMap, TravelTrack } from '../types/travel.ts'

/** YAML is untyped at runtime; invalid selectors must not accidentally select every route. */
export function normalizeTravelCoverMap(value: unknown): TravelCoverMap | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		return undefined
	const input = value as Record<string, unknown>
	const result: TravelCoverMap = {}
	const bounds = input.bounds
	if (Array.isArray(bounds) && bounds.length === 2
		&& bounds.every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90)
		&& bounds[0][0] < bounds[1][0] && bounds[0][1] < bounds[1][1]) {
		result.bounds = bounds as TravelCoverMap['bounds']
	}
	if (input.tracks && typeof input.tracks === 'object' && !Array.isArray(input.tracks)) {
		const tracks = input.tracks as Record<string, unknown>
		result.tracks = {}
		for (const key of ['chapters', 'days'] as const) {
			if (!Object.hasOwn(tracks, key))
				continue
			const values = tracks[key]
			result.tracks[key] = Array.isArray(values) ? [...new Set(values.filter((item): item is number => Number.isSafeInteger(item) && item >= (key === 'chapters' ? 1 : 0)))] : []
		}
	}
	return result.bounds || result.tracks ? result : undefined
}

export function matchesTravelCoverTrack(track: TravelTrack, selection: NonNullable<TravelCoverMap['tracks']>) {
	return (selection.chapters === undefined && selection.days === undefined)
		|| Boolean(selection.chapters?.includes(track.chapter + 1) || selection.days?.includes(track.day))
}
