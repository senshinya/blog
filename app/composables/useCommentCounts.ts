export interface CommentCount {
	comments: number
	/** 原样的 {emoji: count}，直接喂给 CommentReactions */
	reactions: Record<string, number>
}

interface CountsResponse {
	[key: string]: { comments: number, reactions: Record<string, number> }
}

const EMPTY: CommentCount = { comments: 0, reactions: {} }

/** 服务端一次最多收 50 个 key */
const CHUNK = 50

/**
 * 模块级的合并队列。
 *
 * 只在客户端写入（下面每个入口都有 import.meta.client 守卫），
 * 预渲染时它始终是空的，故不存在跨请求串数据的问题。
 */
const cache = shallowReactive(new Map<string, CommentCount>())
const queue = new Set<string>()
let timer: ReturnType<typeof setTimeout> | undefined

async function flush(request: ReturnType<typeof useCommentApi>['request']) {
	timer = undefined
	const keys = [...queue]
	queue.clear()

	for (let i = 0; i < keys.length; i += CHUNK) {
		const chunk = keys.slice(i, i + CHUNK)
		try {
			// key 是可重复参数，ufo 会把数组展成 key=a&key=b
			const data = await request<CountsResponse>('/api/pages/counts', {
				query: { key: chunk },
				credentials: 'omit',
			})
			for (const key of chunk) {
				const hit = data[key]
				cache.set(key, hit ?? EMPTY)
			}
		}
		catch {
			// 没数可显示不该让碎语列表报错。写空值而不是留空，避免下次进视口又重试一轮
			for (const key of chunk)
				cache.set(key, EMPTY)
		}
	}
}

/**
 * 读取若干页面的评论数与 reaction 数。
 *
 * giscus 时代一条 memo 一个请求，还得靠 useElementVisibility 卡着视口省额度；
 * 现在 /api/pages/counts 是批量的，同一帧内登记的 key 会合并成一次请求，
 * 一屏 20 张卡片也只发一发，不必再等滚动。
 */
export default function useCommentCounts(key: MaybeRefOrGetter<string | undefined>) {
	const { request } = useCommentApi()

	function enqueue(k: string) {
		if (!import.meta.client || cache.has(k))
			return
		// 先占位，避免同一 key 在同一帧里被多个组件重复入队
		cache.set(k, EMPTY)
		queue.add(k)
		timer ??= setTimeout(flush, 0, request)
	}

	watch(() => toValue(key), (k) => {
		if (k)
			enqueue(k)
	}, { immediate: true })

	return computed(() => {
		const k = toValue(key)
		return (k ? cache.get(k) : undefined) ?? EMPTY
	})
}

/**
 * 发表 / 删除评论后就地改数。
 *
 * 早先这里是把缓存项删掉、指望下次再取，但入队只发生在 key 变化时 ——
 * 删完没人再问，那张卡片的数字直接掉成 0，连带页脚（靠 reaction 数决定显不显）
 * 在鼠标移开后又缩回去，非得刷新一次才恢复。
 */
export function bumpCommentCount(key: string, delta: number) {
	const hit = cache.get(key)
	if (hit)
		cache.set(key, { ...hit, comments: Math.max(0, hit.comments + delta) })
}

/** 点完 reaction 把这一份写回缓存，卡片收起再展开、路由来回切也还在 */
export function patchCommentReactions(key: string, reactions: Record<string, number>) {
	const hit = cache.get(key)
	if (hit)
		cache.set(key, { ...hit, reactions })
}
