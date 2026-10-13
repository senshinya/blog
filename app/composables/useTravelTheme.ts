import type { TravelAppearance, TravelPalette } from '~/utils/travelTheme'
import { normalizeTravelAppearance, normalizeTravelPalette } from '~/utils/travelTheme'

export function useTravelTheme() {
	const savedPalette = useCookie<string>('travel-palette', { default: () => 'mono', sameSite: 'lax', maxAge: 31536000 })
	const savedAppearance = useCookie<string>('travel-theme', { default: () => 'system', sameSite: 'lax', maxAge: 31536000 })
	// Prerendered HTML carries this state into hydration, even when browser cookies differ.
	const palettePreference = useState<TravelPalette>('travel-palette-value', () => normalizeTravelPalette(savedPalette.value))
	const appearancePreference = useState<TravelAppearance>('travel-theme-value', () => normalizeTravelAppearance(savedAppearance.value))
	const palette = computed(() => normalizeTravelPalette(palettePreference.value))
	const appearance = computed(() => normalizeTravelAppearance(appearancePreference.value))
	const systemDark = ref(false)
	const theme = computed(() => appearance.value === 'system' ? (systemDark.value ? 'dark' : 'light') : appearance.value)
	let media: MediaQueryList | undefined
	function systemChanged(event: MediaQueryListEvent) {
		systemDark.value = event.matches
	}
	function persist(key: string, value: string) {
		try {
			localStorage.setItem(key, value)
		}
		catch { /* Cookies still preserve preferences when local storage is unavailable. */ }
	}
	function setPalette(value: string) {
		palettePreference.value = normalizeTravelPalette(value)
		savedPalette.value = palettePreference.value
		persist('travel-palette', palettePreference.value)
	}
	function setAppearance(value: string) {
		appearancePreference.value = normalizeTravelAppearance(value)
		savedAppearance.value = appearancePreference.value
		persist('travel-theme', appearancePreference.value)
	}
	onMounted(() => {
		media = window.matchMedia('(prefers-color-scheme: dark)')
		systemDark.value = media.matches
		media.addEventListener('change', systemChanged)
		palettePreference.value = normalizeTravelPalette(savedPalette.value)
		appearancePreference.value = normalizeTravelAppearance(savedAppearance.value)
		try {
			const priorPalette = localStorage.getItem('travel-palette')
			const priorAppearance = localStorage.getItem('travel-theme')
			if (priorPalette) {
				palettePreference.value = normalizeTravelPalette(priorPalette)
				savedPalette.value = palettePreference.value
			}
			if (priorAppearance) {
				appearancePreference.value = normalizeTravelAppearance(priorAppearance)
				savedAppearance.value = appearancePreference.value
			}
		}
		catch { /* Continue with cookie preferences. */ }
	})
	useEventListener('storage', (event: StorageEvent) => {
		if (event.key === 'travel-palette') {
			palettePreference.value = normalizeTravelPalette(event.newValue)
			savedPalette.value = palettePreference.value
		}
		if (event.key === 'travel-theme') {
			appearancePreference.value = normalizeTravelAppearance(event.newValue)
			savedAppearance.value = appearancePreference.value
		}
	})
	onScopeDispose(() => media?.removeEventListener('change', systemChanged))
	return { palette, appearance, theme, setPalette, setAppearance }
}
