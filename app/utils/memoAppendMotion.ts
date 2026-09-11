interface MemoAppendSnapshot {
	count: number
	height: number
	footerTop: number
}

/** A: keep the divider attached to the edge of the newly revealed batch. */
export function startMemoAppendMotion(list: HTMLElement, footer: HTMLElement, before: MemoAppendSnapshot) {
	const cards = Array.from(list.children).slice(before.count) as HTMLElement[]
	// WAAPI owns this entrance; consuming CSS entrance also prevents later replay.
	cards.forEach(card => card.dataset.nativeEntered = '')
	const distance = footer.offsetTop - before.footerTop
	const animations: Animation[] = []
	const cancel = () => animations.splice(0).forEach(animation => animation.cancel())
	if (distance > 0 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
		const timing = { duration: 480, easing: 'cubic-bezier(.22,.7,.2,1)', fill: 'both' as const }
		animations.push(footer.animate([
			{ transform: `translateY(${-distance}px)` },
			{ transform: 'translateY(0)' },
		], timing))
		animations.push(list.animate([
			{ clipPath: `inset(0 -2px ${Math.max(0, list.offsetHeight - before.height)}px -2px)` },
			{ clipPath: 'inset(0 -2px 0 -2px)' },
		], timing))
		cards.forEach((card, index) => {
			animations.push(card.animate([
				{ opacity: 0, transform: 'translateY(10px)' },
				{ opacity: 1, transform: 'translateY(0)' },
			], { ...timing, duration: 220, delay: Math.min(index, 4) * 30 }))
		})
	}
	return { cancel, finished: Promise.allSettled(animations.map(animation => animation.finished)).then(cancel) }
}
