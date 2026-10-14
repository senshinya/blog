<script setup lang="ts">
import type { StoryPhoto } from '../../../utils/travelStory'
import type { ViewerCaptionRects, ViewerPose, ViewerRect, ViewerSize } from './viewer-geometry'
import { hasTravelCoordinates, travelCoordinateLabel } from '../../../utils/travelStory'
import { clampViewerPose, fitViewerImage, pinchViewerAt, viewerMorph, viewerSwipe, zoomViewerAt } from './viewer-geometry'

const props = withDefaults(defineProps<{ photo: StoryPhoto, index: number, total: number, chapter: string, closing?: boolean }>(), { closing: false })
const emit = defineEmits<{ close: [], step: [delta: number] }>()
const { t } = useI18n()
const stage = useTemplateRef<HTMLElement>('stage')
const photograph = useTemplateRef<HTMLElement>('photograph')
const previewImage = useTemplateRef<HTMLImageElement>('previewImage')
const originalImage = useTemplateRef<HTMLImageElement>('originalImage')
const captionTitle = useTemplateRef<HTMLElement>('captionTitle')
const captionPlace = useTemplateRef<HTMLElement>('captionPlace')
const captionDescription = useTemplateRef<HTMLElement>('captionDescription')
const reduced = usePreferredReducedMotion()
const mobile = useMediaQuery('(max-width: 700px)')
const stageSize = ref<ViewerSize>({ width: 1200, height: 800 })
const naturalSize = ref<ViewerSize | null>(null)
const pose = ref<ViewerPose>({ scale: 1, x: 0, y: 0 })
const dragging = ref(false)
const entering = ref(false)
const notesReady = ref(false)
const originalRequested = ref(false)
const originalReady = ref(false)
const swipeOffset = ref(0)
const movingPhoto = computed(() => Boolean(props.photo.live || props.photo.video))
const imageSize = computed(() => {
	const meta = getImgMeta(props.photo.src)
	return meta ? { width: meta.w, height: meta.h } : naturalSize.value ?? { width: 1200, height: 800 }
})
const fitted = computed(() => fitViewerImage(imageSize.value, { width: Math.max(1, stageSize.value.width - (mobile.value ? 24 : 112)), height: Math.max(1, stageSize.value.height - 24) }))
const photoStyle = computed(() => ({ width: `${fitted.value.width}px`, height: `${fitted.value.height}px`, transform: `translate3d(${pose.value.x + swipeOffset.value}px, ${pose.value.y}px, 0) scale(${pose.value.scale})` }))
const pointers = new Map<number, { x: number, y: number }>()
let gesture: { x: number, y: number, lastX: number, lastY: number, onPhoto: boolean, pinched: boolean } | undefined
let pinch: { distance: number, center: { x: number, y: number }, pose: ViewerPose } | undefined
let lastTap: { time: number, x: number, y: number } | undefined
let observer: ResizeObserver | undefined
const motions = new Set<Animation>()
let disposed = false

