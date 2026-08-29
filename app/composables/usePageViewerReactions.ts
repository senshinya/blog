interface ViewerReactionsResponse {
	[key: string]: string[]
}

/** 与后端单次最多 50 个 key 的限制保持一致。 */
const CHUNK = 50

/**
 * 批量取得当前登录用户在各页面点过的 reaction。
 *
 * 这份数据带会话，不能混进公开计数缓存。只有确认登录后才请求；会话切换时
 * 清空旧投影，并丢弃切换前才返回的响应，避免把前一个账号的状态画到新会话上。
 */
export default function usePageViewerReactions(keys: MaybeRefOrGetter<string[]>) {
	const api = useCommentApi()
	const session = useCommentSession()
	const viewerReactions = ref<Record<string, string[]>>({})
	const fetched = new Set<string>()
	const pending = new Set<string>()
	let chain: Promise<void> = Promise.resolve()

	async function loadMissing() {
		await session.load()
		if (!session.ready.value || !session.user.value)
			return

		const missing = [...new Set(toValue(keys))]
			.filter(key => key && !fetched.has(key) && !pending.has(key))
		if (!missing.length)
			return

		for (const key of missing)
			pending.add(key)

		const startedEpoch = session.epoch.value
		const startedUser = session.user.value.id
		for (let i = 0; i < missing.length; i += CHUNK) {
			const chunk = missing.slice(i, i + CHUNK)
			try {
				const data = await api.request<ViewerReactionsResponse>('/api/pages/viewer-reactions', {
					query: { key: chunk },
				})
				if (session.epoch.value !== startedEpoch || session.user.value?.id !== startedUser)
					return

				const next = { ...viewerReactions.value }
				for (const key of chunk) {
					next[key] = data[key] ?? []
					fetched.add(key)
				}
				viewerReactions.value = next
			}
			catch {
				// 私人投影失败不影响列表和公开计数；key 保持未完成，后续变化时可重试。
			}
			finally {
				for (const key of chunk)
					pending.delete(key)
			}
		}
	}

	function schedule() {
		if (!import.meta.client)
			return
		chain = chain.then(loadMissing, loadMissing)
	}

	watch([
		() => toValue(keys),
		() => session.ready.value,
		() => session.user.value?.id,
	], schedule, { deep: true, immediate: true })

	watch(session.epoch, () => {
		viewerReactions.value = {}
		fetched.clear()
		pending.clear()
	}, { flush: 'sync' })

	onMounted(() => session.load())

	return readonly(viewerReactions)
}
