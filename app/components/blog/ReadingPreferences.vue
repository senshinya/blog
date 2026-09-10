<script setup lang="ts">
const expanded = ref(false)
</script>

<template>
<div class="reading-preferences" :class="{ expanded }">
	<BlogLangToggle v-model:expanded="expanded" />
	<span class="preference-divider" aria-hidden="true" />
	<BlogThemeToggle />
</div>
</template>

<style scoped>
.reading-preferences {
	--preference-height: 2.125rem;
	--preference-spring: cubic-bezier(0.22, 1.25, 0.36, 1);
	--preference-slide: cubic-bezier(0.22, 1.4, 0.36, 1);

	display: flex;
	align-items: center;
	width: 13rem;
	max-width: 100%;
	margin: 0 auto;
	padding: 5px;
	border: 1px solid var(--c-border);
	border-radius: 999px;
	box-shadow: inset 0 1px 0 var(--c-bg-a50), 0 2px 5px var(--ld-shadow);
	background-color: var(--c-bg-2);
	font-size: 0.8125rem;
	transition: width 0.42s var(--preference-spring), box-shadow 0.25s;

	&.expanded {
		width: 17.25rem;
	}

	&:hover {
		box-shadow: inset 0 1px 0 var(--c-bg-a50), 0 4px 12px var(--ld-shadow);
	}

	@media (pointer: coarse) {
		--preference-height: 2.75rem;
	}

	@media (prefers-reduced-motion: reduce) {
		transition: none;
	}
}

.preference-divider {
	flex: 0 0 1px;
	height: 1.0625rem;
	margin: 0 7px;
	background-color: var(--c-border);
}
</style>
