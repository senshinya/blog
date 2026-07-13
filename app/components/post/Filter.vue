<script setup lang="ts">
// 原名 OrderToggle：除了分类筛选，还带一个排序字段开关（创建日期 / 更新日期）和一个升降序开关。
// 但 updated 字段 42 篇文章里一篇都没写过，那个开关实际上永远在两个等价的顺序之间切换；
// 升降序则被 pagination.allowAscending: false 常年关着。两者连同 updated 字段一并删了，
// 列表统一按创建日期倒序，此处只剩分类筛选。
defineProps<{
	categories?: (string | undefined)[]
	secretDelay?: string
}>()

const category = defineModel<string>('category')
</script>

<template>
<div class="post-filter" :style="{ '--secret-delay': secretDelay }">
	<slot />

	<ZDropdown trigger="focusin" tabindex="0">
		<button :disabled="!categories">
			<Icon :name="getCategoryIcon(category)" />
			<span class="filter-text">{{ category ?? '全部分类' }}</span>
		</button>

		<template #content="{ hide }">
			<button :class="{ active: !category }" @click="hide(), category = undefined">
				<Icon :name="getCategoryIcon()" />
				<span>全部分类</span>
			</button>

			<button v-for="item in categories" :key="item" :class="{ active: item === category }" @click="hide(), category = item">
				<Icon :name="getCategoryIcon(item)" />
				<span>{{ item }}</span>
			</button>
		</template>
	</ZDropdown>
</div>
</template>

<style lang="scss" scoped>
.post-filter {
	display: flex;
	gap: 1rem;
	color: var(--c-text-2);

	:deep(button), :deep(a) {
		transition: color 0.2s;

		&:hover {
			color: var(--c-primary);
		}
	}
}

// 插槽里的内容（预览入口、密度调节）靠左，把分类下拉顶到右边
:deep(.secret-container) {
	margin-inline-end: auto;
}

.iconify + span {
	margin-inline-start: 0.2em;
}
</style>
