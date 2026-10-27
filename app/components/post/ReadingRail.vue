<script setup lang="ts">
import { createReadingRail } from '~/utils/readingProgress'

const props = defineProps<{ focused: boolean, marker: { left: number, top: number, height: number } }>()
const gradientId = useId()
const { headings, percent, scrollPosition, activeId, activeRoot, paused, desktop, reducedMotion } = useArticleReading()
const rail = useTemplateRef<HTMLElement>('rail')
const track = useTemplateRef<SVGPathElement>('track')
const highlight = useTemplateRef<SVGPathElement>('highlight')
const svg = useTemplateRef<SVGSVGElement>('svg')
const label = useTemplateRef<HTMLElement>('label')
const labelPercent = useTemplateRef<HTMLElement>('label-percent')
const visible = useElementVisibility(rail)
const height = ref(0)
const origin = ref({ left: 0, top: 0 })
const shapeTransform = computed(() => props.focused
	? 'translate(0px, 0px) scale(1, 1)'
	: `translate(${props.marker.left - origin.value.left - 8}px, ${props.marker.top - origin.value.top}px) scale(1, ${height.value ? props.marker.height / height.value : 0})`)
let frame = 0
let lastTime = 0
let focus = 0
let position = 0
let amplitude = 0
let springVelocity = 0
let scrollVelocity = 0
let lastScroll = 0
let started = 0
let dots: SVGCircleElement[] = []

function draw(time: number) {
	const geometry = createReadingRail(height.value, position, focus, amplitude, reducedMotion.value === 'reduce' ? 0 : time - started)
	track.value?.setAttribute('d', focus === 0 ? `M8 0 L8 ${height.value}` : geometry.path)
	highlight.value?.setAttribute('d', geometry.path)
	highlight.value?.setAttribute('stroke-dashoffset', `${0.06 - (height.value ? geometry.y / height.value : 0)}`)
	for (let index = 0; index < dots.length; index++) {
		const dot = dots[index]!
		const heading = headings.value[index]
		if (!heading)
			continue
		const y = heading.ratio * height.value
		dot.setAttribute('cx', `${geometry.dotX(y)}`)
		dot.setAttribute('cy', `${y}`)
	}
	if (label.value)
		label.value.style.transform = `translateY(${geometry.y}px) translateY(-50%)`
	if (labelPercent.value)
		labelPercent.value.textContent = `${percent.value}%`
}

function animate(time: number) {
	frame = 0
	// Match the reference's Motion frame clock: a 60Hz first step, then 1–40ms.
	const delta = lastTime ? Math.max(1, Math.min(40, time - lastTime)) : 1000 / 60
	lastTime = time
	const active = props.focused ? 1 : 0
	const smoothing = 1 - Math.exp(-delta / 140)
	focus += (active - focus) * smoothing
	if (Math.abs(active - focus) < 0.002)
		focus = active
	const target = percent.value / 100 * height.value
	position = focus === 0 ? target : position + (target - position) * Math.min(1, 1.4 * smoothing)
	const currentScroll = window.scrollY
	const velocity = (currentScroll - lastScroll) / delta * 1000
	lastScroll = currentScroll
	scrollVelocity += (velocity - scrollVelocity) * Math.min(1, delta / 80)
	const targetAmplitude = Math.min(14, 0.012 * Math.abs(scrollVelocity))
	const seconds = delta / 1000
	springVelocity += (90 * (targetAmplitude - amplitude) - 2 * Math.sqrt(90) * 0.75 * springVelocity) * seconds
	amplitude = Math.max(-4, amplitude + springVelocity * seconds)
	draw(time)
	if (focus !== 0 || active)
		frame = requestAnimationFrame(animate)
}

function sync() {
	if (!import.meta.client)
		return
	cancelAnimationFrame(frame)
	frame = 0
	lastTime = 0
	lastScroll = window.scrollY
	if (paused.value || !desktop.value || !visible.value)
		return
	if (!props.focused && focus === 0) {
		position = percent.value / 100 * height.value
		draw(0)
		return
	}
	if (reducedMotion.value === 'reduce') {
		focus = props.focused ? 1 : 0
		position = percent.value / 100 * height.value
		amplitude = springVelocity = 0
		draw(0)
		return
	}
	frame = requestAnimationFrame(animate)
}

function measure() {
	if (!rail.value?.parentElement)
		return
	const bounds = rail.value.getBoundingClientRect()
	const parent = rail.value.parentElement.getBoundingClientRect()
	height.value = bounds.height
	origin.value = { left: bounds.left - parent.left, top: bounds.top - parent.top }
	sync()
}
useResizeObserver(rail, measure)
useEventListener('resize', measure)
watch([() => props.focused, paused, desktop, visible, reducedMotion], sync)
watch([percent, scrollPosition], () => {
	if (!frame)
		sync()
})
watch(headings, async () => {
	await nextTick()
	dots = [...(svg.value?.querySelectorAll<SVGCircleElement>('circle') ?? [])]
	measure()
}, { flush: 'post' })
onMounted(() => {
	started = performance.now()
	dots = [...(svg.value?.querySelectorAll<SVGCircleElement>('circle') ?? [])]
	measure()
})
onScopeDispose(() => {
	if (import.meta.client)
		cancelAnimationFrame(frame)
})
</script>

