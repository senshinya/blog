<script setup lang="ts">
import { travelMotion } from '../../../utils/travelMotion'
import MapCredit from './MapCredit.vue'
import './map-drawer.css'

defineProps<{ mapKey: string, title: string, coordinates?: string, failed?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const panel = useTemplateRef<HTMLElement>('panel')
const shade = useTemplateRef<HTMLElement>('shade')
const reduced = usePreferredReducedMotion()
const closing = ref(false)
const motions = new Set<Animation>()

function cancelMotions() {
	for (const motion of motions)
		motion.cancel()
	motions.clear()
}
async function animate(element: HTMLElement | null, frames: Keyframe[]) {
	if (!element || reduced.value === 'reduce')
		return
	const motion = element.animate(frames, { duration: travelMotion.duration.mode, easing: travelMotion.easing, fill: 'both' })
	motions.add(motion)
	try {
		await motion.finished
	}
	catch { /* Closing or a viewport change can interrupt the entrance. */ }
	motions.delete(motion)
	motion.cancel()
}
async function leave() {
	closing.value = true
	const transform = panel.value && getComputedStyle(panel.value).transform
	const opacity = shade.value && getComputedStyle(shade.value).opacity
	cancelMotions()
	await Promise.all([
		animate(panel.value, [{ transform: transform || 'none' }, { transform: 'translateX(100%)' }]),
		animate(shade.value, [{ opacity: opacity || 1 }, { opacity: 0 }]),
	])
	dialog.value?.close()
}
onMounted(() => {
	dialog.value?.showModal()
	void Promise.all([
		animate(panel.value, [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }]),
		animate(shade.value, [{ opacity: 0 }, { opacity: 1 }]),
	])
})
onBeforeUnmount(() => {
	cancelMotions()
	dialog.value?.close()
})
defineExpose({ leave })
</script>

<template>
<dialog ref="dialog" class="map-drawer" aria-labelledby="travel-map-drawer-title" :aria-busy="closing" @cancel.prevent="emit('close')">
	<div ref="shade" class="map-drawer-shade" aria-hidden="true" @click="emit('close')" />
	<section ref="panel" class="map-drawer-panel">
		<header class="map-drawer-head">
			<div>
				<p>{{ $t('page.travels.mapControls.title') }}</p>
				<h2 id="travel-map-drawer-title">
					{{ title }}
				</h2>
			</div>
			<button class="icon-button" :aria-label="$t('page.travels.collapseMap')" :disabled="closing" @click="emit('close')">
				<TravelEditorialIcon name="close" />
			</button>
		</header>
		<div class="map-drawer-map" :data-map-detail="mapKey">
			<p v-if="failed" class="map-drawer-error" role="status">
				{{ $t('page.travels.mapUnavailable') }}
			</p>
		</div>
		<footer class="map-drawer-foot">
			<p v-if="coordinates" class="map-drawer-coordinates">
				<TravelEditorialIcon /><span>{{ coordinates }}</span>
			</p>
			<MapCredit />
		</footer>
	</section>
</dialog>
</template>
