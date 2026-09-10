<script setup lang="ts">
import { buildPath, resolveContentPath } from '~/utils/locale'

const appConfig = useAppConfig()
const { t, locale } = useI18n()
const entranceDelay = useEntranceDelay()
useSeoMeta({
	title: () => t('page.preview.title'),
	description: () => t('page.preview.description', { site: appConfig.title }),
})
const collection = useContentCollection()
const listKey = computed(() => `previews:index:${collection.value}`)
const { data: listRaw } = await useAsyncData(
	listKey,
	() => queryArticleIndex(collection.value, 'previews/%'),
	{ default: () => [], watch: [collection] },
)
const { listSorted } = useArticleSort(listRaw)
const { category, categories, listCategorized } = useArticleCategory(listSorted)
</script>

<template>
<template #aside>
	<WidgetBlogLog key="blog-log" />
</template>

<div class="preview">
	<div class="preview-header">
		<h1>
			<UtilLink class="hide-above-mobile" :to="buildPath('/', locale, 'zh')" :title="$t('page.preview.backHome')">
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
			:style="entranceDelay(0)"
		/>
	</menu>
</div>
</template>

<style scoped>
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