function measure() {
	if (!stage.value?.clientWidth || !stage.value.clientHeight)
		return
	stageSize.value = { width: stage.value.clientWidth, height: stage.value.clientHeight }
	pose.value = clampViewerPose(pose.value, fitted.value, stageSize.value)
}
function pointInStage(x: number, y: number) {
	const box = stage.value!.getBoundingClientRect()
	return { x: x - box.left, y: y - box.top }
}
function zoomTo(scale: number, point = { x: stageSize.value.width / 2, y: stageSize.value.height / 2 }) {
	if (movingPhoto.value || props.closing || entering.value)
		return
	pose.value = zoomViewerAt(pose.value, scale, point, fitted.value, stageSize.value)
	if (pose.value.scale > 1.01)
		originalRequested.value = true
}
function toggleZoom(point = { x: stageSize.value.width / 2, y: stageSize.value.height / 2 }) {
	zoomTo(pose.value.scale > 1.01 ? 1 : 2, point)
}
function pointerDown(event: PointerEvent) {
	if (props.closing || entering.value || movingPhoto.value || event.button > 0 || (event.target as Element).closest('button'))
		return
	const matrix = new DOMMatrix(getComputedStyle(photograph.value!).transform)
	pose.value = { scale: matrix.a, x: matrix.e, y: matrix.f }
	swipeOffset.value = 0
	const point = { x: event.clientX, y: event.clientY }
	pointers.set(event.pointerId, point)
	stage.value?.setPointerCapture(event.pointerId)
	dragging.value = true
	if (pointers.size === 1) {
		gesture = { x: point.x, y: point.y, lastX: point.x, lastY: point.y, onPhoto: photograph.value!.contains(event.target as Node), pinched: false }
	}
	else if (pointers.size === 2) {
		const [a, b] = [...pointers.values()]
		pinch = { distance: Math.max(1, Math.hypot(a!.x - b!.x, a!.y - b!.y)), center: pointInStage((a!.x + b!.x) / 2, (a!.y + b!.y) / 2), pose: { ...pose.value } }
		if (gesture)
			gesture.pinched = true
	}
}
function pointerMove(event: PointerEvent) {
	if (!pointers.has(event.pointerId) || !gesture)
		return
	pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
	if (pointers.size >= 2 && pinch) {
		const [a, b] = [...pointers.values()]
		const center = pointInStage((a!.x + b!.x) / 2, (a!.y + b!.y) / 2)
		const scale = pinch.pose.scale * Math.hypot(a!.x - b!.x, a!.y - b!.y) / pinch.distance
		pose.value = pinchViewerAt(pinch.pose, scale, pinch.center, center, fitted.value, stageSize.value)
		if (pose.value.scale > 1.01)
			originalRequested.value = true
	}
	else if (pose.value.scale > 1.01) {
		pose.value = clampViewerPose({ ...pose.value, x: pose.value.x + event.clientX - gesture.lastX, y: pose.value.y + event.clientY - gesture.lastY }, fitted.value, stageSize.value)
	}
	else if (event.pointerType === 'touch') {
		swipeOffset.value = Math.max(-70, Math.min(70, (event.clientX - gesture.x) * 0.35))
	}
	gesture.lastX = event.clientX
	gesture.lastY = event.clientY
}
function pointerEnd(event: PointerEvent) {
	if (!pointers.has(event.pointerId))
		return
	pointers.delete(event.pointerId)
	if (pointers.size) {
		const next = [...pointers.values()][0]!
		if (gesture) {
			gesture.lastX = next.x
			gesture.lastY = next.y
		}
		pinch = undefined
		return
	}
	dragging.value = false
	swipeOffset.value = 0
	if (gesture && !gesture.pinched && event.type !== 'pointercancel') {
		const dx = event.clientX - gesture.x
		const dy = event.clientY - gesture.y
		const swipe = event.pointerType === 'touch' ? viewerSwipe(dx, dy, pose.value.scale) : 0
		if (swipe) {
			emit('step', swipe)
		}
		else if (Math.hypot(dx, dy) < 6) {
			if (!gesture.onPhoto) {
				emit('close')
			}
			else if (event.pointerType === 'touch') {
				const now = performance.now()
				if (lastTap && now - lastTap.time < 300 && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 24) {
					toggleZoom(pointInStage(event.clientX, event.clientY))
					lastTap = undefined
				}
				else {
					lastTap = { time: now, x: event.clientX, y: event.clientY }
				}
			}
			else {
				toggleZoom(pointInStage(event.clientX, event.clientY))
			}
		}
	}
	gesture = undefined
	pinch = undefined
}
function pointerLost(event: PointerEvent) {
	if (!pointers.has(event.pointerId))
		return
	pointers.clear()
	gesture = undefined
	pinch = undefined
	dragging.value = false
	swipeOffset.value = 0
}
function wheel(event: WheelEvent) {
	if (movingPhoto.value)
		return
	event.preventDefault()
	const unit = event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? stageSize.value.height : 1
	zoomTo(pose.value.scale * Math.exp(-event.deltaY * unit * 0.002), pointInStage(event.clientX, event.clientY))
}
function loaded(event: Event) {
	const image = event.target as HTMLImageElement
	if (disposed || image !== previewImage.value || !image.isConnected || image.dataset.photoIndex !== String(props.index))
		return
	if (!getImgMeta(props.photo.src)) {
		naturalSize.value = { width: image.naturalWidth, height: image.naturalHeight }
	}
}
function originalLoaded(event: Event) {
	const image = event.target as HTMLImageElement
	if (disposed || image !== originalImage.value || !image.isConnected || image.dataset.photoIndex !== String(props.index) || image.getAttribute('src') !== props.photo.src || !originalRequested.value)
		return
	originalReady.value = true
}
function blankClick(event: MouseEvent) {
	if (props.closing || entering.value || event.defaultPrevented)
		return
	const target = event.target as Element
	if (target.closest('.lightbox-photo,.lightbox-info,button,a,.viewer-count'))
		return
	// Still-photo stage clicks belong to the pointer gesture, including drag capture.
	if (!movingPhoto.value && target.closest('.lightbox-stage'))
		return
	emit('close')
}