<template>
<div ref="rail" class="reading-rail" :class="{ focused, 'has-marker': marker.height > 0 }" aria-hidden="true">
	<svg ref="svg" class="rail-svg" width="48" height="100%" fill="none">
		<defs>
			<linearGradient :id="gradientId" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="0" :y2="height">
				<stop class="rail-color" offset="0" />
				<stop class="rail-color" offset="0.8" />
				<stop class="rail-color rail-fade" offset="1" />
			</linearGradient>
		</defs>
		<g class="rail-shape" :style="{ transform: shapeTransform }">
			<path ref="track" class="rail-track" :stroke="`url(#${gradientId})`" stroke-linecap="round" vector-effect="non-scaling-stroke" />
			<path ref="highlight" class="rail-highlight" pathLength="1" stroke-dasharray="0.12 0.88" stroke-width="1.6" stroke-linecap="round" />
			<circle
				v-for="heading in headings"
				:key="heading.id"
				class="rail-dot"
				:class="{ 'is-root': heading.id === heading.rootId, 'is-active': heading.id === activeId }"
				:r="heading.id === activeId ? 2.5 : heading.id === heading.rootId ? 1.75 : 1.25"
			/>
		</g>
	</svg>
	<div ref="label" class="rail-label">
		<Transition name="rail-title" mode="out-in">
			<span :key="activeRoot?.id" class="rail-title">{{ activeRoot?.text }}</span>
		</Transition>
		<span ref="label-percent" class="rail-percent">{{ percent }}%</span>
	</div>
</div>
</template>

<style scoped>
.reading-rail {
	position: absolute;
	inset: 0 auto 0 0;
	width: 42px;
	pointer-events: none;
}
.rail-svg {
	display: block;
	position: absolute;
	overflow: visible;
	inset: 0;
	width: 100%;
	height: 100%;
}
.rail-shape {
	transform-origin: 0 0;
	transition: transform var(--reading-expand-duration) var(--reading-curve);
	.focused & { transition-duration: var(--reading-collapse-duration); }
}
.rail-track {
	opacity: 0;
	transition: opacity 450ms, stroke-width 450ms var(--reading-curve), filter 450ms var(--reading-curve);
	filter: drop-shadow(0 0 4px color-mix(in srgb, var(--reading-accent) 35%, transparent));
	stroke-width: 2;
	.has-marker & { opacity: 0.8; }
	.focused & {
		opacity: 1;
		filter: drop-shadow(0 0 2px color-mix(in srgb, var(--reading-accent) 20%, transparent));
		stroke-width: 1.2;
	}
}
.rail-color {
	stop-color: var(--reading-accent);
	transition: stop-color 450ms var(--reading-curve), stop-opacity 450ms var(--reading-curve);
	.focused & { stop-color: color-mix(in srgb, var(--reading-ink) 15%, transparent); }
}
.rail-fade {
	stop-opacity: 0;
	.focused & { stop-opacity: 1; }
}
.rail-highlight {
	opacity: 0;
	transition: opacity 200ms;
	filter: drop-shadow(0 0 2px color-mix(in srgb, var(--reading-accent) 20%, transparent));
	stroke: var(--reading-accent);
	.focused & {
		opacity: 0.55;
		transition-duration: 300ms;
		transition-delay: 150ms;
	}
}
.rail-dot {
	fill: color-mix(in srgb, var(--reading-ink) 18%, transparent);
	opacity: 0;
	transition: opacity 600ms, r 350ms, fill 350ms;
	&.is-root { fill: color-mix(in srgb, var(--reading-ink) 30%, transparent); }
	&.is-active {
		fill: color-mix(in srgb, var(--reading-accent) 70%, transparent);
		transition-delay: 100ms;
	}
	.focused & { opacity: 1; }
}
.rail-label {
	display: flex;
	flex-direction: column;
	gap: 1.75px;
	position: absolute;
	opacity: 0;
	inset: 0 auto auto 31.5px;
	width: max-content;
	max-width: 140px;
	font-size: 10px;
	line-height: 1.25;
	transition: opacity 300ms;
	.focused & {
		opacity: 1;
		transition-delay: 700ms;
	}
}
.rail-title {
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
	color: color-mix(in srgb, var(--reading-ink) 40%, transparent);
}
.rail-percent { color: color-mix(in srgb, var(--reading-accent) 50%, transparent); }
.rail-title-enter-active, .rail-title-leave-active { transition: opacity 250ms ease-out, transform 250ms ease-out; }
.rail-title-enter-from {
	opacity: 0;
	transform: translateY(3px);
}
.rail-title-leave-to {
	opacity: 0;
	transform: translateY(-3px);
}
@media (prefers-reduced-motion: reduce) {
	.rail-shape, .rail-track, .rail-color, .rail-highlight, .rail-dot, .rail-label, .rail-title-enter-active, .rail-title-leave-active { transition: none; }
}
</style>
