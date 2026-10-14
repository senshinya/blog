<script setup lang="ts">
import type { TravelPhoto } from '~/types/travel'
import LiveControl from './LiveControl.vue'

const props = withDefaults(defineProps<{ photo: TravelPhoto, index?: number, active?: boolean, eager?: boolean, viewer?: boolean, interactive?: boolean }>(), { index: 0, active: true, interactive: true })
defineEmits<{ open: [] }>()
const reduced = usePreferredReducedMotion()
const hovering = ref(false)
const liveReady = ref(false)
const liveMode = ref<'auto' | 'play' | 'stop'>('auto')
const livePlaying = computed(() => Boolean(props.active && props.photo.live && !props.photo.video && (liveMode.value === 'play' || (liveMode.value === 'auto' && reduced.value !== 'reduce' && (props.viewer || hovering.value)))))
const meta = computed(() => getImgMeta(props.photo.src))
const paperTilt = ref('0deg')
onMounted(() => {
	if (!props.eager && !props.viewer) {
		const direction = props.index % 2 === 0 ? -1 : 1
		paperTilt.value = `${(direction * (0.3 + Math.random() * 0.9)).toFixed(2)}deg`
	}
})
function enter(event: PointerEvent) {
	if (props.active && props.interactive && !props.viewer && event.pointerType === 'mouse' && reduced.value !== 'reduce')
		hovering.value = true
}
function leave() {
	hovering.value = false
	if (!livePlaying.value)
		liveReady.value = false
}
function toggleLive() {
	liveMode.value = livePlaying.value ? 'stop' : 'play'
}
function stopLive() {
	liveMode.value = 'stop'
	liveReady.value = false
}
function resetLive() {
	liveMode.value = 'auto'
	hovering.value = false
	liveReady.value = false
}
watch(() => props.active, (active) => {
	if (!active)
		resetLive()
})
watch(() => props.photo.src, resetLive)
watch(() => livePlaying.value, (playing) => {
	if (!playing)
		liveReady.value = false
})
</script>

<template>
<div v-if="viewer && photo.live && !photo.video" class="live-viewer">
	<video v-if="livePlaying" :key="photo.live" :src="photo.live" :poster="getTravelImg(photo.src, TravelImgWidth.viewer)" :width="meta?.w ?? 1200" :height="meta?.h ?? 800" :aria-label="photo.alt" muted loop autoplay playsinline preload="metadata" @error="stopLive" />
	<img v-else :src="getTravelImg(photo.src, TravelImgWidth.viewer)" :alt="photo.alt" :width="meta?.w ?? 1200" :height="meta?.h ?? 800" decoding="async">
	<LiveControl :playing="livePlaying" @toggle="toggleLive" />
</div>
<video
	v-else-if="viewer && photo.video"
	:key="photo.video ?? photo.live"
	:src="photo.video ?? photo.live"
	:poster="getTravelImg(photo.src, TravelImgWidth.viewer)"
	:width="meta?.w ?? 1200" :height="meta?.h ?? 800"
	:aria-label="photo.alt"
	:autoplay="reduced !== 'reduce'" :controls="Boolean(photo.video) || reduced === 'reduce'"
	:muted="!photo.video" :loop="!photo.video" playsinline preload="metadata"
/>
<img
	v-else-if="viewer || eager"
	:src="getTravelImg(photo.src, eager ? TravelImgWidth.cover : TravelImgWidth.viewer)"
	:alt="photo.alt" :width="meta?.w ?? 1200" :height="meta?.h ?? 800"
	loading="eager" :fetchpriority="eager ? 'high' : undefined" decoding="async"
	:style="eager ? undefined : getLqipStyle(photo.src)"
	:class="{ 'cover-image': eager }"
>
<div
	v-else class="photo-open" :class="{ 'photo-static': !interactive, 'photo-hovered': hovering }"
	:style="{ '--photo-tilt': paperTilt, '--photo-ratio': (meta?.w ?? 1200) / (meta?.h ?? 800) }"
	:data-open-label="interactive ? $t('page.travels.editorial.largePhoto') : undefined"
	@pointerenter="enter" @pointerleave="leave"
>
	<component :is="interactive ? 'button' : 'div'" class="photo-zoom" :aria-label="interactive ? $t('page.travels.editorial.openPhoto', { title: photo.alt }) : undefined" @click="interactive && $emit('open')">
		<picture class="photo-source">
			<source media="(max-width: 700px)" :srcset="getTravelImg(photo.src, TravelImgWidth.cover)">
			<img :src="getTravelImg(photo.src, TravelImgWidth.viewer)" :alt="photo.alt" :width="meta?.w ?? 1200" :height="meta?.h ?? 800" loading="lazy" decoding="async" :style="getLqipStyle(photo.src)">
		</picture>
	</component>
	<video
		v-if="livePlaying" :src="photo.live" :class="{ ready: liveReady }"
		muted loop autoplay playsinline preload="none" aria-hidden="true" @playing="liveReady = true" @error="stopLive"
	/>
	<LiveControl v-if="photo.live && !photo.video" :playing="livePlaying" @toggle="toggleLive" />
	<span v-else-if="photo.video" class="photo-motion" aria-hidden="true">▶</span>
</div>
</template>
