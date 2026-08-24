import type { Me } from '~/utils/comment'

/**
 * 当前访客。全站共用一份 —— 一个页面上可能同时有文章评论区和若干碎语卡片，
 * 各自去问一遍 /api/me 是浪费。
 *
 * 用 useState 而不是模块级 ref：后者在 SSR/预渲染时会跨请求共享。
 * 这里虽然只在客户端取数，但状态本身要能进 payload 才不会在水合时闪一下。
 */
/**
 * 在途的 /api/me。
 *
 * 早先这里在 status 不是 idle 时直接 return，调用方 await 完拿到的是
 * 「问完了，没人登录」—— 于是已登录的人手快一点，点 reaction 就会被弹去 OAuth
 * 白转一圈。多个调用方必须等的是同一发请求。
 *
 * 只在客户端赋值（load 开头有 import.meta.client 守卫），预渲染时始终是
 * undefined，故不存在跨请求串状态的问题。（同 useCommentCounts 的模块级队列。）
 */
let inflight: Promise<void> | undefined
let logoutInflight: Promise<void> | undefined
const pendingDataInvalidations = new Set<string>()

export function invalidateCommentData(
	revisions: { value: Record<string, number> },
	pageKey: string,
) {
	if (pendingDataInvalidations.has(pageKey))
		return false
	pendingDataInvalidations.add(pageKey)
	revisions.value = {
		...revisions.value,
		[pageKey]: (revisions.value[pageKey] ?? 0) + 1,
	}
	queueMicrotask(() => pendingDataInvalidations.delete(pageKey))
	return true
}

export function performCommentLogout(
	request: () => Promise<unknown>,
	clear: () => void,
) {
	// 页面上可能同时展开多个评论区。登出必须共享同一发请求，否则两个按钮
	// 在响应回来前各点一次，就会重复 POST，并让后到的失败覆盖先到的成功。
	logoutInflight ??= Promise.resolve()
		.then(request)
		.then(() => clear())
		.finally(() => {
			logoutInflight = undefined
		})
	return logoutInflight
}

export default function useCommentSession() {
	const api = useCommentApi()
	const me = useState<Me | null>('comment:me', () => null)
	const status = useState<'idle' | 'pending' | 'ready' | 'error'>('comment:me:status', () => 'idle')
	/** 成功登出才递增：所有会话相关投影据此同时失效。 */
	const epoch = useState<number>('comment:session-epoch', () => 0)
	/** 旧组件里的写请求结算后按页面递增，让对应线程重取公开权威状态。 */
	const dataRevisions = useState<Record<string, number>>('comment:data-revisions', () => ({}))

	const user = computed(() => me.value?.user ?? null)
	const isOwner = computed(() => me.value?.is_owner === true)
	const banned = computed(() => me.value?.banned === true)
	/** 未取数完成前不要渲染「登录后参与讨论」，否则已登录用户会先看到一次横幅 */
	const ready = computed(() => status.value === 'ready' || status.value === 'error')

	function load(force = false) {
		if (!import.meta.client)
			return Promise.resolve()
		if (force)
			inflight = undefined
		// 问过一次就不再问：promise 结算后仍然留着，后来的 await 立即返回
		inflight ??= (async () => {
			const started = epoch.value
			status.value = 'pending'
			try {
				// 匿名访客也是 200，回 { user: null }，故这里不该有 401 分支
				const next = await api.request<Me>('/api/me')
				if (epoch.value !== started)
					return
				me.value = next
				status.value = 'ready'
			}
			catch {
				if (epoch.value !== started)
					return
				// 评论服务挂了不该让文章页跟着报错，按未登录处理
				me.value = null
				status.value = 'error'
			}
		})()
		return inflight
	}

	/** returnTo 传就近的锚点，登录回来才落在刚才点的地方，而不是页面顶部 */
	function login(returnTo?: string) {
		location.href = api.loginUrl(returnTo)
	}

	async function logout() {
		await performCommentLogout(
			() => api.request('/auth/logout', { method: 'POST' }),
			() => {
				me.value = { user: null }
				status.value = 'ready'
				epoch.value += 1
			},
		)
	}

	/** 「回复时邮件通知我」是账号级开关，与单页订阅是两件事 */
	async function setNotifyReplies(on: boolean) {
		const started = epoch.value
		const next = await api.request<Me>('/api/me', {
			method: 'PATCH',
			body: { notify_replies: on },
		})
		if (epoch.value === started)
			me.value = next
	}

	function invalidateData(pageKey: string) {
		invalidateCommentData(dataRevisions, pageKey)
	}

	return {
		me,
		user,
		isOwner,
		banned,
		ready,
		status,
		epoch,
		dataRevisions,
		load,
		login,
		logout,
		setNotifyReplies,
		invalidateData,
	}
}
