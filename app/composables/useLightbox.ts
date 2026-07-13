import { LazyPopoverLightbox } from '#components'

/**
 * 为任意 <img> 元素打开灯箱。
 *
 * 与 content/Pic.vue 不同：Pic 在编译期就绑定了自己的那一张图，
 * 而这里的目标元素是点击时才确定的，故适用于「一个容器里多张图」
 * （文章正文、碎语列表）的场景。
 */
export default function useLightbox() {
	const modalStore = useModalStore()
	const target = shallowRef<HTMLImageElement>()

	// 渲染函数在 open() 时才求值，因此能取到本次点击的那张图
	const { open } = modalStore.use(
		() => target.value
			? h(LazyPopoverLightbox, {
					el: target.value,
					caption: target.value.alt,
				})
			: null,
		{ unique: true },
	)

	return function openLightbox(img: HTMLImageElement) {
		target.value = img
		open()
	}
}