function cancelMotions() {
	for (const motion of motions)
		motion.cancel()
	motions.clear()
}
async function animate(keyframes: Keyframe[], element = photograph.value, persist = false) {
	if (disposed || reduced.value === 'reduce' || !element)
		return
	const style = getComputedStyle(element)
	const duration = Number.parseFloat(style.getPropertyValue('--photo-morph-duration'))
	const easing = style.getPropertyValue('--photo-morph-easing').trim() || 'cubic-bezier(.22,1,.36,1)'
	const current = element.animate(keyframes, { duration: Number.isFinite(duration) ? duration : 280, easing, fill: 'both' })
	motions.add(current)
	try {
		await current.finished
	}
	catch { /* A new photograph or route can interrupt the motion. */ }
	if (!persist) {
		motions.delete(current)
		current.cancel()
	}
}
function motionStyle(element: HTMLElement | null) {
	if (!element)
		return undefined
	const style = getComputedStyle(element)
	return { transform: style.transform, opacity: Number(style.opacity || 1) }
}
function captionMotions(rects: ViewerCaptionRects | undefined, opening: boolean, from?: Partial<Record<keyof ViewerCaptionRects, { transform: string, opacity: number }>>) {
	const captions = { title: captionTitle.value, place: captionPlace.value, description: captionDescription.value }
	return Promise.all((Object.keys(captions) as (keyof ViewerCaptionRects)[]).map((key) => {
		const element = captions[key]
		if (!element)
			return Promise.resolve()
		const box = element.getBoundingClientRect()
		const source = rects?.[key]
		const transform = source ? `translate3d(${source.left - box.left}px, ${source.top - box.top}px, 0)` : 'translate3d(0, 24px, 0)'
		const frames = opening
			? [{ transform, opacity: 0.35 }, { transform: 'none', opacity: 1 }]
			: [{ ...from?.[key] ?? { transform: 'none', opacity: 1 } }, { transform, opacity: 0 }]
		return animate(frames, element, true)
	}))
}
async function enter(origin?: ViewerRect, notes?: ViewerCaptionRects) {
	cancelMotions()
	entering.value = true
	measure()
	await nextTick()
	if (disposed)
		return
	const image = origin && photograph.value
		? animate([{ transform: viewerMorph(origin, photograph.value.getBoundingClientRect()), opacity: 1 }, { transform: 'none', opacity: 1 }])
		: Promise.resolve()
	const captions = captionMotions(notes, true)
	notesReady.value = true
	await Promise.all([image, captions])
	entering.value = false
}
async function leave(target?: ViewerRect, notes?: ViewerCaptionRects) {
	if (disposed || !photograph.value || !stage.value)
		return
	const currentPhoto = motionStyle(photograph.value)!
	const currentNotes = { title: motionStyle(captionTitle.value), place: motionStyle(captionPlace.value), description: motionStyle(captionDescription.value) }
	cancelMotions()
	const box = stage.value.getBoundingClientRect()
	const fit = fitted.value
	const base = { left: box.left + (box.width - fit.width) / 2, top: box.top + (box.height - fit.height) / 2, width: fit.width, height: fit.height }
	const image = target
		? animate([currentPhoto, { transform: viewerMorph(target, base), opacity: 1 }], photograph.value, true)
		: Promise.resolve()
	await Promise.all([image, captionMotions(notes, false, currentNotes)])
}

