<script setup lang="ts">
const props = defineProps<{
	/** 分区标题，如「电子产品」 */
	title?: string
	/** 分区强调色：'primary' | 'accent' | 任意 CSS 颜色 */
	accent?: string
	/** 标题右侧的小注，如「5」「4 · 运行中」 */
	note?: string
}>()

const accentColor = computed(() => {
	switch (props.accent) {
		case 'accent':
			return 'var(--c-accent)'
		case undefined:
		case '':
		case 'primary':
			return 'var(--c-primary)'
		default:
			return props.accent
	}
})
</script>

<template>
<section class="gear-sec" :style="{ '--sec': accentColor }">
	<div v-if="title" class="gear-sec-head">
		<span class="gear-swatch" />
		<span class="gear-sec-title">{{ title }}</span>
		<span v-if="note" class="gear-sec-note">{{ note }}</span>
	</div>

	<div class="gear-masonry">
		<slot />
	</div>
</section>
</template>

<style scoped lang="scss">
.gear-sec {
	margin: 2.6rem 0 0;
}

.gear-sec-head {
	display: flex;
	align-items: center;
	gap: 0.6rem;
	margin-bottom: 1.1rem;

	&::after {
		content: "";
		flex: 1;
		height: 1px;
		background-color: var(--c-border);
	}
}

.gear-swatch {
	width: 0.7rem;
	height: 0.7rem;
	border-radius: 3px;
	background-color: var(--sec, var(--c-primary));
}

.gear-sec-title {
	font-family: var(--font-creative);
	font-size: 1.35rem;
	font-weight: 800;
	color: var(--c-text);
}

.gear-sec-note {
	font-family: var(--font-monospace);
	font-size: 0.76rem;
	color: var(--c-text-3);
}

// 瀑布流：卡高随内容错落；手机塌成单列
.gear-masonry {
	column-count: 2;
	column-gap: 0.9rem;

	@media (max-width: 640px) {
		column-count: 1;
	}
}
</style>
