<script setup lang="ts">
import type { UtilImgProps } from '../util/Img.vue'

const props = defineProps<UtilImgProps>()

const pic = useTemplateRef<HTMLImageElement>('pic')
const openLightbox = useLightbox()

/**
 * 正文的 Markdown 图片写不出宽高（37 张里一张都没有），于是加载完成的那一刻会把下文顶开 ——
 * 这是真实的 CLS。从预生成的 image-meta 里把原始宽高补回来：有了 width/height 属性，
 * 配上 article.scss 的 `img { height: auto; max-width: 100% }`，浏览器就能在图到位之前
 * 按内在比例把位置占好。
 *
 * 作者若在 Markdown 里显式写了 {width=… height=…}，以作者写的为准。
 */
const meta = computed(() => getImgMeta(props.src))
const width = computed(() => props.width ?? meta.value?.w)
const height = computed(() => props.height ?? meta.value?.h)

/** 位置占好之后别开天窗：图到位前先渲一层由三个主色糊成的渐变，见 assets/css/lqip.css */
const lqip = computed(() => getLqipStyle(props.src))

/**
 * 正文栏宽约 800px，取 2x。CF 默认 fit=scale-down，本来就窄的截图不会被放大。
 *
 * 注意灯箱：BikariyaImageViewer 是把页面上这个 <img> 元素本身放大，不会另去取原图 ——
 * 所以这个宽度同时也是灯箱能看到的上限。1920 是「别让 6016×3384 的截图拖垮首屏」
 * 和「放大后还看得清」之间的折中，要更清晰就调大它。
 */
const src = computed(() => getCfImgUrl(props.src, 1920))

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
	:style="lqip"
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
