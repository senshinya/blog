<script setup lang="ts">
import type { TravelAtlas } from './atlas'
import type { ViewerCaptionRects, ViewerRect } from './viewer-geometry'
import type { Travel } from '~/types/travel'
import blogConfig from '~~/blog.config'
import { useTravelFocus } from '~/composables/useTravelFocus'
import { contentResourceLinks } from '~/utils/contentResources'
import { countTravelLocations, flattenTravelPhotos, hasTravelCoordinates, travelCoordinateLabel } from '~/utils/travelStory'
import { orientedViewerRect } from './viewer-geometry'
import './editorial.css'
import './photo.css'
import './viewer.css'
import './mobile-backdrop.css'

const props = defineProps<{ travel: Travel }>()
const scrollPerfEnabled = import.meta.dev && useRoute().query.scrollPerf === '1'
const { t, locale } = useI18n()
const photos = computed(() => flattenTravelPhotos(props.travel))
const chapters = computed(() => props.travel.days.map((day, index) => ({ ...day, photos: photos.value.filter(photo => photo.chapter === index), label: day.shortTitle ?? day.title })))
const coverPhoto = computed(() => ({ ...photos.value.find(photo => photo.src === props.travel.coverImage), src: props.travel.coverImage, alt: photos.value.find(photo => photo.src === props.travel.coverImage)?.alt ?? props.travel.title }))
const root = useTemplateRef<HTMLElement>('root')
useTravelFocus(root)
const scroller = useTemplateRef<HTMLElement>('scroller')
const canvas = useTemplateRef<HTMLElement>('canvas')
const mobileBackdrop = useTemplateRef<HTMLElement>('mobileBackdrop')
const viewer = useTemplateRef<HTMLDialogElement>('viewer')
const lightbox = useTemplateRef<{ enter: (rect?: ViewerRect, notes?: ViewerCaptionRects) => Promise<void>, leave: (rect?: ViewerRect, notes?: ViewerCaptionRects) => Promise<void> }>('lightbox')
const activeNode = ref('intro')
const viewerOpen = ref(false)
const viewerClosing = ref(false)
const viewerDimmed = ref(false)
const viewerIndex = ref(0)
const expandedMap = ref<string | null>(null)
const exploring = ref(false)
const mapFailed = ref(false)
const mobile = useMediaQuery('(max-width: 700px)', { ssrWidth: 1024 })
const reduced = usePreferredReducedMotion()
const { palette, appearance, theme, setPalette, setAppearance } = useTravelTheme()
const focusedIndex = computed(() => viewerOpen.value ? viewerIndex.value : activeNode.value.startsWith('photo-') ? Number(activeNode.value.slice(6)) : -1)
const activeChapter = computed(() => focusedIndex.value >= 0 ? photos.value[focusedIndex.value]?.chapter ?? -1 : activeNode.value.startsWith('chapter-') ? Number(activeNode.value.slice(8)) : -1)
const viewerPhoto = computed(() => photos.value[viewerIndex.value])
const chapterProgress = computed(() => {
	const photo = photos.value[focusedIndex.value]
	return photo ? { current: photo.chapterIndex + 1, total: chapters.value[photo.chapter]!.photos.length } : undefined
})
const nextReadingImage = computed(() => {
	const node = activeNode.value
	const next = node.startsWith('photo-')
		? photos.value[Number(node.slice(6)) + 1]
		: node.startsWith('chapter-') ? chapters.value[Number(node.slice(8))]?.photos[0] : photos.value[0]
	return next ? getTravelImg(next.src, mobile.value ? TravelImgWidth.cover : TravelImgWidth.viewer) : undefined
})
useTravelPhotoPreload(nextReadingImage, computed(() => viewerOpen.value || exploring.value))
const connector = ref<{ path: string, x: number, y: number } | null>(null)
const published = computed(() => new Intl.DateTimeFormat(locale.value, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${props.travel.published}T00:00:00Z`)))
let atlas: TravelAtlas | undefined
let disposed = false
let openingMap = 0
let inlineReadingTop = 0
let connectorFrame = 0

useHead(() => ({
	link: contentResourceLinks({ serif: true }, locale.value),
	bodyAttrs: { class: 'travel-page' },
}))
const { scrollToNode, cancel, wheel } = useTravelSpringScroll(scroller, {
	blocked: () => (viewerOpen.value && !viewerClosing.value) || exploring.value,
	onNodeChange(key) {
		activeNode.value = key
	},
})
function photoPortrait(src: string) {
	const meta = getImgMeta(src)
	return Boolean(meta && meta.h > meta.w)
}
function titleParts(title: string) {
	const index = title.indexOf(' —— ')
	return index < 0 ? [title] : [title.slice(0, index), title.slice(index)]
}
function drawConnector() {
	connectorFrame = 0
	connector.value = null
	if (!atlas || mobile.value || exploring.value || viewerOpen.value || focusedIndex.value < 0)
		return
	const photo = photos.value[focusedIndex.value]
	if (!photo || !hasTravelCoordinates(photo))
		return
	const figure = root.value?.querySelector<HTMLElement>(`#photo-${photo.index} .story-photo`)
	const box = figure?.querySelector('.photo-place > span')?.getBoundingClientRect()
	const caption = figure?.querySelector('figcaption')?.getBoundingClientRect()
	const rootBox = scroller.value?.getBoundingClientRect()
	const target = atlas.project(photo.index)
	if (!box || !caption || !rootBox || !target || box.top < rootBox.top + 12 || box.bottom > rootBox.bottom - 12 || target.y < rootBox.top + 10 || target.y > rootBox.bottom - 10)
		return
	const x = box.right + 10
	const y = (box.top + box.bottom) / 2
	const turn = Math.max(x + 28, caption.right + 24)
	if (target.x < turn + 48)
		return
	const handle = Math.min(140, (target.x - turn) * 0.42)
	connector.value = { path: `M${x},${y}H${turn}C${turn + handle},${y} ${target.x - handle},${target.y} ${target.x},${target.y}`, x, y }
}
function queueConnector() {
	if (mobile.value) {
		connector.value = null
		return
	}
	if (!disposed && !connectorFrame)
		connectorFrame = requestAnimationFrame(drawConnector)
}
function closeMap() {
	openingMap++
	atlas?.restore()
	exploring.value = false
	expandedMap.value = null
	if (scroller.value && mobile.value)
		scroller.value.scrollTop = inlineReadingTop
	atlas?.update()
	queueConnector()
}
async function openMap(key: string) {
	if (mobile.value || viewerClosing.value)
		return
	if (mapFailed.value || !atlas)
		return
	if (expandedMap.value === key) {
		closeMap()
		return
	}
	if (exploring.value)
		closeMap()
	cancel()
	inlineReadingTop = scroller.value?.scrollTop ?? 0
	const request = ++openingMap
	exploring.value = true
	if (mobile.value || viewerOpen.value)
		expandedMap.value = key
	await nextTick()
	if (disposed || request !== openingMap)
		return
	const container = mobile.value || viewerOpen.value ? root.value?.querySelector<HTMLElement>(`[data-map-detail="${key}"]`) : undefined
	atlas.explore(key, container ?? undefined)
	connector.value = null
}
function toggleExplore() {
	if (exploring.value)
		closeMap()
	else openMap(activeChapter.value >= 0 ? `chapter-${activeChapter.value}` : 'intro')
}
function navigate(key: string) {
	if (exploring.value)
		closeMap()
	scrollToNode(key)
}
function skipToContent() {
	navigate('intro')
}
useEventListener('keydown', (event: KeyboardEvent) => {
	if (!event.defaultPrevented && event.key === 'Escape' && (viewerOpen.value || exploring.value)) {
		event.preventDefault()
		event.stopPropagation()
		if (viewerOpen.value)
			closeViewer()
		else closeMap()
	}
})
function photoRect(index: number): ViewerRect | undefined {
	const image = root.value?.querySelector<HTMLImageElement>(`#photo-${index} .photo-open img`)
	const frame = image?.closest('.photo-open')
	if (!image || !frame)
		return
	const style = getComputedStyle(image)
	const frameStyle = getComputedStyle(frame)
	return orientedViewerRect(image.getBoundingClientRect(), {
		width: Number.parseFloat(style.width),
		height: Number.parseFloat(style.height),
	}, Number.parseFloat(frameStyle.rotate) || 0, Number.parseFloat(frameStyle.scale) || 1)
}
function captionRects(index: number): ViewerCaptionRects {
	const figure = root.value?.querySelector(`#photo-${index} .story-photo`)
	return {
		title: figure?.querySelector('.photo-title > span')?.getBoundingClientRect(),
		place: figure?.querySelector('.photo-place > span')?.getBoundingClientRect(),
		description: figure?.querySelector('.photo-caption > span')?.getBoundingClientRect(),
	}
}
async function openViewer(index: number) {
	if (mobile.value || viewerClosing.value)
		return
	if (exploring.value)
		closeMap()
	const origin = photoRect(index)
	const notes = captionRects(index)
	cancel()
	scrollToNode(`photo-${index}`, true)
	viewerIndex.value = index
	viewerOpen.value = true
	await nextTick()
	if (disposed || !viewerOpen.value)
		return
	viewer.value?.showModal()
	// Commit the transparent backdrop before changing its dim state.
	if (viewer.value)
		getComputedStyle(viewer.value, '::backdrop').getPropertyValue('opacity')
	viewerDimmed.value = true
	connector.value = null
	const motion = lightbox.value?.enter(origin, notes)
	await nextTick()
	atlas?.update()
	await motion
}
async function closeViewer() {
	if (!viewerOpen.value || viewerClosing.value)
		return
	if (exploring.value)
		closeMap()
	viewerClosing.value = true
	scrollToNode(`photo-${viewerIndex.value}`, true)
	await nextTick()
	if (disposed)
		return
	const target = photoRect(viewerIndex.value)
	viewerDimmed.value = false
	atlas?.update()
	await lightbox.value?.leave(target, captionRects(viewerIndex.value))
	if (disposed)
		return
	viewerOpen.value = false
	viewer.value?.close()
	viewerClosing.value = false
	await nextTick()
	if (disposed)
		return
	atlas?.update()
	queueConnector()
}
function stepViewer(delta: number) {
	if (viewerClosing.value)
		return
	if (exploring.value)
		closeMap()
	viewerIndex.value = Math.max(0, Math.min(photos.value.length - 1, viewerIndex.value + delta))
}
watch([activeNode, focusedIndex, palette, theme], async () => {
	await nextTick()
	if (!disposed) {
		atlas?.update()
		queueConnector()
	}
})
watch(mobile, async () => {
	if (exploring.value)
		closeMap()
	await nextTick()
	atlas?.resize()
	atlas?.update()
	queueConnector()
})
onMounted(async () => {
	try {
		const { createTravelAtlas } = await import('./atlas')
		if (disposed || !root.value || !scroller.value || !canvas.value)
			return
		const created = await createTravelAtlas({
			root: root.value,
			scroller: scroller.value,
			canvas: canvas.value,
			mobileBackdrop: mobileBackdrop.value ?? undefined,
			photos: photos.value,
			locale: locale.value,
			labels: { title: t('page.travels.mapControls.title'), zoomIn: t('page.travels.mapControls.zoomIn'), zoomOut: t('page.travels.mapControls.zoomOut'), attribution: t('page.travels.mapControls.attribution'), feedback: t('page.travels.mapControls.feedback') },
			getState: () => ({ node: activeNode.value, focusIndex: focusedIndex.value, theme: theme.value, palette: palette.value, mobile: mobile.value, exploring: exploring.value, viewer: viewerOpen.value && !viewerClosing.value, reduced: reduced.value === 'reduce' }),
			onMove: queueConnector,
			onFailure: () => {
				if (!disposed)
					mapFailed.value = true
			},
		})
		if (disposed) {
			created.dispose()
		}
		else {
			atlas = created
			atlas.update()
			queueConnector()
		}
	}
	catch {
		if (!disposed)
			mapFailed.value = true
	}
})
onBeforeUnmount(() => {
	disposed = true
	openingMap++
	cancel()
	cancelAnimationFrame(connectorFrame)
	atlas?.dispose()
	viewer.value?.close()
})
</script>

<template>
<div ref="root" class="travel-editorial spring-ready" :class="{ 'exploring': exploring && !mobile, 'viewer-active': viewerOpen, 'viewer-restoring': viewerClosing }" :data-theme="theme" :data-palette="palette" :data-appearance="appearance" :data-reading-node="activeNode">
	<a class="skip" href="#intro" @click.prevent="skipToContent">{{ $t('nav.skipToContent') }}</a>
	<TravelEditorialMenus :travel :chapter="activeChapter" :progress="chapterProgress" :palette :appearance :theme :exploring="exploring && !mobile" @navigate="navigate" @palette="setPalette" @appearance="setAppearance" @explore="toggleExplore" @interrupt="cancel" />
	<aside class="map-stage" :aria-label="$t('page.travels.mapControls.title')" @wheel="wheel">
		<div ref="canvas" class="map-canvas" />
		<div class="map-cover" />
		<p v-if="mapFailed" class="map-failed visible">
			{{ $t('page.travels.mapUnavailable') }}
		</p>
		<a class="map-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© CARTO · © OpenStreetMap</a>
	</aside>
	<div ref="mobileBackdrop" class="mobile-atlas" aria-hidden="true" />
	<span v-if="mobile && activeNode !== 'intro'" class="mobile-map-credit" aria-hidden="true">© CARTO · © OpenStreetMap</span>
	<main ref="scroller" class="story-scroll" tabindex="-1" :inert="exploring && !mobile" @scroll.passive="queueConnector">
		<div class="story-content">
			<div id="intro" class="reading-step" data-node="intro" :class="{ 'is-current': activeNode === 'intro' }">
				<div class="reading-stage">
					<section class="cover">
						<h1>{{ travel.title }}</h1>
						<div class="cover-photo">
							<div>
								<div class="photo-composition">
									<TravelEditorialPhoto :photo="coverPhoto" eager />
								</div>
								<TravelEditorialMapDetail v-if="!viewerOpen && expandedMap === 'intro'" map-key="intro" :title="travel.title" @collapse="closeMap" />
							</div>
							<div>
								<blockquote>{{ travel.description }}</blockquote>
								<p class="byline">
									{{ $t('page.travels.editorial.byline', { name: blogConfig.author.name }) }}<br>{{ $t('page.travels.editorial.published', { date: published }) }}
								</p>
								<div class="cover-meta">
									{{ $t('page.travels.dayCount', { n: travel.totaldays }) }} · {{ $t('page.travels.tripPhotos', { n: photos.length }) }} · {{ $t('page.travels.editorial.chapterCount', { n: chapters.length }) }}
								</div>
							</div>
						</div>
					</section>
				</div>
			</div>
			<section v-for="chapter, chapterIndex in chapters" :key="chapterIndex" class="chapter">
				<div :id="`chapter-${chapterIndex}`" class="reading-step" :data-node="`chapter-${chapterIndex}`" :class="{ 'is-current': activeNode === `chapter-${chapterIndex}` }">
					<div class="reading-stage">
						<TravelEditorialMapPeek v-if="countTravelLocations(chapter.photos)" class="reading-map" :map-key="`chapter-${chapterIndex}`" :title="chapter.label" :interactive="false" />
						<header class="chapter-head">
							<p class="kicker">
								{{ String(chapterIndex + 1).padStart(2, '0') }} / {{ chapter.day === 0 ? $t('page.travels.editorial.departure') : $t('page.travels.editorial.day', { n: chapter.day }) }}
							</p>
							<h2><span>{{ titleParts(chapter.title)[0] }}</span><span v-if="titleParts(chapter.title)[1]" class="chapter-title-sub">{{ titleParts(chapter.title)[1] }}</span></h2>
							<div class="chapter-prose">
								<p v-for="text, index in chapter.descriptions" :key="index">
									{{ text }}
								</p>
							</div>
							<div class="chapter-summary">
								<span>{{ $t('page.travels.tripPhotos', { n: chapter.photos.length }) }}</span>
								<button v-if="chapter.photos.length" class="chapter-read" @click="navigate(`photo-${chapter.photos[0]!.index}`)">
									{{ $t('page.travels.editorial.readPhotos') }} <span aria-hidden="true">↓</span>
								</button>
							</div>
							<TravelEditorialMapDetail v-if="!viewerOpen && expandedMap === `chapter-${chapterIndex}`" :map-key="`chapter-${chapterIndex}`" :title="chapter.label" @collapse="closeMap" />
						</header>
					</div>
				</div>
				<div v-for="photo in chapter.photos" :id="`photo-${photo.index}`" :key="photo.index" class="reading-step" :data-node="`photo-${photo.index}`" :class="{ 'is-current': activeNode === `photo-${photo.index}` }">
					<div class="reading-stage">
						<TravelEditorialMapPeek v-if="hasTravelCoordinates(photo)" class="reading-map" :map-key="`photo-${photo.index}`" :title="photo.alt" :interactive="false" />
						<figure class="story-photo" :class="{ portrait: photoPortrait(photo.src), active: focusedIndex === photo.index }">
							<div>
								<div class="photo-composition">
									<TravelEditorialPhoto :photo :index="photo.index" :active="!viewerOpen && focusedIndex === photo.index" :interactive="!mobile" @open="openViewer(photo.index)" />
								</div>
								<TravelEditorialMapDetail v-if="!viewerOpen && expandedMap === `photo-${photo.index}`" :map-key="`photo-${photo.index}`" :title="photo.alt" @collapse="closeMap" />
							</div>
							<figcaption>
								<span class="photo-number"><span>{{ String(photo.index + 1).padStart(2, '0') }}<span v-if="photoPortrait(photo.src)" class="number-context"> / {{ chapter.label }}</span></span></span>
								<div class="photo-notes">
									<div class="photo-heading" :class="{ 'has-map': hasTravelCoordinates(photo) && expandedMap !== `photo-${photo.index}` }">
										<div class="photo-heading-text">
											<h3 class="photo-title">
												<span>{{ photo.alt }}</span>
											</h3>
											<button v-if="hasTravelCoordinates(photo) && !mobile" class="photo-place" @click="openMap(`photo-${photo.index}`)">
												<TravelEditorialIcon /><span>{{ travelCoordinateLabel(photo) }}</span>
											</button>
											<p v-else-if="hasTravelCoordinates(photo)" class="photo-place">
												<TravelEditorialIcon /><span>{{ travelCoordinateLabel(photo) }}</span>
											</p>
										</div>
									</div>
									<p v-if="photo.caption" class="photo-caption">
										<span>{{ photo.caption }}</span>
									</p>
								</div>
							</figcaption>
						</figure>
					</div>
				</div>
			</section>
			<footer class="end">
				<p>{{ travel.ending ?? $t('page.travels.theEnd') }}</p><button class="mode-button" @click="navigate('intro')">
					{{ $t('page.travels.editorial.returnOpening') }} ↑
				</button>
			</footer>
		</div>
	</main>
	<TravelEditorialScrollPerf v-if="scrollPerfEnabled" :target="scroller" />
	<svg class="connector" aria-hidden="true"><template v-if="connector"><path :d="connector.path" /><circle :cx="connector.x" :cy="connector.y" r="1.8" /></template></svg>
	<dialog ref="viewer" class="viewer" :data-dimmed="viewerDimmed" :aria-labelledby="viewerOpen ? 'travel-viewer-title' : undefined" :aria-busy="viewerClosing" @cancel.prevent="closeViewer" @close="closeViewer">
		<TravelEditorialViewer v-if="viewerOpen && viewerPhoto" ref="lightbox" :photo="viewerPhoto" :index="viewerIndex" :total="photos.length" :chapter="chapters[viewerPhoto.chapter]?.label ?? ''" :closing="viewerClosing" @close="closeViewer" @step="stepViewer" />
	</dialog>
</div>
</template>
