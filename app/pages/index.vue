<script setup lang="ts">
import { orderBy } from 'es-toolkit/array'
import blogConfig from '~~/blog.config'
import { buildPath, resolveContentPath } from '~/utils/locale'

const appConfig = useAppConfig()
const route = useRoute()
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
const { page, totalPages, listPaged } = usePagination(listCategorized, { bindRoute: true })

const requestedPage = parsePageNumber(route.params.page)
const validPage = !!requestedPage && requestedPage <= Math.max(1, Math.ceil(listRaw.value.length / appConfig.pagination.perPage))
if (!validPage) {
	const event = useRequestEvent()
	if (event)
		setResponseStatus(event, 404)
	useSeoMeta({ robots: 'noindex, follow' })
}
if (route.params.page === '1')
	await navigateTo({ path: paginationPath(1, locale.value), query: route.query }, { redirectCode: 301, replace: true })

// Category filters remain UI views; search canonical URLs describe the unfiltered page.
useHead(() => ({ link: [{ rel: 'canonical', href: new URL(paginationPath(page.value, locale.value), blogConfig.url).href }] }))
function pageHref(value: number) {
	const path = paginationPath(value, locale.value)
	return category.value ? `${path}?${new URLSearchParams({ category: category.value })}` : path
}
function changeCategory(value?: string) {
	navigateTo({ path: paginationPath(1, locale.value), query: value ? { category: value } : {} })
}

useSeoMeta({ title: () => page.value > 1 ? `${t('ui.pagination.page', { n: page.value })} · ${t('site.seoTitle')}` : t('site.seoTitle') })

const listRecommended = computed(() => orderBy(
	listRaw.value.filter(item => item.recommend !== null),
	['recommend', 'date'],
	['desc'],
))

const previewCountKey = computed(() => `previews:count:${collection.value}`)
const { data: previewCount } = useAsyncData(
	previewCountKey,
	() => import.meta.dev ? queryCollection(collection.value).where('stem', 'LIKE', 'previews/%').count() : Promise.resolve(0),
	{ watch: [collection] },
)
</script>

<template>
<template #aside>
	<TransitionGroup v-if="validPage" name="aside-widget">
		<WidgetBlogStats key="blog-stats" />
		<WidgetMemos key="memos" />
		<WidgetBlogTech key="blog-tech" />
	</TransitionGroup>
	<WidgetBlogLog v-else />
</template>

<template v-if="validPage">
	<BlogHeader class="hide-above-mobile" :to="buildPath('/', locale, 'zh')" tag="h1" />

	<PostSlide v-if="listRecommended.length && page === 1 && !category" :list="listRecommended" />

	<div class="post-list">
		<PostFilter
			:category="category"
			:categories
			@update:category="changeCategory"
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

		<ZPagination v-model="page" sticky avoid :total-pages="totalPages" :page-href="pageHref" />
	</div>
</template>
<ZError v-else icon="line-md:document-delete-twotone" :title="$t('page.notFound.title')" />
</template>

<style scoped>
.post-list {
	margin: 1rem;
}
</style>
