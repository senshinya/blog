<script setup lang="ts">
import type { UtilImgProps } from '../util/Img.vue'

defineProps<UtilImgProps>()

const pic = useTemplateRef<HTMLImageElement>('pic')
const openLightbox = useLightbox()

function zoom() {
	const el = unrefElement(pic)
	if (el)
		openLightbox(el)
}
</script>

<template>
<!--
	markdown 的图片会被 <p> 包裹。此处必须保持行内元素：
	若像 Pic.vue 那样包一层 <figure>，服务端渲染时 <p> 会在块级元素前自动闭合，
	导致水合不匹配。
-->
<UtilImg
	ref="pic"
	class="prose-img"
	:src :alt :width :height :mirror :filter :densities
	@click="zoom"
/>
</template>

<style lang="scss" scoped>
.prose-img {
	width: auto;

	// 竖构图的截图撑满栏宽后会高得离谱，故同时约束高度；原图交给灯箱看
	max-height: 60vh;
	border-radius: 0.5em;
	cursor: zoom-in;
}
</style>
