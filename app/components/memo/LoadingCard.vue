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
/**
 * 骨架的每一块都摆在真卡片对应块的位置上（尺寸见 style 里的实测注释），
 * 所以换场是一块对一块地交叉淡化：同一时刻、同一位置，一出一进 ——
 * 看着是这块墨带变成了那行字，而不是整块骨架消失、另一块内容冒出来。
 *
 * 自上而下错开一点点，让「逐块落定」的先后读得出来。
 */
const MORPH_TRACKS: [skeleton: string, content: string][] = [
	['.skeleton-meta', '.memo-meta'],
	['.skeleton-lines', '.memo-content'],
	['.skeleton-foot', '.memo-foot'],
]

/** 第一步：把骨架撑到真内容的高度，长行程的上限 */
const GROW_MS = 460

/** 第一步的下限，与站上「浮现」那一档（.tail 的 0.3s）同速 */
const GROW_MIN_MS = 300

/** 第二步：逐块交接 */
const FADE_MS = 300

/** 交接自上而下错开这么久 */
const FADE_STEP = 55

/** 正文一行的高度，与 MemoBody 里正文的 line-height 同值 */
const LINE_HEIGHT = 25.6

let animations: Animation[] = []
let heightAnimation: Animation | undefined
let targetHeight = 0
let generation = 0

