<script setup lang="ts">
import { orderBy } from 'es-toolkit/array'
import { buildPath, resolveContentPath } from '~/utils/locale'

const appConfig = useAppConfig()
const { t, locale } = useI18n()
const entranceDelay = useEntranceDelay()
useSeoMeta({
	description: () => t('site.description'),
	ogImage: appConfig.author.avatar,
})

const collection = useContentCollection()
const listKey = computed(() => `posts:index:${collection.value}`)
const { data: listRaw } = await useAsyncData(
	listKey,
	() => queryArticleIndex(collection.value),
	{ default: () => [], watch: [collection] },
)
const { listSorted } = useArticleSort(listRaw)
const { category, categories, listCategorized } = useArticleCategory(listSorted, { bindQuery: 'category' })
const { page, totalPages, listPaged } = usePagination(listCategorized, { bindQuery: 'page' })

useSeoMeta({ title: () => (page.value > 1 ? t('ui.pagination.page', { n: page.value }) : '') })

const listRecommended = computed(() => orderBy(
	listRaw.value.filter(item => item.recommend !== null),
	['recommend', 'date'],
	['desc'],
))

const previewCountKey = computed(() => `previews:count:${collection.value}`)
const { data: previewCount } = useAsyncData(
	previewCountKey,
	() => queryCollection(collection.value).where('stem', 'LIKE', 'previews/%').count(),
	{ watch: [collection] },
)
</script>

<template>
<template #aside>
	<WidgetBlogStats key="blog-stats" />
	<WidgetMemos key="memos" />
	<WidgetBlogTech key="blog-tech" />
</template>

<BlogHeader class="hide-above-mobile" :to="buildPath('/', locale, 'zh')" tag="h1" />

<PostSlide v-if="listRecommended.length && page === 1 && !category" :list="listRecommended" />

<div class="post-list">
	<PostFilter
		v-model:category="category"
		:categories
		@update:category="page = 1"
	>
		<ZSecret>
			<UtilLink v-if="previewCount" :to="buildPath('/preview', locale, 'zh')" class="preview-entrance">
				<Icon name="tabler:shield-lock" />
				{{ $t('page.home.previewLink') }}
			</UtilLink>
		</ZSecret>
	</PostFilter>

	<UtilListTransition v-slot="{ items }" :items="listPaged">
		<menu class="proper-height">
			<PostArticle
				v-for="article, index in items"
				:key="article.path"
				:data-list-key="article.path"
				v-bind="article"
				:to="resolveContentPath(article.path, locale)"
				:style="entranceDelay(index * 0.05)"
			/>
		</menu>
	</UtilListTransition>

	<ZPagination v-model="page" sticky avoid :total-pages="totalPages" />
</div>
</template>

<style scoped>
.post-list {
	margin: 1rem;
}
</style>
