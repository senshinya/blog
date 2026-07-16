<!-- app/components/content/GearGrid.vue -->
<template>
<div class="gear-grid">
	<slot />
</div>
</template>

<style lang="scss" scoped>
.gear-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));

	// 同一行卡片按最高的对齐，不参差
	align-items: stretch;
	gap: 0.8rem;
	margin: 1rem 0;
}
</style>
