/** Capture before TransitionGroup takes the leaving widget out of flex flow. */
export function prepareWidgetLeave(element: HTMLElement | null | undefined) {
	const aside = element?.parentElement
	if (!element || aside?.id !== 'blog-aside')
		return
	const rect = element.getBoundingClientRect()
	element.style.top = `${rect.top - aside.getBoundingClientRect().top + aside.scrollTop - aside.clientTop}px`
	element.style.height = `${rect.height}px`
}

/** Completed entrances must not interfere with Vue's transform-move detection. */
export async function finishWidgetEntrance(element: HTMLElement | null | undefined) {
	if (!element)
		return
	const entrances = element.getAnimations()
		.filter(animation => 'animationName' in animation && animation.animationName === 'widget-in')
	// SSR may finish its entrance before Vue attaches event listeners.
	await Promise.allSettled(entrances.map(animation => animation.finished))
	element.dataset.nativeEntered = ''
}
