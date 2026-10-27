<script setup lang="ts">
import '~/assets/css/reading-navigation.css'

const { percent, desktop, desktopMeterVisible, atEnd, ready, paused } = useArticleReading()
</script>

<template>
<ClientOnly>
	<Teleport to="body">
		<div
			class="reading-edge reading-theme"
			:data-hidden="!ready || atEnd || paused || desktop && desktopMeterVisible || undefined"
			role="progressbar"
			:aria-label="$t('widget.toc.progress')"
			:aria-valuenow="percent"
			:aria-valuemin="0"
			:aria-valuemax="100"
			aria-orientation="vertical"
		>
			<div :style="{ transform: `scaleY(${percent / 100})` }" />
		</div>
		<PostReadingMenu />
	</Teleport>
</ClientOnly>
</template>

<style scoped>
.reading-edge {
	position: fixed;
	inset: 0 0 0 auto;
	width: 1px;
	transition: opacity 200ms ease-in-out;
	pointer-events: none;
	z-index: calc(var(--z-index-popover) - 1);
	&[data-hidden] { opacity: 0; }
	> div {
		opacity: 0.8;
		width: 100%;
		height: 100%;
		background: var(--reading-accent);
		transform-origin: top;
		transition: transform 75ms linear;
	}
}
@media (prefers-reduced-motion: reduce) {
	.reading-edge, .reading-edge > div { transition: none; }
}
</style>
