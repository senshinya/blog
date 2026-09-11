import type { MaybeComputedElementRef } from '@vueuse/core'

/** Start a resource once near the viewport; async consumers must check isActive after awaits. */
export function useVisibleTask(target: MaybeComputedElementRef, task: (isActive: () => boolean) => unknown) {
	let started = false
	let disposed = false
	let stop = () => {}
	function start() {
		if (started || disposed)
			return
		started = true
		stop()
		void task(() => !disposed)
	}
	const observer = useIntersectionObserver(target, (entries) => {
		if (entries.some(entry => entry.isIntersecting))
			start()
	}, { rootMargin: '200px' })
	stop = observer.stop
	onMounted(() => {
		if (!observer.isSupported.value)
			start()
	})
	onScopeDispose(() => {
		disposed = true
		stop()
	})
}
