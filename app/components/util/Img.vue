<script setup lang="ts">
import { joinURL, withLeadingSlash, withTrailingSlash } from 'ufo'
import ImageComponent from '#build/mdc-image-component.mjs'

export interface UtilImgProps {
	src: string
	width?: string | number
	height?: string | number
	alt?: string
	densities?: string
	responsive?: boolean
	sizes?: string
	loading?: 'lazy' | 'eager'
	decoding?: 'async' | 'sync' | 'auto'
	mirror?: ImgService
	filter?: string
}

const props = withDefaults(defineProps<UtilImgProps>(), {
	alt: '',
})

const src = computed(() => {
	if (props.src.startsWith('/') && !props.src.startsWith('//')) {
		const _base = withLeadingSlash(withTrailingSlash(useRuntimeConfig().app.baseURL))
		if (_base !== '/' && !props.src.startsWith(_base))
			return joinURL(_base, props.src)
	}
	if (props.mirror)
		return getImgUrl(props.src, props.mirror)
	return props.src
})
const responsiveSource = computed(() => props.responsive ? responsiveImage(src.value, getImgMeta(props.src)?.w) : undefined)
const intrinsicWidth = computed(() => props.width ?? getImgMeta(props.src)?.w)
const intrinsicHeight = computed(() => props.height ?? getImgMeta(props.src)?.h)
</script>

<template>
<img
	v-if="responsive"
	:src="responsiveSource?.src"
	:srcset="responsiveSource?.srcset"
	:sizes :alt :loading :decoding
	:width="intrinsicWidth" :height="intrinsicHeight"
	:style="{ filter }"
	:referrerpolicy="mirror ? 'no-referrer' : undefined"
>
<component
	:is="ImageComponent"
	v-else
	:src :alt :width :height :densities :sizes :loading :decoding
	:style="{ filter }"
	:referrerpolicy="mirror ? 'no-referrer' : undefined"
/>
</template>
