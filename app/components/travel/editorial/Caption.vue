<script setup lang="ts">
import { travelCaptionParts } from '../../../utils/travelCaption'

const props = defineProps<{ text: string }>()
const parts = computed(() => travelCaptionParts(props.text))
</script>

<template>
<template v-for="(part, index) in parts" :key="index">
	<a v-if="part.href" class="caption-link" :href="part.href" target="_blank" rel="noopener noreferrer" tabindex="-1">{{ part.text }}</a>
	<template v-else>
		{{ part.text }}
	</template>
</template>
</template>

<style scoped>
.caption-link {
	overflow-wrap: anywhere;
	text-decoration: underline;
	text-decoration-thickness: 1px;
	color: var(--red);
	text-underline-offset: 3px;
}
.caption-link:hover {
	text-decoration-thickness: 2px;
}
</style>
