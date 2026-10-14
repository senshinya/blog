<script setup lang="ts">
const props = defineProps<{ muted: boolean }>()
defineEmits<{ toggle: [] }>()
const { t } = useI18n()
const label = computed(() => t(`page.travels.editorial.${props.muted ? 'unmuteLive' : 'muteLive'}`))
</script>

<template>
<button class="photo-live-control photo-sound-control" :aria-label="label" :title="label" :aria-pressed="!muted" @pointerdown.stop @click.stop="$emit('toggle')">
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
		<path d="M11 5 6 9H3v6h3l5 4Z" />
		<path v-if="muted" d="m16 9 5 6m0-6-5 6" />
		<g v-else>
			<path d="M15 8a5 5 0 0 1 0 8" />
			<path d="M18 5a9 9 0 0 1 0 14" />
		</g>
	</svg>
</button>
</template>
