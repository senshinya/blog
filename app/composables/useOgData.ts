export interface OgData {
	title?: string
	description?: string
	image?: string
	siteName?: string
}

const EMPTY: OgData = {}

/**
 * 同一个链接在一次会话里只抓一次。
 *
 * 空结果照样入缓存 —— 一个没有 og 标签的站点，抓一百次也还是空的，
 * 缓存下来免得每次滚回去都重来一遍。
 */
const cache = new Map<string, OgData>()

/**
 * 同一链接的在途请求合流。
 *
 * 光有 cache 挡不住同时起飞的那一批：同一个链接出现在多条碎语里、又恰好一起进视口时，
 * 缓存还没写上，几个请求就都发出去了。
 */
const inflight = new Map<string, Promise<OgData>>()

function fetchOg(url: string) {
	const cached = cache.get(url)
	if (cached)
		return Promise.resolve(cached)

	const existing = inflight.get(url)
	if (existing)
		return existing

	const task = $fetch<OgData>('/api/og', { query: { url } })
		// 抓不到就是抓不到：目标站超时、拦爬虫、压根没有 og 标签，对读者都一样。
		// 一律按空结果处理，让卡片停在域名打底态，不弹任何错误
		.catch(() => EMPTY)
		.then((data) => {
			cache.set(url, data)
			inflight.delete(url)
			return data
		})

	inflight.set(url, task)
	return task
}

/**
 * 取某个链接的 Open Graph 元数据，供碎语的链接预览卡使用。
 *
 * 只在链接滚进视口时才发请求 —— 一屏二十条碎语，开屏就把每个外链都打一遍
 * 既慢又浪费（同 useGiscusCount 的考虑）。
 */
export default function useOgData(url: MaybeRefOrGetter<string>, visible: MaybeRefOrGetter<boolean>) {
	const og = ref<OgData>(EMPTY)

	// 用一次性开关而非 watch 返回的 stop()：visible 若在首次求值时就为真，
	// immediate 的回调会在 stop 完成赋值之前同步跑起来，届时碰 stop 即 TDZ 报错
	let started = false
	watch(() => toValue(visible), async (isVisible) => {
		if (!isVisible || started)
			return
		started = true
		og.value = await fetchOg(toValue(url))
	}, { immediate: true })

	return og
}
