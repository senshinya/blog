<script setup lang="ts">
import type { Ref } from 'vue'
import type { TravelBasemap } from '~/utils/travelMapSettings'
import { isSatelliteBasemap } from '~/utils/travelMapSettings'

const credit = inject<{ basemap: Ref<TravelBasemap>, attribution: Ref<string> }>('travel-map-credit')
const satellite = computed(() => credit && isSatelliteBasemap(credit.basemap.value))
</script>

<template>
<div class="atlas-credit">
	<template v-if="satellite">
		<a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Powered by Esri</a>
		<details class="atlas-credit-details">
			<summary>{{ $t('page.travels.editorial.dataAttribution') }}</summary>
			<p>{{ credit?.attribution.value }}</p>
		</details>
	</template>
	<template v-else-if="credit?.basemap.value === 'osm'">
		<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
	</template>
	<template v-else>
		<a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">© CARTO</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a>
	</template>
</div>
</template>
