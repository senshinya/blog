<script setup lang="ts">
const props = defineProps<{ playing: boolean }>()
defineEmits<{ toggle: [] }>()
const { t } = useI18n()
const label = computed(() => t(`page.travels.editorial.${props.playing ? 'stopLive' : 'playLive'}`))
</script>

<template>
<button class="photo-live-control" :aria-label="label" :title="label" :aria-pressed="playing" @pointerdown.stop @click.stop="$emit('toggle')">
	<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.25" stroke-dasharray="0.1 3" stroke-linecap="round" />
		<circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="1.15" />
		<rect v-if="playing" x="9.25" y="9.25" width="5.5" height="5.5" rx="0.8" fill="currentColor" />
		<circle v-else cx="12" cy="12" r="2.25" fill="currentColor" />
	</svg>
</button>
</template>
