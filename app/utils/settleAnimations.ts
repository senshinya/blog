/** Let local controls finish moving before a document view transition freezes them. */
export async function settleAnimations(element: Pick<Element, 'getAnimations'> | null | undefined, maxDuration = Infinity) {
	const animations = (element?.getAnimations({ subtree: true }) ?? [])
		.filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime ?? 0))
	for (const animation of animations) {
		const endTime = Number(animation.effect?.getComputedTiming().endTime ?? 0)
		const currentTime = typeof animation.currentTime === 'number' ? animation.currentTime : 0
		const rate = (endTime - currentTime) / maxDuration
		// Speed up only this close; reopening still uses the original CSS spring.
		if (maxDuration > 0 && rate > animation.playbackRate)
			animation.updatePlaybackRate(rate)
	}
	await Promise.allSettled(animations.map(animation => animation.finished))
}
