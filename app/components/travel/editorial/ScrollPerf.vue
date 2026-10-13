<script setup lang="ts">
import { readTravelScrollVisualPosition } from '~/utils/travelScrollRenderer'

const props = defineProps<{ target: HTMLElement | null | undefined }>()
interface Sample { raf: number, positions: number, nativePositions: number, touches: number, longest: number }
const drag = ref<Sample | null>(null)
const spring = ref<Sample | null>(null)
let stop = () => {}

watch(() => props.target, (element) => {
	stop()
	if (!element)
		return
	const win = element.ownerDocument.defaultView!
	let frame = 0
	let held = false
	let phase = ''
	let started = 0
	let previous = 0
	let lastPosition = readTravelScrollVisualPosition(element)
	let lastNativePosition = element.scrollTop
	let frames = 0
	let positions = 0
	let nativePositions = 0
	let touches = 0
	let longest = 0
	let displayed = 0
	function publish(now: number) {
		const seconds = (now - started) / 1000
		if (seconds < 0.12 || !phase)
			return
		const value = { raf: Math.round(frames / seconds), positions: Math.round(positions / seconds), nativePositions: Math.round(nativePositions / seconds), touches: Math.round(touches / seconds), longest: Math.round(longest) }
		if (phase === 'drag')
			drag.value = value
		else
			spring.value = value
	}
	function tick(now: number) {
		const nativePosition = element!.scrollTop
		const visualPosition = readTravelScrollVisualPosition(element!, nativePosition)
		const next = held ? 'drag' : element!.dataset.snapState === 'spring' ? 'spring' : ''
		if (next !== phase) {
			publish(now)
			phase = next
			started = displayed = now
			previous = 0
			frames = positions = nativePositions = touches = longest = 0
		}
		if (phase) {
			if (previous) {
				frames++
				longest = Math.max(longest, now - previous)
			}
			if (Math.abs(visualPosition - lastPosition) > 0.01)
				positions++
			if (Math.abs(nativePosition - lastNativePosition) > 0.01)
				nativePositions++
			if (now - displayed > 500) {
				publish(now)
				displayed = now
			}
		}
		previous = now
		lastPosition = visualPosition
		lastNativePosition = nativePosition
		frame = win.requestAnimationFrame(tick)
	}
	const start = () => {
		held = true
	}
	const move = () => {
		touches++
	}
	const end = () => {
		held = false
	}
	element.addEventListener('touchstart', start, { passive: true, capture: true })
	element.addEventListener('touchmove', move, { passive: true, capture: true })
	element.addEventListener('touchend', end, { passive: true, capture: true })
	element.addEventListener('touchcancel', end, { passive: true, capture: true })
	frame = win.requestAnimationFrame(tick)
	stop = () => {
		win.cancelAnimationFrame(frame)
		element.removeEventListener('touchstart', start, true)
		element.removeEventListener('touchmove', move, true)
		element.removeEventListener('touchend', end, true)
		element.removeEventListener('touchcancel', end, true)
	}
}, { immediate: true, flush: 'post' })
onScopeDispose(() => stop())
</script>

<template>
<output class="scroll-perf">
	<div>拖动：<span v-if="drag">RAF {{ drag.raf }} · 位置 {{ drag.positions }} · DOM {{ drag.nativePositions }} · 触摸 {{ drag.touches }} · 最慢 {{ drag.longest }}ms</span><span v-else>等待滑动</span></div>
	<div>吸附：<span v-if="spring">RAF {{ spring.raf }} · 位置 {{ spring.positions }} · DOM {{ spring.nativePositions }} · 最慢 {{ spring.longest }}ms</span><span v-else>等待松手</span></div>
</output>
</template>

<style scoped>
.scroll-perf {
	position: fixed;
	inset: auto 8px 12px;
	padding: 8px 10px;
	border-radius: 6px;
	background: rgb(0 0 0 / 82%);
	font: 12px/1.6 monospace;
	color: white;
	pointer-events: none;
	z-index: 100;
}
</style>
