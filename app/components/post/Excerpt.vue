<script setup lang="ts">
defineProps<{
	excerpt: string
}>()
</script>

<template>
<div class="md-excerpt gradient-card">
	<span class="dynamic"><Icon name="tabler:sparkles-2" />{{ excerpt }}</span>
</div>
</template>

<style scoped>
.md-excerpt {
	opacity: 0.6;
	margin: 1rem 0.5rem;
	padding: 0.5rem;
	font-size: 0.9em;
	transition: opacity 0.2s;
	animation: var(--entrance, content-in 0.2s ease-out both);

	.iconify {
		margin-inline-end: 0.3em;
	}

	&:hover {
		opacity: 1;
	}
}
@media (prefers-reduced-motion: reduce) {
	.md-excerpt {
		transition: none;
		animation: none;
	}
}
</style>
