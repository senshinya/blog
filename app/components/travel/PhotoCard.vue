<script setup lang="ts">
import type { TravelPhoto } from '~/types/travel'
import { LazyPopoverLightbox } from '#components'

// 组件名特意不叫 TravelPhoto：那会和 ~/types/travel 里的 TravelPhoto 类型撞名，
// 而详情页两者都要用（模板里用组件、script 里用类型）
const props = defineProps<{
	photo: TravelPhoto
}>()

const emit = defineEmits<{
	focus: []
}>()

const pic = useTemplateRef<HTMLImageElement>('pic')
const modalStore = useModalStore()

// 不用 useLightbox()：它只把 alt 当图注透传，而游记照片的 caption 是另一段更长的
// 文字。仿 content/Pic.vue 直接用 modalStore，才能把 caption 送进灯箱。
const { open } = modalStore.use(
	() => h(LazyPopoverLightbox, {
		el: unrefElement(pic)!,
		caption: props.photo.caption || props.photo.alt,
	}),
	{ unique: true },
)

function onClick() {
	emit('focus')
	open()
}
</script>

<template>
<li class="travel-photo">
	<img
		ref="pic"
		:src="photo.src"
		:alt="photo.alt"
		loading="lazy"
		@click="onClick"
	>
	<span v-if="photo.alt" class="travel-photo-alt">{{ photo.alt }}</span>
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
