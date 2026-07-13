<script setup lang="ts">
import { orderBy } from 'es-toolkit/array'

const appConfig = useAppConfig()
useSeoMeta({
	description: appConfig.description,
	ogImage: appConfig.author.avatar,
})

const { data: listRaw } = await useAsyncData('posts:index', () => getArticleIndexOptions(), { default: () => [] })
const { listSorted, isAscending, sortOrder } = useArticleSort(listRaw, { bindDirectionQuery: 'asc', bindOrderQuery: 'sort' })
const { category, categories, listCategorized } = useCategory(listSorted, { bindQuery: 'category' })
const { page, totalPages, listPaged } = usePagination(listCategorized, { bindQuery: 'page' })

watch(category, () => {
	page.value = 1
})

useSeoMeta({ title: () => (page.value > 1 ? `第${page.value}页` : '') })

const listRecommended = computed(() => orderBy(
	listRaw.value.filter(item => item.recommend !== null),
	['recommend', 'date'],
	['desc'],
))

const { data: previewCount } = useAsyncData(
	'previews:count',
	() => queryCollection('content').where('stem', 'LIKE', 'previews/%').count(),
)
</script>

<template>
<template #aside>
	<!-- TransitionGroup 必须在此层：dxup 把布局里的 <slot name="aside"> 编译成 LayoutSlot 组件，
		放在 BlogAside 里只会看到那一个组件 vnode，看不见 widget 的增删 -->
	<TransitionGroup name="aside-widget">
		<WidgetBlogStats key="blog-stats" />
		<WidgetMemos key="memos" />
		<WidgetBlogTech key="blog-tech" />
	</TransitionGroup>
</template>

<BlogHeader class="mobile-only" to="/" tag="h1" />

<!-- 此处不套 UtilHydrateSafe（上游原本有）。它内部是 ClientOnly，而 ClientOnly 挂载前后
	返回的 vnode 类型不同（h(slot) 的组件 vnode vs slots.default() 的 vnode 数组），
	Vue 只能把整棵子树卸载重建 —— 卡片上的 float-in 关键帧动画会因此在水合时重播一遍。
	上游加它是为了让预渲染结果在 SSG 下被 CSR 覆盖，但实测 ?page= / ?category= / ?asc=
	等深链在没有它时也能正确水合（Vue 自己会纠正失配），故移除。 -->
<PostSlide v-if="listRecommended.length && page === 1 && !category" :list="listRecommended" />

<div class="post-list">
	<PostOrderToggle
		v-model:is-ascending="isAscending"
		v-model:sort-order="sortOrder"
		v-model:category="category"
		:categories
	>
		<ZSecret>
			<UtilLink v-if="previewCount" to="/preview" class="preview-entrance">
				<Icon name="tabler:shield-lock" />
				查看预览文章
			</UtilLink>
		</ZSecret>
	</PostOrderToggle>

	<TransitionGroup tag="menu" class="proper-height" name="float-in">
		<PostArticle
			v-for="article, index in listPaged"
			:key="article.path"
			v-bind="article"
			:to="article.path"
			:use-updated="sortOrder === 'updated'"
			:style="getFixedDelay(index * 0.05)"
		/>
	</TransitionGroup>

	<ZPagination v-model="page" sticky avoid :total-pages="totalPages" />
</div>
</template>

<style lang="scss" scoped>
.post-list {
	margin: 1rem;
}

.float-in-leave-to {
	position: absolute;
}
</style>
