<script setup lang="ts">
import type { Travel } from '~/types/travel'
import type { TravelBasemap, TravelTrackColor } from '~/utils/travelMapSettings'
import type { TravelAppearance, TravelPalette, TravelTheme } from '~/utils/travelTheme'
import { buildPath } from '~/utils/locale'
import { isSatelliteBasemap, travelTrackColors } from '~/utils/travelMapSettings'
import { travelPalettes } from '~/utils/travelTheme'

const props = defineProps<{
	travel: Travel
	chapter: number
	progress?: { current: number, total: number }
	palette: TravelPalette
	appearance: TravelAppearance
	theme: TravelTheme
	exploring: boolean
	basemap: TravelBasemap
	trackColor: TravelTrackColor
	satelliteAvailable: boolean
	mapError: boolean
	tracksVisible: boolean
}>()
const emit = defineEmits<{ navigate: [key: string], palette: [value: string], appearance: [value: string], tracks: [], basemap: [value: string], trackColor: [value: string], explore: [], interrupt: [] }>()
const { t, locale } = useI18n()
const chapterOpen = ref(false)
const themeOpen = ref(false)
const mapOpen = ref(false)
const selectedKey = computed(() => props.chapter < 0 ? 'intro' : `chapter-${props.chapter}`)
const chapters = computed(() => [
	{ key: 'intro', number: t('page.travels.editorial.opening'), title: props.travel.title, detail: t('page.travels.editorial.opening') },
	...props.travel.days.map((day, index) => ({ key: `chapter-${index}`, number: String(index + 1).padStart(2, '0'), title: day.shortTitle ?? day.title, detail: `${day.day === 0 ? t('page.travels.editorial.departure') : t('page.travels.editorial.day', { n: day.day })} · ${t('page.travels.tripPhotos', { n: day.photos.length })}` })),
])
const currentLabel = computed(() => props.chapter < 0
	? `${t('page.travels.editorial.opening')} / ${props.travel.title}`
	: `${String(props.chapter + 1).padStart(2, '0')} / ${props.travel.days[props.chapter]?.shortTitle ?? props.travel.days[props.chapter]?.title}`)
const themeLabel = computed(() => `${t(`page.travels.editorial.${props.palette}`)} / ${t(`page.travels.editorial.${props.appearance}`)}${props.appearance === 'system' ? ` (${t(`page.travels.editorial.${props.theme}`)})` : ''}`)

function closeMenus() {
	chapterOpen.value = false
	themeOpen.value = false
	mapOpen.value = false
}
function openMenu(kind: 'chapter' | 'theme' | 'map') {
	const wasOpen = kind === 'chapter' ? chapterOpen.value : kind === 'theme' ? themeOpen.value : mapOpen.value
	closeMenus()
	if (wasOpen)
		return
	emit('interrupt')
	if (kind === 'chapter')
		chapterOpen.value = true
	else if (kind === 'theme')
		themeOpen.value = true
	else mapOpen.value = true
}
function navigate(key: string) {
	closeMenus()
	emit('navigate', key)
}
onMounted(() => {
	useEventListener('keydown', (event: KeyboardEvent) => {
		if (event.key === 'Escape' && (chapterOpen.value || themeOpen.value || mapOpen.value)) {
			event.preventDefault()
			closeMenus()
		}
	})
	useEventListener(document, 'pointerdown', (event) => {
		const target = event.target as Element
		if (!target.closest('.chapter-nav'))
			chapterOpen.value = false
		if (!target.closest('.theme-control'))
			themeOpen.value = false
		if (!target.closest('.map-control'))
			mapOpen.value = false
	})
})
</script>

