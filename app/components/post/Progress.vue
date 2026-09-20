<script setup lang="ts">
// 阅读进度：纯 CSS 滚动驱动，没有 JS、没有滚动监听。
// 必须渲染在 .article 之后 —— 命名时间轴只对后继兄弟可见。
</script>

<template>
<div class="post-progress" aria-hidden="true" />
</template>

<style scoped>
/* 时间轴取 .article 的 contain 区间：正文顶边贴上视口顶边时为 0， */
/* 正文底边贴上视口底边时为 1。不含评论与页脚，读完正文就是读完。 */
.post-progress {
	position: fixed;
	inset-block-start: 0;
	inset-inline: 0;
	height: 2px;
	box-shadow: 0 0 0.4em var(--c-primary-soft);
	/* 渐变随 scaleX 一起缩放，最亮的一端永远落在进度的前沿。 */
	background-image: linear-gradient(to var(--end), transparent, var(--c-primary-soft) 30%, var(--c-primary));
	transform: scaleX(0);
	transform-origin: var(--start) center;
	pointer-events: none;
	z-index: calc(var(--z-index-popover) - 1);

	/* 不支持时停在 scaleX(0)，即完全不可见，不会留下一条假的满格进度。 */
	@supports (animation-timeline: view()) {
		animation: post-progress linear both;
		animation-range: contain;
		animation-timeline: --article-progress;
	}
}

/* 这条不是自发动画，是被滚动直接拖动的状态读数，故不随 reduced-motion 关闭。 */
@keyframes post-progress {
	to {
		transform: scaleX(1);
	}
}
</style>
