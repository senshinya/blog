<script setup lang="ts">
// 归档页是纯文字索引，每篇文章本来就有封面（首页卡片在用），只是这里一张都没露。
// 指针停在某一行时，让封面跟着浮出来 —— 只在指针设备上，且只在 hover 期间存在，
// 静止状态的版面不增加任何视觉重量。

/** 与 CSS 中的尺寸保持一致，用于边界翻转。 */
const WIDTH = 220
const HEIGHT = 138
/** 与视口边缘的最小留白。 */
const EDGE = 12
/** 与指针的间距。封面落在指针右下方，被悬停的那一行始终可读。 */
const GAP_X = 24
const GAP_Y = 18
/** 阻尼系数：越小跟得越慢，磁性感来自这里。 */
const LERP = 0.18

const root = useTemplateRef('root')
const card = useTemplateRef('card')
const src = ref('')
const visible = ref(false)
const reducedMotion = usePreferredReducedMotion()

/** 目标坐标与当前坐标，差值每帧收拢。 */
let targetX = 0
let targetY = 0
let currentX = 0
let currentY = 0
let raf = 0
let finePointer = false

onMounted(() => {
	// 触摸屏没有"悬停"这个状态，整套机制直接不启用。
	finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
})

onBeforeUnmount(stop)

function enabled() {
	return finePointer && reducedMotion.value !== 'reduce'
}

function frame() {
	currentX += (targetX - currentX) * LERP
	currentY += (targetY - currentY) * LERP
	if (card.value)
		card.value.style.translate = `${Math.round(currentX)}px ${Math.round(currentY)}px`
	raf = requestAnimationFrame(frame)
}

function stop() {
	cancelAnimationFrame(raf)
	raf = 0
}

function aim(event: PointerEvent) {
	// 两个轴都是"优先放在指针的右下方，放不下就翻到另一侧"。
	// 不能用居中对齐后再收拢：那样封面必定压住正在被预览的那一行，读不到标题。
	const right = event.clientX + GAP_X
	targetX = right + WIDTH + EDGE <= window.innerWidth
		? right
		: Math.max(EDGE, event.clientX - GAP_X - WIDTH)

	const below = event.clientY + GAP_Y
	targetY = below + HEIGHT + EDGE <= window.innerHeight
		? below
		: Math.max(EDGE, event.clientY - GAP_Y - HEIGHT)
}

function onPointerMove(event: PointerEvent) {
	if (!enabled())
		return

	const cover = (event.target as Element | null)?.closest<HTMLElement>('[data-cover]')?.dataset.cover
	// 没有封面的条目（image 未填）落到这里，等同于移出列表。
	if (!cover) {
		hide()
		return
	}

	aim(event)

	if (!visible.value) {
		src.value = cover
		// 首次出现直接就位，不从上一次离开的位置滑过来。
		currentX = targetX
		currentY = targetY
		if (card.value)
			card.value.style.translate = `${currentX}px ${currentY}px`
		visible.value = true
		raf ||= requestAnimationFrame(frame)
	}
	else if (src.value !== cover) {
		// 换行时保留旧图直到新图解码完成，避免中间闪一帧空白。
		src.value = cover
	}
}

function hide() {
	if (!visible.value)
		return
	visible.value = false
	stop()
}
</script>

<template>
<div ref="root" @pointermove="onPointerMove" @pointerleave="hide">
	<slot />

	<!-- 挂到 body：祖先链上的 mask-image / contain: paint 会夺走 fixed 的包含块 -->
	<ClientOnly>
		<Teleport to="body">
			<div ref="card" class="archive-preview" :class="{ show: visible }" aria-hidden="true">
				<UtilImg v-if="src" responsive sizes="220px" loading="lazy" decoding="async" :src alt="" />
			</div>
		</Teleport>
	</ClientOnly>
</div>
</template>

<!-- eslint-disable-next-line vue/enforce-style-attribute -->
<style>
/* translate 由脚本每帧写入，scale/opacity 交给 CSS —— 两者是独立属性，不会互相覆盖。 */
.archive-preview {
	contain: paint;
	position: fixed;
	opacity: 0;
	inset-block-start: 0;
	inset-inline-start: 0;
	width: 220px;
	height: 138px;
	border-radius: 0.5em;
	box-shadow: var(--box-shadow-3);
	background-color: var(--c-bg-2);
	transition: opacity var(--motion-fade-duration) var(--motion-easing), scale var(--motion-fade-duration) var(--motion-easing);
	scale: 0.96;
	pointer-events: none;
	z-index: calc(var(--z-index-popover) - 2);

	&.show {
		opacity: 1;
		scale: 1;
	}

	> img {
		display: block;
		width: 100%;
		height: 100%;
		/* 图片自持深度，又不改变布局尺寸。 */
		outline: 1px solid var(--c-bg-soft);
		outline-offset: -1px;
		object-fit: cover;
	}
}

/* 触摸设备与降低动效下整套机制不启用，这里一并保证不可见。 */
@media (prefers-reduced-motion: reduce), (hover: none), (pointer: coarse) {
	.archive-preview {
		display: none;
	}
}
</style>
