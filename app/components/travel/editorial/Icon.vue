<script setup lang="ts">
withDefaults(defineProps<{ name?: string }>(), { name: 'pin' })
const paths: Record<string, string[]> = {
	pin: ['M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z', 'M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'],
	zoomIn: ['M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z', 'm15 15 6 6M7 10h6M10 7v6'],
	zoomOut: ['M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z', 'm15 15 6 6M7 10h6'],
	map: ['m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Z', 'M9 3v16M15 5v16'],
	left: ['m15 5-7 7 7 7'],
	right: ['m9 5 7 7-7 7'],
	down: ['m5 9 7 7 7-7'],
	close: ['m6 6 12 12M6 18 18 6'],
	system: ['M3 4h18v13H3Z', 'M8 21h8M12 17v4'],
	light: ['M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z', 'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5'],
	dark: ['M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z'],
}
</script>

<template>
<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
	<path v-for="path in paths[name] ?? paths.pin" :key="path" :d="path" />
</svg>
</template>
