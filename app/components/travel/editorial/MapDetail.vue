<script setup lang="ts">
defineProps<{ mapKey: string, title: string }>()
defineEmits<{ collapse: [] }>()
</script>

<template>
<section class="map-detail open" :aria-label="$t('page.travels.editorial.photoMap', { title })">
	<header class="map-detail-head">
		<strong>{{ title }}</strong><button @click="$emit('collapse')">
			{{ $t('page.travels.collapseMap') }} ↑
		</button>
	</header>
	<div class="map-detail-map" :data-map-detail="mapKey" />
	<footer class="map-detail-foot">
		<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© CARTO · © OpenStreetMap</a>
	</footer>
</section>
</template>
