<script setup lang="ts">
import type { Travel } from '~/types/travel'
import type { TravelAppearance, TravelPalette, TravelTheme } from '~/utils/travelTheme'
import { buildPath } from '~/utils/locale'
import { travelPalettes } from '~/utils/travelTheme'

const props = defineProps<{
	travel: Travel
	chapter: number
	progress?: { current: number, total: number }
	palette: TravelPalette
	appearance: TravelAppearance
	theme: TravelTheme
	exploring: boolean
}>()
const emit = defineEmits<{ navigate: [key: string], palette: [value: string], appearance: [value: string], explore: [], interrupt: [] }>()
const { t, locale } = useI18n()
const chapterOpen = ref(false)
const themeOpen = ref(false)
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
}
function openMenu(kind: 'chapter' | 'theme') {
	const wasOpen = kind === 'chapter' ? chapterOpen.value : themeOpen.value
	closeMenus()
	if (wasOpen)
		return
	emit('interrupt')
	if (kind === 'chapter')
		chapterOpen.value = true
	else themeOpen.value = true
}
function navigate(key: string) {
	closeMenus()
	emit('navigate', key)
}
onMounted(() => {
	useEventListener('keydown', (event: KeyboardEvent) => {
		if (event.key === 'Escape' && (chapterOpen.value || themeOpen.value)) {
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
		<button class="mode-button" @click="$emit('explore')">
			<TravelEditorialIcon name="map" />{{ $t(`page.travels.editorial.${exploring ? 'backReading' : 'explore'}`) }}
		</button>
	</div>
</header>
</template>
