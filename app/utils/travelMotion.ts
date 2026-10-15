const curve = [0.22, 1, 0.36, 1] as const

/** Shared timing for the journal's CSS, photo morphs and map camera. */
export const travelMotion = {
	duration: { feedback: 160, photo: 220, mode: 280, map: 650 },
	easing: `cubic-bezier(${curve.join(', ')})`,
} as const

export const travelMotionStyles = {
	'--travel-motion-feedback': `${travelMotion.duration.feedback}ms`,
	'--travel-motion-photo': `${travelMotion.duration.photo}ms`,
	'--travel-motion-mode': `${travelMotion.duration.mode}ms`,
	'--travel-motion-map': `${travelMotion.duration.map}ms`,
	'--travel-motion-easing': travelMotion.easing,
}

/** Numeric equivalent of the CSS curve for MapLibre's easing callback. */
export function travelMotionEase(progress: number): number {
	if (progress <= 0 || progress >= 1)
		return Math.max(0, Math.min(1, progress))
	const coordinate = (t: number, a: number, b: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3
	let low = 0
	let high = 1
	for (let i = 0; i < 20; i++) {
		const t = (low + high) / 2
		if (coordinate(t, curve[0], curve[2]) < progress)
			low = t
		else high = t
	}
	return coordinate((low + high) / 2, curve[1], curve[3])
}
