<script setup lang="ts">
import MapCredit from './MapCredit.vue'

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
		<MapCredit />
	</footer>
</section>
</template>
