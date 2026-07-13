export interface GiscusCount {
	comments: number
	reactions: { emoji: string, count: number }[]
}

/** GitHub 的 reaction 枚举 → emoji */
const EMOJI: Record<string, string> = {
	THUMBS_UP: '👍',
	THUMBS_DOWN: '👎',
	LAUGH: '😄',
	HOORAY: '🎉',
	CONFUSED: '😕',
	HEART: '❤️',
	ROCKET: '🚀',
	EYES: '👀',
}

const EMPTY: GiscusCount = { comments: 0, reactions: [] }

// 同一 term 在一次会话里只查一次。giscus 没有批量接口，一条 memo 一个请求，
// 而额度是 giscus App 在本仓库上的 5000 次/小时，省着点用。
const cache = new Map<string, GiscusCount>()

/**
 * 读取某条 Discussion 的评论数与 reaction 数。
 *
 * 走 giscus 的公开接口（它用自己 App 的 token 代查 GitHub），
 * 故前端无需任何 token，也不必自建服务端。
 *
 * 但**不能直接 fetch giscus.app** —— 那个接口对任何 Origin 都硬编码返回
 * `Access-Control-Allow-Origin: https://giscus.app`，不回显请求方，浏览器必拦。
 * 故走 /giscus-api/* 这个同源代理，由服务端转发过去。
 * dev 下由 nuxt.config 的 routeRules 提供，生产由 netlify.toml 的 redirects 提供。
 *
 * 尚无人评论/reaction 的 term 不存在对应 Discussion，接口返回 404 —— 这是
 * 绝大多数碎语的常态，按「零互动」处理，不当作错误。
 */
export default function useGiscusCount(term: MaybeRefOrGetter<string>, visible: MaybeRefOrGetter<boolean>) {
	const appConfig = useAppConfig()
	const count = ref<GiscusCount>(EMPTY)

	async function fetchCount() {
		const key = toValue(term)
		const cached = cache.get(key)
		if (cached) {
			count.value = cached
			return
		}

		const { giscus } = appConfig
		if (!giscus?.memoCategory)
			return

		try {
			const data = await $fetch<{
				discussion?: {
					totalCommentCount: number
					reactions: Record<string, { count: number }>
				}
			}>('/giscus-api/discussions', {
				query: {
					repo: giscus.repo,
					term: key,
					category: giscus.memoCategory,
					strict: 'false',
					number: 0,
					first: 1,
				},
			})

			const d = data.discussion
			const result: GiscusCount = d
				? {
						comments: d.totalCommentCount,
						reactions: Object.entries(d.reactions)
							.filter(([, r]) => r.count > 0)
							.map(([key, r]) => ({ emoji: EMOJI[key] ?? key, count: r.count })),
					}
				: EMPTY

			cache.set(key, result)
			count.value = result
		}
		catch {
			// 404 = 还没人互动；429 = 触到 GitHub 限流。两种都只是「没数可显示」，
			// 不该让碎语页报错，故一律按零互动处理并缓存，避免反复重试。
			cache.set(key, EMPTY)
			count.value = EMPTY
		}
	}

	// 只在滚进视口时才请求：一页 20 条若全拉，5000 的额度只够 250 次访问
	const stop = watch(() => toValue(visible), (isVisible) => {
		if (isVisible) {
			fetchCount()
			stop()
		}
	}, { immediate: true })

	return count
}