watch(() => props.index, async (_index, previous) => {
	cancelMotions()
	pose.value = { scale: 1, x: 0, y: 0 }
	naturalSize.value = null
	originalRequested.value = false
	originalReady.value = false
	swipeOffset.value = 0
	pointers.clear()
	gesture = undefined
	pinch = undefined
	lastTap = undefined
	dragging.value = false
	await nextTick()
	if (disposed)
		return
	measure()
	if (previous !== undefined)
		await Promise.all([animate([{ opacity: 0.35 }, { opacity: 1 }]), captionMotions(undefined, true)])
})
onMounted(() => {
	observer = new ResizeObserver(measure)
	if (stage.value)
		observer.observe(stage.value)
	measure()
})
onScopeDispose(() => {
	disposed = true
	cancelMotions()
	observer?.disconnect()
	pointers.clear()
})
defineExpose({ enter, leave })
</script>

<template>
<div class="lightbox" :class="{ 'is-zoomed': pose.scale > 1.01, 'is-dragging': dragging, 'is-closing': closing, 'is-morphing': entering || closing }" :data-zoom="pose.scale.toFixed(2)" @click="blankClick">
	<header class="lightbox-header">
		<p class="viewer-count">
			{{ chapter }} · {{ index + 1 }} / {{ total }}
		</p>
		<div class="lightbox-actions">
			<button class="icon-button" :disabled="closing" :aria-label="t('page.travels.closeViewer')" @click="emit('close')">
				<TravelEditorialIcon name="close" />
			</button>
		</div>
	</header>
	<div class="lightbox-content" :style="{ '--photo-ratio': `${imageSize.width} / ${imageSize.height}` }">
		<div ref="stage" class="lightbox-stage" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerEnd" @pointercancel="pointerEnd" @lostpointercapture="pointerLost" @wheel="wheel">
			<div ref="photograph" class="lightbox-photo" :style="photoStyle">
				<TravelEditorialPhoto v-if="movingPhoto" :photo viewer />
				<template v-else>
					<img :key="index" ref="previewImage" class="lightbox-preview" :data-photo-index="index" :src="getTravelImg(photo.src, TravelImgWidth.viewer)" :alt="photo.alt" :width="imageSize.width" :height="imageSize.height" draggable="false" decoding="async" :style="getLqipStyle(photo.src)" @load="loaded">
					<img v-if="originalRequested" :key="index" ref="originalImage" class="lightbox-original" :data-photo-index="index" :class="{ ready: originalReady }" :src="photo.src" alt="" aria-hidden="true" :width="imageSize.width" :height="imageSize.height" draggable="false" decoding="async" @load="originalLoaded">
				</template>
			</div>
		</div>
		<aside class="lightbox-info" :class="{ 'notes-ready': notesReady }" tabindex="0" aria-labelledby="travel-viewer-title">
			<div class="lightbox-caption">
				<h2 id="travel-viewer-title" ref="captionTitle">
					<span>{{ photo.alt }}</span>
				</h2>
				<p v-if="hasTravelCoordinates(photo)" ref="captionPlace" class="lightbox-place">
					<span>{{ travelCoordinateLabel(photo) }}</span>
				</p>
				<p v-if="photo.caption" ref="captionDescription" class="lightbox-description">
					<span>{{ photo.caption }}</span>
				</p>
			</div>
		</aside>
	</div>
</div>
</template>
