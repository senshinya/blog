import type { Ref } from 'vue'

/** Warm just the next resized reading image after navigation has settled. */
export function useTravelPhotoPreload(source: Readonly<Ref<string | undefined>>, blocked: Readonly<Ref<boolean>>) {
	const warmed = new Set<string>()
	let timer: number | undefined
	let idle: number | undefined
	let stopWatch: (() => void) | undefined
	let disposed = false

	function cancel() {
		if (timer !== undefined)
			window.clearTimeout(timer)
		if (idle !== undefined)
			window.cancelIdleCallback(idle)
		timer = undefined
		idle = undefined
	}
	function allowed() {
		const connection = (navigator as Navigator & { connection?: { saveData?: boolean, effectiveType?: string } }).connection
		return document.visibilityState === 'visible' && !connection?.saveData && !['slow-2g', '2g'].includes(connection?.effectiveType ?? '')
	}
	function queue() {
		cancel()
		const src = source.value
		if (disposed || !src || blocked.value || warmed.has(src) || !allowed())
			return
		timer = window.setTimeout(() => {
			timer = undefined
			const load = () => {
				idle = undefined
				if (disposed || blocked.value || source.value !== src || !allowed() || warmed.has(src))
					return
				const image = new Image()
				image.decoding = 'async'
				image.fetchPriority = 'low'
				image.src = src
				warmed.add(src)
			}
			if (window.requestIdleCallback)
				idle = window.requestIdleCallback(load, { timeout: 1500 })
			else load()
		}, 180)
	}
	onMounted(() => {
		stopWatch = watch([source, blocked], queue, { immediate: true })
		useEventListener(document, 'visibilitychange', queue)
	})
	onScopeDispose(() => {
		disposed = true
		stopWatch?.()
		cancel()
	})
}
