import type { Collections, ContentCollectionItem } from '@nuxt/content'
import type { MetaSlotsTree } from '~~/remark-plugins/rehype-meta-slots'

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
	const contentPath = useContentPath(path)
	const dataKey = computed(() => `content:${contentPath.value}`)
	const post = computed(() => useNuxtData<ContentCollectionItem | null | undefined>(dataKey.value).data.value)

	return {
		dataKey,
		post,
		toc: computed(() => post.value?.body.toc),
		metaSlots: computed(() => post.value?.meta.slots as Record<string, MetaSlotsTree> | undefined),
	}
}
