import type { Travel, TravelPhoto } from '../types/travel.ts'

export interface StoryPhoto extends TravelPhoto {
	day: number
	index: number
	chapter: number
	chapterIndex: number
}
export function flattenTravelPhotos(travel: Travel): StoryPhoto[] {
	let index = 0
	return travel.days.flatMap((day, chapter) => day.photos.map((photo, chapterIndex) => ({ ...photo, day: day.day, index: index++, chapter, chapterIndex })))
}
export function hasTravelCoordinates(photo: TravelPhoto): photo is TravelPhoto & { lat: number, lng: number } {
	return Number.isFinite(photo.lat) && Number.isFinite(photo.lng) && Math.abs(photo.lat!) <= 90 && Math.abs(photo.lng!) <= 180
}
export function travelCoordinateLabel(photo: TravelPhoto) {
	if (!hasTravelCoordinates(photo))
		return ''
	return `${Math.abs(photo.lat).toFixed(4)}° ${photo.lat < 0 ? 'S' : 'N'} · ${Math.abs(photo.lng).toFixed(4)}° ${photo.lng < 0 ? 'W' : 'E'}`
}
export function countTravelLocations(photos: TravelPhoto[]) {
	return new Set(photos.filter(hasTravelCoordinates).map(photo => `${photo.lat},${photo.lng}`)).size
}