<template>
<header class="topbar">
	<div class="brand">
		<NuxtLink class="icon-button" :to="buildPath('/travels', locale, 'zh')" :aria-label="$t('page.travels.backToList')">
			<TravelEditorialIcon name="left" />
		</NuxtLink>
		<strong>{{ travel.title }}</strong>
	</div>
	<div class="chapter-nav">
		<button class="chapter-trigger" aria-haspopup="listbox" aria-controls="travel-chapter-menu" :aria-expanded="chapterOpen" :aria-label="`${$t('page.travels.editorial.chapters')}：${currentLabel}${progress ? ` · ${$t('page.travels.editorial.photoProgress', progress)}` : ''}`" @click="openMenu('chapter')">
			<span>{{ currentLabel }}</span><small v-if="progress" class="chapter-photo-progress" :aria-label="$t('page.travels.editorial.photoProgress', progress)">{{ progress.current }} / {{ progress.total }}</small><TravelEditorialIcon name="down" />
		</button>
		<div id="travel-chapter-menu" class="chapter-menu" :hidden="!chapterOpen">
			<div class="chapter-menu-heading" aria-hidden="true">
				{{ $t('page.travels.editorial.chapters') }}
			</div>
			<div role="listbox" :aria-label="$t('page.travels.editorial.chapters')">
				<button v-for="item in chapters" :key="item.key" class="chapter-option" role="option" :aria-selected="item.key === selectedKey" :tabindex="item.key === selectedKey ? 0 : -1" @click="navigate(item.key)">
					<span class="chapter-option-number">{{ item.number }}</span><span><strong>{{ item.title }}</strong><small>{{ item.detail }}</small></span>
				</button>
			</div>
		</div>
	</div>
	<div class="nav-right">
		<div class="theme-control">
			<button class="theme-trigger" aria-haspopup="menu" aria-controls="travel-theme-menu" :aria-expanded="themeOpen" :aria-label="`${$t('page.travels.editorial.theme')}：${themeLabel}`" @click="openMenu('theme')">
				<TravelEditorialIcon :name="appearance" /><span>{{ $t(`page.travels.editorial.${palette}`) }}</span>
			</button>
			<div id="travel-theme-menu" class="theme-menu" role="menu" :hidden="!themeOpen" :aria-label="$t('page.travels.editorial.theme')">
				<p id="travel-palette-label" class="theme-section-label">
					{{ $t('page.travels.editorial.palette') }}
				</p>
				<div class="palette-options" role="group" aria-labelledby="travel-palette-label">
					<button v-for="colors, key in travelPalettes" :key="key" class="palette-option" role="menuitemradio" :data-palette-option="key" :aria-checked="palette === key" :tabindex="palette === key ? 0 : -1" @click="$emit('palette', key)">
						<span class="palette-swatch" :style="{ '--swatch': colors.accent, '--swatch-paper': colors.paper }" aria-hidden="true" /><span>{{ $t(`page.travels.editorial.${key}`) }}</span><span class="theme-check" aria-hidden="true">✓</span>
					</button>
				</div>
				<p id="travel-appearance-label" class="theme-section-label mode-label">
					{{ $t('page.travels.editorial.appearance') }}
				</p>
				<div role="group" aria-labelledby="travel-appearance-label">
					<button v-for="mode in ['light', 'dark', 'system']" :key="mode" class="theme-option" role="menuitemradio" :aria-checked="appearance === mode" :tabindex="appearance === mode ? 0 : -1" @click="$emit('appearance', mode)">
						<TravelEditorialIcon :name="mode" /><span>{{ $t(`page.travels.editorial.${mode}`) }}</span><span class="theme-check" aria-hidden="true">✓</span>
					</button>
				</div>
			</div>
		</div>
		<div class="map-control">
			<button class="theme-trigger map-trigger" aria-haspopup="menu" aria-controls="travel-map-menu" :aria-expanded="mapOpen" :aria-label="`${$t('page.travels.editorial.mapSettings')}：${$t(`page.travels.editorial.basemap_${basemap}`)}`" @click="openMenu('map')">
				<TravelEditorialIcon name="layers" /><span>{{ $t('page.travels.editorial.mapSettings') }}</span>
			</button>
			<div id="travel-map-menu" class="theme-menu map-menu" role="menu" :hidden="!mapOpen" :aria-label="$t('page.travels.editorial.mapSettings')">
				<p id="travel-basemap-label" class="theme-section-label">
					{{ $t('page.travels.editorial.basemap') }}
				</p>
				<div class="basemap-options" role="group" aria-labelledby="travel-basemap-label">
					<button v-for="kind in (['simple', 'osm', 'satellite', 'hybrid'] as const)" :key="kind" class="basemap-option" role="menuitemradio" :aria-checked="basemap === kind" :disabled="isSatelliteBasemap(kind) && !satelliteAvailable" @click="$emit('basemap', kind)">
						<span class="basemap-sample" :class="`sample-${kind}`" aria-hidden="true"><span v-if="kind === 'hybrid'">Aa</span></span>
						<span>{{ $t(`page.travels.editorial.basemap_${kind}`) }}</span>
					</button>
				</div>
				<p v-if="!satelliteAvailable || isSatelliteBasemap(basemap)" class="map-setting-note">
					<TravelEditorialIcon name="lock" />{{ $t(`page.travels.editorial.${satelliteAvailable ? 'satelliteLocked' : 'satelliteUnavailable'}`) }}
				</p>
				<p v-if="mapError" class="map-setting-error" role="status">
					{{ $t('page.travels.editorial.basemapFailed') }}
				</p>
				<div v-if="travel.tracks?.some(track => track.segments.length)" class="map-track-settings">
					<button class="map-track-switch" role="menuitemcheckbox" :aria-checked="tracksVisible" @click="$emit('tracks')">
						<span><TravelEditorialIcon name="route" />{{ $t('page.travels.editorial.showTracks') }}</span><span class="map-switch-mark" aria-hidden="true"><span /></span>
					</button>
					<p id="travel-track-color-label" class="theme-section-label">
						{{ $t('page.travels.editorial.trackColor') }}
					</p>
					<div class="track-color-options" role="group" aria-labelledby="travel-track-color-label">
						<button v-for="colors, key in travelTrackColors" :key="key" class="track-color-option" role="menuitemradio" :aria-checked="trackColor === key" :aria-label="$t(`page.travels.editorial.track_${key}`)" :title="$t(`page.travels.editorial.track_${key}`)" :style="{ '--track-swatch': colors[isSatelliteBasemap(basemap) ? 'dark' : basemap !== 'simple' ? 'light' : theme] }" @click="$emit('trackColor', key)">
							<span aria-hidden="true">✓</span>
						</button>
					</div>
				</div>
			</div>
		</div>
		<button class="mode-button" @click="$emit('explore')">
			<TravelEditorialIcon name="map" />{{ $t(`page.travels.editorial.${exploring ? 'backReading' : 'explore'}`) }}
		</button>
	</div>
</header>
</template>