function settle() {
	generation++
	delete slot.value?.dataset.morphGrow
	slot.value?.style.removeProperty('--grow-ms')
	skeleton.value?.querySelector<HTMLElement>('.skeleton-lines')?.style.removeProperty('height')
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

	/**
	 * 换场分两步走。
	 *
	 * 第一步只动高度：骨架整块不动声色地撑到真内容那么高，多出来的行由
	 * .skeleton-lines 自己按正文行高补画（见 style）。
	 * 第二步才逐块交接，此时高度已经稳定。
	 *
	 * 之所以要分开：容器 overflow: clip。一行骨架换长正文那一档，底下的块在高度
	 * 追上来之前一直被裁着 —— 两件事一起做的话，页脚会在裁切线底下白亮一场，
	 * 等高度够了再啪地出现，中间那段两个页脚都不在。
	 *
	 * 高度本来就没怎么变的那一档（骨架与卡片等高，常态）没有第一步可言，直接交接。
	 */
	/**
	 * 第一步的时长跟着行程走：补一行与补十行不该同一个速度。
	 * 下限对齐站上「浮现」那一档（.tail 的 0.3s），上限给长行程留出余地。
	 *
	 * 阈值取一行的量级：骨架与卡片本就只差 1~2px（骨架是照真几何摆的），
	 * 为这点零头排一整个第一步不值得，直接进交接。
	 */
	const travel = targetHeight - beforeHeight
	const growMs = travel > 8 ? Math.min(GROW_MS, Math.max(GROW_MIN_MS, Math.round(travel * 1.6))) : 0
	// 补行只在真要长高时开（见 style 里的 [data-morph-grow]）
	if (growMs)
		slot.value.dataset.morphGrow = ''
	const timing = { duration: growMs, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' as const }
	heightAnimation = slot.value.animate([
		{ height: `${beforeHeight}px` },
		{ height: `${targetHeight}px` },
	], timing)
	animations = [heightAnimation]

	/**
	 * 补行按**整行**跳，不跟着容器高度连续长。
	 *
	 * 连续长的话，那条 0.72em 的墨带是从 0 一点点变厚的 —— 中途必然经过一两 px 的
	 * 厚度，看着是条分隔线而不是一行字。一行补两行那一档尤其明显，整段增高正好一行，
	 * 从头到尾都在看那条细线长厚。steps() 让它要么没有、要么就是完整一行。
	 */
	/**
	 * 行数一次补到位：骨架的正文块直接拿到它该有的高度，不做逐行冒出来的动画。
	 * 第一步于是只剩「卡片长高」一件事 —— 那些行是被长出来的卡片露出来的。
	 *
	 * 之所以能这么写：正文块是可压缩的（flex: 0 1 auto + overflow: hidden，见 style），
	 * 卡片还矮的时候它自己缩着、只露得出一行；卡片长开了就把整块让出来。
	 * 页脚始终排在它下面，于是一直贴着卡片底边走。
	 */
	const skeletonLines = skeleton.value.querySelector<HTMLElement>('.skeleton-lines')
	const realLines = content.value.querySelector('.memo-content')
	if (growMs && skeletonLines && realLines) {
		const base = skeletonLines.getBoundingClientRect().height
		// floor 宁可少补一行，也不越过真正文的高度 —— 段落之间还有段距，未必是行高的整数倍
		const extra = Math.max(0, Math.floor((realLines.getBoundingClientRect().height - base) / LINE_HEIGHT))
		if (extra)
			skeletonLines.style.height = `${base + extra * LINE_HEIGHT}px`
	}
	// 补行块的淡入时长跟第一步同步（见 style 的 memo-skeleton-fill）
	slot.value.style.setProperty('--grow-ms', `${growMs}ms`)
	// 一出一进走同一段时间：同一时刻、同一位置，那块地方的墨色不断档
	const cross = (el: Element, from: number, to: number, delay: number) => {
		animations.push(el.animate(
			[{ opacity: from }, { opacity: to }],
			{ duration: FADE_MS, delay, easing: 'ease-out', fill: 'both' },
		))
	}

	MORPH_TRACKS.forEach(([from, to], index) => {
		const delay = growMs + index * FADE_STEP
		const out = skeleton.value?.querySelector(from)
		const into = content.value?.querySelector(to)
		if (out)
			cross(out, 1, 0, delay)
		if (into)
			cross(into, 0, 1, delay)
	})

	// 图片与标签没有骨架对应物，跟正文那一拍一起进来
	content.value.querySelectorAll('.memo-images, .memo-tags').forEach((extra) => {
		cross(extra, 0, 1, growMs + FADE_STEP)
	})
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
			<!-- 下面每一块都对着 MemoBody / MemoCard 的实测几何摆，换成真卡片时各行原地不动 -->
			<div class="skeleton-meta">
				<span class="skeleton-avatar" />
				<span class="skeleton-who">
					<span class="skeleton-nick" />
					<span class="skeleton-date" />
				</span>
			</div>

			<!-- 只画一行。真卡片最矮的一档（单行正文）是 153.2，骨架 152 —— -->
			<!-- 骨架永远矮于内容，换场就只有「长」一个方向，不必处理缩回与多余行的裁切 -->
			<div class="skeleton-lines">
				<span class="skeleton-line" />
			</div>

			<!-- 页脚在真卡片上常驻，这里照着那两颗控件占位 -->
			<div class="skeleton-foot">
				<span class="skeleton-chip" />
				<span class="skeleton-act" />
			</div>
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

		/* 真有一段高度要补时，正文那块按正文行高把多出来的行画出来 —— 骨架先长到真内容 */
		/* 的行数，第二步交接时两边高度已经一致。高度没怎么变的那一档不画，否则剩下 */
		/* 那几 px 会被画成半条墨带，就是单行卡片底下那道细线。 */
		/* 7.04 / 18.56 / 25.6 是行盒 25.6 里那条 0.72em 墨带的上沿、下沿与行距 */
		/* 正文块的高度已由 JS 一次补到位，这里让它在卡片还矮的时候先缩着、多出来的裁掉 —— */
		/* 卡片长开多少就露出多少行，页脚始终排在它下面 */
		&[data-morph-grow] .skeleton-lines {
			flex: 0 1 auto;
			overflow: hidden;
			min-height: 0;
		}

		&[data-morph-grow] .skeleton-lines::after {
			content: "";
			flex: 1;
			width: 94%;
			min-height: 0;

			background-image:
				repeating-linear-gradient(
					transparent 0 7.04px,
					var(--c-bg-soft) 7.04px 18.56px,
					transparent 18.56px 25.6px
				);

			/* 这块的高度是跟着卡片连续长的，于是那条墨带必然从 0 一点点变厚 —— */
			/* 字不会由细变粗地长出来，看着就是一道硬生生的细线。 */
			/* 让它随第一步一起淡入：半厚的那一瞬同时是半透明的，不成其为线 */
			animation: memo-skeleton-fill var(--grow-ms, 340ms) ease-out both;
		}

		/* 骨架跟着容器一起长高，页脚贴着底边走 —— 高度补到哪它就在哪， */
		/* 正好迎着真页脚露出来的那条线，两者在同一处交接。 */
		/* 不这么做的话，长正文那一档骨架页脚停在 y≈115、真页脚在 227，隔着一百多 px */
		> .memo-placeholder {
			display: flex;
			flex-direction: column;
			position: absolute;
			inset: 0;

			> .skeleton-ink {
				display: flex;
				flex: 1;
				flex-direction: column;

				/* 排在正文块后面并吃掉剩余空间 —— 卡片长到哪，它就贴到哪的底边。 */
				/* flex: none 保证压缩只发生在正文块上，页脚自己不会被挤扁 */
				> .skeleton-foot {
					flex: none;
					margin-top: auto;
				}
			}
		}

		/* 各块由 JS 逐块淡入（见 MORPH_TRACKS）。这里遮的是块本身而不是整个容器 —— */
		/* 容器一旦 opacity: 0，里面每块的淡入都会被它乘没 */
		> .memo-slot-content {
			:deep(.memo-body) > *,
			:deep(.memo-foot) {
				opacity: 0;
			}
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

/* 与 .memo 同一份内边距 */
.memo-placeholder {
	padding: 1rem;

	/* 三种长度轮换，免得一整屏骨架齐刷刷一样长 */
	&.memo-placeholder-0 .skeleton-line {
		width: 67%;
	}

	&.memo-placeholder-1 .skeleton-line {
		width: 43%;
	}

	&.memo-placeholder-2 .skeleton-line {
		width: 53%;
	}
}

.skeleton-ink {
	animation: memo-skeleton-breathe 2.4s ease-in-out infinite;
}

/* 以下尺寸对着真卡片量出来（728px 宽、单行正文那一档）： */
/* 头像 48、meta 行 gap 10、正文行高 25.6、.tail 共 30（0.5rem + 20.8 控件行）、 */
/* chip 32.4 × 20.4、评论图标 14.4 且右缘距内容边 2。 */
/* 改了 MemoCard 的这些数，这里要跟着改，否则换卡片时会看见一次高度跳变 */
.skeleton-meta {
	display: flex;
	align-items: center;

	/* 同 .memo-meta 的 gap */
	gap: 10px;
}

.skeleton-avatar {
	/* 同真头像的 3em */
	width: 3em;
	height: 3em;
	border-radius: 2em;
	background-color: var(--c-bg-soft);
}

/* 4px 是真卡片里名字行盒与时间行盒之间的空隙 */
.skeleton-who {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

/* 名字与时间各给一个与真行高等高的行盒，墨带在其中居中 —— */
/* 不必靠 gap 硬凑，换成文字时两行原地不动 */
.skeleton-nick,
.skeleton-date {
	display: flex;
	align-items: center;
}

/* 22.4 / 16 = 1.4，真 .nick 的行高 */
.skeleton-nick {
	height: 1.4em;
}

/* 同 .date 的 0.8rem 字号；17 / 12.8 ≈ 1.33 是它的行高 */
.skeleton-date {
	height: 1.33em;
	font-size: 0.8rem;
}

.skeleton-nick::before {
	width: 3.5rem;
}

.skeleton-date::before {
	width: 2.5rem;
}

/* 0.5rem 是 .memo-body 的 gap；4.8px 是 .memo-content 自己上下留的那点空 */
.skeleton-lines {
	display: flex;
	flex-direction: column;
	margin-top: 0.5rem;
	padding-block: 4.8px;
}

/* 每条占住正文一整行的行高，条形在其中居中 —— 换成文字时行的位置不动 */
.skeleton-line {
	display: flex;
	align-items: center;
	width: 94%;
	height: 1.6em;

	&::before {
		width: 100%;
	}
}

/* 一条墨带 = 一行字。0.72em 是照中文的观感定的 —— CJK 字形几乎占满 em 框， */
/* 按拉丁文的 x-height 去画会细得不像字 */
.skeleton-line::before,
.skeleton-nick::before,
.skeleton-date::before {
	content: "";
	display: block;
	height: 0.72em;
	border-radius: 3px;
	background-color: var(--c-bg-soft);
}

/* 0.5rem 是 .tail-in 的 padding-top，20.8px 是那一排控件的实高 */
.skeleton-foot {
	display: flex;
	align-items: center;
	justify-content: space-between;
	height: 20.8px;
	margin-top: 0.5rem;
}

/* reaction 的 chip 本身就是个描边胶囊，骨架也画描边而不是实心 */
.skeleton-chip {
	width: 32px;
	height: 100%;
	border: 1px solid var(--c-bg-soft);
	border-radius: 2em;
}

/* 评论入口静息时只剩一个图标；2px 是它在按钮里的右内距 */
.skeleton-act {
	width: 14px;
	height: 14px;
	margin-inline-end: 2px;
	border-radius: 3px;
	background-color: var(--c-bg-soft);
}

@keyframes memo-skeleton-fill {
	from {
		opacity: 0;
	}

	to {
		opacity: 1;
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
