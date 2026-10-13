<script setup lang="ts">
withDefaults(defineProps<{ mapKey: string, title: string, expanded?: boolean, interactive?: boolean }>(), { interactive: true })
defineEmits<{ expand: [], collapse: [] }>()
</script>

<template>
<div class="map-peek" :data-map-image="mapKey">
	<img src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" :alt="$t('page.travels.editorial.photoMap', { title })" width="335" height="200" decoding="async">
	<span class="map-peek-credit">© CARTO · © OSM</span>
	<button v-if="interactive" class="map-open" :aria-label="$t('page.travels.editorial.expandPhotoMap', { title })" :aria-expanded="Boolean(expanded)" @click="$emit('expand')">
		<span class="map-peek-label"><TravelEditorialIcon />{{ $t(`page.travels.editorial.${mapKey === 'intro' ? 'tripMap' : mapKey.startsWith('chapter-') ? 'chapterMap' : 'viewMap'}`) }} <span aria-hidden="true">↗</span></span>
	</button>
</div>
</template>
