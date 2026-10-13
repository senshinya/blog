<script setup lang="ts">
import type { TravelPhoto } from '~/types/travel'

const props = withDefaults(defineProps<{ photo: TravelPhoto, eager?: boolean, viewer?: boolean, interactive?: boolean }>(), { interactive: true })
defineEmits<{ open: [] }>()
const reduced = usePreferredReducedMotion()
const hovering = ref(false)
const liveReady = ref(false)
const meta = computed(() => getImgMeta(props.photo.src))
function enter(event: PointerEvent) {
	if (props.interactive && event.pointerType === 'mouse' && reduced.value !== 'reduce' && props.photo.live && !props.photo.video)
		hovering.value = true
}
function leave() {
	hovering.value = false
	liveReady.value = false
}
</script>

<template>
<video
	v-if="viewer && (photo.video || photo.live)"
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
<component
	:is="interactive ? 'button' : 'div'"
	v-else class="photo-open" :class="{ 'photo-static': !interactive }"
	:aria-label="interactive ? $t('page.travels.editorial.openPhoto', { title: photo.alt }) : undefined"
	:data-open-label="interactive ? $t('page.travels.editorial.largePhoto') : undefined"
	@pointerenter="enter" @pointerleave="leave" @blur="leave" @click="interactive && $emit('open')"
>
	<picture class="photo-source">
		<source media="(max-width: 700px)" :srcset="getTravelImg(photo.src, TravelImgWidth.cover)">
		<img
			:src="getTravelImg(photo.src, TravelImgWidth.viewer)"
			:alt="photo.alt" :width="meta?.w ?? 1200" :height="meta?.h ?? 800"
			loading="lazy" decoding="async" :style="getLqipStyle(photo.src)"
		>
	</picture>
	<video
		v-if="interactive && hovering" :src="photo.live" :class="{ ready: liveReady }"
		muted loop autoplay playsinline preload="none" aria-hidden="true" @playing="liveReady = true"
	/>
	<span v-if="interactive && (photo.live || photo.video)" class="photo-motion" aria-hidden="true">{{ photo.video ? '▶' : '◉' }}</span>
</component>
</template>
