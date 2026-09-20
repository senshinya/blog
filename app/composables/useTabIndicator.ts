import type { Ref } from 'vue'

/**
 * 一条指示器在标签之间滑过去，而不是在新位置重新亮起来 ——
 * 把「两个独立状态」变回「一个连续动作」，与 UtilListTransition 的 FLIP 是同一套思路。
 *
 * 只写 transform（translateX + scaleX），不碰 width：宽度是布局属性，逐帧改会触发重排。
 * 指示器自身宽 1px，scaleX 的值即为目标像素宽度。
 *
 * 容器必须是定位元素（position: relative），否则 offsetLeft 量的是更外层的坐标系。
 */
export function useTabIndicator(
	container: Readonly<Ref<HTMLElement | null>>,
	/** 读到的值变化时重新测量：通常是「当前选中项 + 当前语言」。 */
	source: () => unknown,
	activeSelector = '.active',
) {
	const indicatorStyle = ref<Record<string, string>>({ opacity: '0' })
	// 首帧先就位再开启过渡，否则指示器会从 translateX(0) 一路滑到初始标签。
	const indicatorReady = ref(false)

	function measure() {
		const root = container.value
		const active = root?.querySelector<HTMLElement>(activeSelector)
		if (!root || !active) {
			indicatorStyle.value = { opacity: '0' }
			return
		}
		// 纵向也要量：标签行 flex-wrap 后（英文标签在窄屏会换行），
		// 只靠容器底边定位会把指示器留在最后一行下面，与选中项对不上。
		indicatorStyle.value = {
			opacity: '1',
			transform: `translate(${active.offsetLeft}px, ${active.offsetTop + active.offsetHeight}px) scaleX(${active.offsetWidth})`,
		}
	}

	// flush: 'post' —— 等 DOM 上的 .active 换完了再量。
	watch(source, () => nextTick(measure), { flush: 'post' })
	// 换行、缩放、侧栏折叠都会改变标签位置。
	useResizeObserver(container, measure)

	onMounted(async () => {
		await nextTick()
		measure()
		requestAnimationFrame(() => indicatorReady.value = true)
		// 自定义字体换装会改变标签宽度，量早了会偏。
		document.fonts?.ready.then(measure)
	})

	return { indicatorStyle, indicatorReady }
}
