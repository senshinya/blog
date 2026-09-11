/** Keep the existing prose elements as the identity of each translated comment. */
export function captureCommentText(root: HTMLElement | null) {
	return new Map(Array.from(root?.querySelectorAll<HTMLElement>('.comment .prose') ?? [])
		.map(element => [element, element.innerHTML]))
}

export function animateCommentTranslation(
	before: Map<HTMLElement, string>,
	reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches,
	viewportHeight = window.innerHeight,
) {
	const animations: Animation[] = []
	const cancel = () => animations.splice(0).forEach(animation => animation.cancel())
	if (!reducedMotion) {
		for (const [element, html] of before) {
			if (element.innerHTML === html)
				continue
			const rect = element.getBoundingClientRect()
			if (rect.bottom <= 0 || rect.top >= viewportHeight)
				continue
			animations.push(element.animate([
				{ opacity: 0, transform: 'translateY(3px)' },
				{ opacity: 1, transform: 'translateY(0)' },
			], { duration: 220, easing: 'ease' }))
		}
	}
	void Promise.allSettled(animations.map(animation => animation.finished)).then(cancel)
	return cancel
}
