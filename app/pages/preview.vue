<script setup lang="ts">
import { resolveContentPath } from '~/utils/locale'

const appConfig = useAppConfig()
const { t, locale } = useI18n()
useSeoMeta({
	title: () => t('page.preview.title'),
	description: () => t('page.preview.description', { site: appConfig.title }),
})
const collection = useContentCollection()
const listKey = computed(() => `previews:index:${collection.value}`)
const { data: listRaw } = await useAsyncData(
	listKey,
	() => getArticleIndexOptions(collection.value, 'previews/%'),
	{ default: () => [], watch: [collection] },
)
const { listSorted } = useArticleSort(listRaw)
const { category, categories, listCategorized } = useCategory(listSorted)
</script>

<template>
<template #aside>
	<!-- TransitionGroup 必须在此层：dxup 把布局里的 <slot name="aside"> 编译成 LayoutSlot 组件，
		放在 BlogAside 里只会看到那一个组件 vnode，看不见 widget 的增删 -->
	<TransitionGroup name="aside-widget">
		<WidgetBlogLog key="blog-log" />
	</TransitionGroup>
</template>

<div class="preview">
	<div class="preview-header">
		<h1>
			<UtilLink class="mobile-only" to="/" :title="$t('page.preview.backHome')">
				<Icon name="tabler:chevron-left" />
			</UtilLink>{{ $t('page.preview.title') }}
		</h1>
		<PostFilter
			v-model:category="category"
			:categories
		/>
	</div>
	<p>{{ $t('page.preview.tagline') }}</p>

	<menu class="proper-height">
		<PostArticle
			v-for="article in listCategorized"
			:key="article.path"
			v-bind="article"
			:to="resolveContentPath(article.path, locale)"
		/>
	</menu>
</div>
</template>

<style lang="scss" scoped>
.preview {
	margin: 1rem;
}

.preview-header {
	display: flex;
	align-items: center;
	justify-content: space-between;

	h1 {
		mask-image: linear-gradient(#FFF, transparent);
	}
}
</style>
