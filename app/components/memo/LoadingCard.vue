<script setup lang="ts">
import type { ParsedMemo } from '~/utils/memo'

const props = defineProps<{
	memo?: ParsedMemo
	index: number
	viewerReactions?: string[]
}>()
const emit = defineEmits<{ morphing: [active: boolean] }>()
const slot = useTemplateRef('slot')
const content = useTemplateRef('content')
const skeleton = useTemplateRef('skeleton')
const startedFromSkeleton = !props.memo
const showSkeleton = ref(startedFromSkeleton)
const morphing = ref(false)
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
let animations: Animation[] = []
let heightAnimation: Animation | undefined
let targetHeight = 0
let generation = 0

function settle() {
	generation++
	animations.splice(0).forEach(animation => animation.cancel())
	heightAnimation = undefined
	showSkeleton.value = false
	if (morphing.value) {
		morphing.value = false
		emit('morphing', false)
	}
}

watch(() => props.memo, async (memo, previous) => {
	if (!memo || previous)
		return
	const beforeHeight = slot.value?.getBoundingClientRect().height
	if (!beforeHeight || reducedMotion.value) {
		settle()
		return
	}
	const run = ++generation
	morphing.value = true
	emit('morphing', true)
	await nextTick()
	if (run !== generation || !slot.value || !content.value || !skeleton.value)
		return
	targetHeight = content.value.offsetHeight
	const timing = { duration: 560, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' as const }
	heightAnimation = slot.value.animate([
		{ height: `${beforeHeight}px` },
		{ height: `${targetHeight}px` },
	], timing)
	animations = [
		heightAnimation,
		skeleton.value.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'both' }),
		content.value.animate([
			{ opacity: 0, offset: 0 },
			{ opacity: 0, offset: 0.15 },
			{ opacity: 1, offset: 1 },
		], timing),
	]
	await Promise.allSettled(animations.map(animation => animation.finished))
	if (run === generation)
		settle()
})

// Counts and touch controls can settle after the memo body mounts. Retarget the
// remaining height travel from its current position, then release back to auto.
useResizeObserver(content, () => {
	if (!morphing.value || !heightAnimation || !content.value || !slot.value)
		return
	const nextHeight = content.value.offsetHeight
	if (Math.abs(nextHeight - targetHeight) < 1)
		return
	const currentHeight = slot.value.getBoundingClientRect().height
	targetHeight = nextHeight
	const effect = heightAnimation.effect as KeyframeEffect
	const remaining = Math.max(180, Number(effect.getTiming().duration) - Number(heightAnimation.currentTime ?? 0))
	effect.setKeyframes([{ height: `${currentHeight}px` }, { height: `${nextHeight}px` }])
	effect.updateTiming({ duration: remaining })
	heightAnimation.currentTime = 0
})
useEventListener('resize', () => {
	if (morphing.value)
		settle()
})
watch(reducedMotion, (reduced) => {
	if (reduced && morphing.value)
		settle()
})
onBeforeUnmount(settle)
</script>

<template>
<li
	ref="slot"
	class="memo-loading-card"
	:data-loading="!memo || undefined"
	:data-morphing="morphing || undefined"
	:data-native-entered="startedFromSkeleton ? '' : undefined"
	:inert="morphing || undefined"
>
	<div v-if="showSkeleton" ref="skeleton" class="memo-placeholder" :class="`memo-placeholder-${index % 3}`" aria-hidden="true">
		<div class="skeleton-ink">
			<span class="skeleton-date" />
			<span class="skeleton-line" />
			<span class="skeleton-line" />
			<span v-if="index % 3 === 1" class="skeleton-line" />
		</div>
	</div>
	<div v-if="memo" ref="content" class="memo-slot-content">
		<MemoCard v-bind="memo" tag="div" :viewer-reactions />
	</div>
</li>
</template>

<style scoped>
.memo-loading-card {
	position: relative;
	margin-bottom: 1rem;
	border-radius: 8px;
	box-shadow: 0 0 0 1px var(--c-bg-soft);
	animation: var(--entrance, float-in 0.3s backwards);
	animation-delay: var(--delay);

	&[data-morphing] {
		overflow: clip;

		> .memo-placeholder {
			position: absolute;
			inset: 0;
		}

		> .memo-slot-content {
			opacity: 0;
		}
	}
}

.memo-slot-content {
	:deep(.memo) {
		margin-bottom: 0;
		box-shadow: none;
		animation: none;
	}
}

.memo-placeholder {
	padding: 1rem;

	&.memo-placeholder-1 .skeleton-line:last-child {
		width: 43%;
	}

	&.memo-placeholder-2 .skeleton-line:last-child {
		width: 53%;
	}
}

.skeleton-ink {
	padding: 0.5rem 0;
	animation: memo-skeleton-breathe 2.4s ease-in-out infinite;

	> span {
		display: block;
		height: 0.5rem;
		border-radius: 2px;
		background-color: var(--c-bg-soft);
	}

	> .skeleton-date {
		width: 4rem;
		height: 0.35rem;
		margin-bottom: 1.5rem;
	}

	> .skeleton-line {
		width: 94%;
		margin-top: 0.8rem;

		&:last-child {
			width: 67%;
		}
	}
}

@keyframes memo-skeleton-breathe {
	0%, 100% { opacity: 0.45; }
	50% { opacity: 0.9; }
}

@media (prefers-reduced-motion: reduce) {
	.memo-loading-card, .skeleton-ink {
		animation: none;
	}
}
</style>
