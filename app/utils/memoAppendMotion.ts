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
		// Give taller batches more travel time and a gentle start while the divider is visible.
		const duration = Math.min(2200, Math.max(1100, distance * 0.61))
		const timing = { duration, easing: 'cubic-bezier(.38,.04,.55,1)', fill: 'both' as const }
		const revealedHeight = Math.max(0, list.offsetHeight - before.height)
		const listTop = list.getBoundingClientRect().top
		animations.push(footer.animate([
			{ transform: `translateY(${-distance}px)` },
			{ transform: 'translateY(0)' },
		], timing))
		animations.push(list.animate([
			{ clipPath: `inset(0 -2px ${revealedHeight}px -2px)` },
			{ clipPath: 'inset(0 -2px 0 -2px)' },
		], timing))
		cards.forEach((card) => {
			const bounds = card.getBoundingClientRect()
			// The shared easing maps these offsets to the divider's reveal progress,
			// so a lower card cannot finish its entrance while it is still clipped.
			const start = Math.min(1, Math.max(0, (bounds.top - listTop - before.height) / Math.max(1, revealedHeight)))
			const end = Math.min(1, Math.max(start, (bounds.bottom - listTop - before.height) / Math.max(1, revealedHeight)))
			animations.push(card.animate([
				{ opacity: 0, transform: 'translateY(10px)', offset: 0 },
				{ opacity: 0, transform: 'translateY(10px)', offset: start },
				{ opacity: 1, transform: 'translateY(0)', offset: end },
				{ opacity: 1, transform: 'translateY(0)', offset: 1 },
			], timing))
		})
	}
	return { cancel, finished: Promise.allSettled(animations.map(animation => animation.finished)).then(cancel) }
}
