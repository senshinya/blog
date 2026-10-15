import type { TravelBasemap, TravelTrackColor } from '~/utils/travelMapSettings'
import { normalizeTravelBasemap, normalizeTravelTrackColor } from '~/utils/travelMapSettings'

export function useTravelMapSettings() {
	const basemap = ref<TravelBasemap>('simple')
	const trackColor = ref<TravelTrackColor>('blue')
	const tracksVisible = ref(false)
	function persist(key: string, value: string) {
		try {
			localStorage.setItem(key, value)
		}
		catch { /* Preferences are optional in restricted browsers. */ }
	}
	function setBasemap(value: string) {
		basemap.value = normalizeTravelBasemap(value)
	}
	function setTrackColor(value: string) {
		trackColor.value = normalizeTravelTrackColor(value)
		persist('travel-track-color', trackColor.value)
	}
	onMounted(() => {
		try {
			trackColor.value = normalizeTravelTrackColor(localStorage.getItem('travel-track-color'))
		}
		catch { /* Keep the default map and color. */ }
	})
	return { basemap, trackColor, tracksVisible, setBasemap, setTrackColor }
}
