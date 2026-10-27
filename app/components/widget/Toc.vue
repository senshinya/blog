<script setup lang="ts">
import '~/assets/css/reading-navigation.css'

const { headings, percent, activeId, visibleRoots, visibleIds, reading, paused, ready, navigate, backToTop, setMeterVisible } = useArticleReading()
const owner = Symbol('reading-meter')
const meter = useTemplateRef<HTMLElement>('meter')
const meterVisible = useElementVisibility(meter)
watch(meterVisible, value => setMeterVisible(owner, value), { immediate: true })
onScopeDispose(() => setMeterVisible(owner, false))
const hovering = ref(false)
const keyboard = ref(false)
const focused = computed(() => ready.value && !!headings.value.length && reading.value && !hovering.value && !keyboard.value)

function focusOut(event: FocusEvent) {
	if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null))
		keyboard.value = false
}
</script>

<template>
<section
	class="blog-widget reading-navigation reading-theme"
	:data-focused="focused || undefined"
	:data-progress="percent"
	:data-paused="paused || undefined"
	:aria-label="$t('widget.toc.title')"
	tabindex="0"
	@mouseenter="hovering = true"
	@mouseleave="hovering = false"
	@focusin="keyboard = true"
	@focusout="focusOut"
>
	<div class="reading-navigation-inner">
		<div class="reading-directory">
			<PostReadingToc :headings :active-id="activeId" :visible-roots="visibleRoots" :visible-ids="visibleIds" :collapsed="focused" @navigate="navigate" />
			<div class="reading-extras" :inert="focused || undefined">
				<div class="reading-wave" aria-hidden="true">
					<svg width="150" height="10" viewBox="0 0 28 10" preserveAspectRatio="none" fill="none">
						<path d="M2 7 C4 2,7 2,9 5.5 C11 9,14 9,16 5 C18 1,21 2,24 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" vector-effect="non-scaling-stroke" />
					</svg>
				</div>
				<div ref="meter" class="reading-meter" role="progressbar" :aria-label="$t('widget.toc.progress')" :aria-valuenow="percent" :aria-valuemin="0" :aria-valuemax="100">
					<svg v-if="percent === 0" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<path d="M21 12a9 9 0 1 1-9-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
					</svg>
					<svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
						<circle cx="7" cy="7" r="6" stroke="var(--reading-ring)" stroke-width="2" />
						<circle cx="7" cy="7" r="6" stroke="var(--reading-accent)" stroke-width="2" stroke-linecap="round" stroke-dasharray="37.699" :stroke-dashoffset="37.699 * (1 - percent / 100)" transform="rotate(-90 7 7)" />
					</svg>
					<span>{{ percent }}%</span>
				</div>
				<button class="reading-back-top" :class="{ available: percent > 10 }" :tabindex="percent > 10 ? 0 : -1" @click="backToTop">
					<Icon name="mingcute:arrow-up-circle-line" aria-hidden="true" />
					<span>{{ $t('widget.toc.backToTop') }}</span>
				</button>
			</div>
		</div>
		<PostReadingRail :focused />
	</div>
</section>
</template>

<style scoped>
.reading-navigation {
	flex: none;
	position: relative;
	width: 200px;
	height: max(120px, calc(100dvh - 417px));
	min-width: 0;
	max-width: 100%;
	margin: 120px 0 0;
	padding: 0;
	outline-offset: -4px;
	animation: none !important;
	@media (max-width: 1024px) { display: none; }
}
.reading-navigation-inner {
	position: relative;
	height: 100%;
	max-width: 165px;
	margin-inline-start: 35px;
}
.reading-directory {
	display: flex;
	flex-direction: column;
	position: absolute;
	inset: 0 0 auto;
	min-height: 120px;
	max-height: 75vh;
}
.reading-extras {
	flex: none;
	transition: opacity 300ms;
	[data-focused] & {
		opacity: 0;
		pointer-events: none;
	}
}
.reading-wave {
	display: flex;
	align-items: center;
	height: 28px;
	color: color-mix(in srgb, var(--reading-wave) 12%, transparent);
}
.reading-meter, .reading-back-top {
	display: flex;
	align-items: center;
	gap: 7px;
	padding: 0 7px;
	line-height: 21px;
	svg { flex: none; }
}
.reading-meter circle { transition: stroke-dashoffset 300ms; }
.reading-back-top {
	opacity: 0;
	margin-top: 3.5px;
	transition: opacity 500ms;
	pointer-events: none;
	&.available {
		opacity: 0.5;
		pointer-events: auto;
	}
	&:hover { opacity: 1; }
	.iconify {
		width: 14px;
		height: 14px;
	}
}
@media (prefers-reduced-motion: reduce) {
	.reading-extras, .reading-back-top, .reading-meter circle { transition: none; }
}
</style>
