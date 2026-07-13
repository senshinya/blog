<script setup lang="ts">
import type { TravelPhoto } from '~/types/travel'

// 组件名特意不叫 TravelPhoto：那会和 ~/types/travel 里的 TravelPhoto 类型撞名，
// 而详情页两者都要用（模板里用组件、script 里用类型）
defineProps<{
	photo: TravelPhoto
}>()

// 只管当个缩略图，点开大图由详情页统一承载 ——
// 看图器要和右侧地图联动，得由知道「当前是哪一天、第几张」的那一层来管
defineEmits<{
	open: []
}>()
</script>

<template>
<li class="travel-photo">
	<!-- 盒子已由 aspect-ratio 预留，不会跳；--lqip 只是让空着的那一格别是块死灰 -->
	<img
		:src="getTravelImg(photo.src, TravelImgWidth.thumb)"
		:alt="photo.alt"
		loading="lazy"
		:style="getLqipStyle(photo.src)"
		@click="$emit('open')"
	>
	<!-- aria-hidden：这行字和 img 的 alt 是同一句，读屏会念两遍 -->
	<span v-if="photo.alt" class="travel-photo-alt" aria-hidden>{{ photo.alt }}</span>
</li>
</template>

<style lang="scss" scoped>
.travel-photo {
	position: relative;
	overflow: hidden;
	border-radius: 0.6rem;
	box-shadow: var(--box-shadow-1);
	background-color: var(--c-bg-2);
	transition: box-shadow var(--delay), transform var(--delay);

	&:hover {
		box-shadow: var(--box-shadow-3);
		transform: translateY(-0.15rem);

		> img {
			scale: 1.05;
		}

		> .travel-photo-alt {
			opacity: 1;
			translate: 0;
		}
	}

	> img {
		display: block;
		width: 100%;
		aspect-ratio: 4 / 3;
		transition: scale var(--delay);
		cursor: zoom-in;
		object-fit: cover;
	}
}

.travel-photo-alt {
	position: absolute;
	opacity: 0;
	inset-inline: 0;
	bottom: 0;
	padding: 1.5em 0.6em 0.5em;
	background: linear-gradient(transparent, #0009);
	font-size: 0.75rem;
	color: #FFF;
	transition: all var(--delay);
	translate: 0 0.3rem;
	pointer-events: none;

	// 触屏没有 hover，直接常显
	@media (hover: none) {
		opacity: 1;
		translate: 0;
	}
}
</style>
