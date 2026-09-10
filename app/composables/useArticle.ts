import type { Collections, ContentCollectionItem } from '@nuxt/content'
import type { MetaSlotsTree } from '~~/remark-plugins/rehype-meta-slots'
import type { ArticleProps } from '~/types/article'
import { orderBy } from 'es-toolkit/array'

/**
 * 当前语言对应的 content collection 名。
 *
 * 把它拼进 useAsyncData 的缓存 key，是为了让切语言时不会读到上一语言缓存下来的数据。
 * 但**这个 key 必须以 ref 的形式传进去，不能写成取值函数 `() => \`...\``**。
 *
 * 两种写法在 useAsyncData 眼里等价（`isRef(_key) || typeof _key === 'function'`
 * 都算响应式 key），可 experimental.extractAsyncDataHandlers 那个构建插件认参数的
 * 办法是「参数里第一个函数就是 handler」：
 *
 *   const fetcherFunction = node.arguments.find(fn =>
 *     fn.type === 'ArrowFunctionExpression' || fn.type === 'FunctionExpression')
 *
 * （nuxt/dist/index.mjs 的 ExtractAsyncDataHandlersPlugin）。key 一旦写成箭头函数，
 * 它就排在 handler 前面被 find() 选中，于是被抽走、换成
 * `() => import('./async-data-chunk-N.js').then(r => (r.default || r)(collection))`
 * —— key 成了一个返回 Promise 的函数，useAsyncData 第一行的
 * `typeof key.value !== 'string'` 当场抛 NUXT_E3008，整个页面主体水合失败被卸载。
 *
 * 该插件只在生产构建、且只对客户端 bundle 生效（addBuildPlugin 传了 server: false），
 * 所以 dev、单测、预渲染出来的静态 HTML 全是对的，只有浏览器水合那一下会清空正文，
 * 读静态产物的检查一律看不见。守这条规矩的是 app/composables/asyncDataKey.test.ts。
 */
export function useContentCollection() {
	const { locale } = useI18n()
	return computed(() => `content_${locale.value}` as keyof Collections)
}

/** 获取已加载的文章内容/元信息 */
export function useArticle(path?: MaybeRefOrGetter<string | undefined>) {
	const route = useRoute()
	const dataKey = computed(() => `content:${toValue(path) ?? route.path}`)
	const post = computed(() => useNuxtData<ContentCollectionItem | null | undefined>(dataKey.value).data.value)

	return {
		dataKey,
		post,
		toc: computed(() => post.value?.body.toc),
		metaSlots: computed(() => post.value?.meta.slots as Record<string, MetaSlotsTree>),
	}
}

/**
 * 生成文章查询参数，完全包装 useAsyncData 会使 SSR 行为异常，缓存 key 需要暴露
 * @see https://nuxt.com/docs/4.x/api/composables/use-async-data#usage
 * @see https://github.com/nuxt/nuxt/issues/14736
 * @todo 支持分页/分类筛选
 */
export function getArticleIndexOptions(collection: keyof Collections, path = 'posts/%') {
	return queryCollection(collection)
		.where('stem', 'LIKE', path)
		.select('categories', 'date', 'description', 'image', 'path', 'readingTime', 'recommend', 'tags', 'title', 'type')
		.all()
}

interface UseCategoryOptions {
	bindQuery?: string
}

export function useCategory(list: MaybeRefOrGetter<ArticleProps[]>, options?: UseCategoryOptions) {
	const { bindQuery } = options || {}

	const category = bindQuery
		? useRouteQuery(bindQuery, undefined)
		: ref<string | undefined>()

	const categories = computed(() => [...new Set(toValue(list).map(item => item.categories?.[0]))])

	const listCategorized = computed(
		() => toValue(list).filter(
			item => !category.value || item.categories?.[0] === category.value,
		),
	)

	return {
		category,
		categories,
		listCategorized,
	}
}

/**
 * 文章列表一律按创建日期倒序。
 *
 * 曾经这里是一整套可切换的排序（排序字段 + 升降序，都绑在 URL query 上），
 * 但可选的字段只有 date 和 updated 两个，而 updated 从来没有一篇文章真正写过 ——
 * 于是那个开关永远在两个等价的顺序之间切换。连同 updated 一起删掉了。
 */
export function useArticleSort(list: MaybeRefOrGetter<ArticleProps[]>) {
	return {
		listSorted: computed(() => orderBy(toValue(list), ['date'], ['desc'])),
	}
}

export function getCategoryIcon(category?: string) {
	const appConfig = useAppConfig()
	return appConfig.article.categories[category!]?.icon ?? 'tabler:folder'
}

export function getCategoryColor(category?: string) {
	const appConfig = useAppConfig()
	return appConfig.article.categories[category!]?.color
}

interface GetPostTypeClassNameOptions {
	prefix?: string
}

export function getPostTypeClassName(type = 'tech', options?: GetPostTypeClassNameOptions) {
	const { prefix = 'text' } = options || {}
	return `${prefix}-${type}`
}
