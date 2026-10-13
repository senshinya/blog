export interface ViewerSize { width: number, height: number }
export interface ViewerPose { scale: number, x: number, y: number }
export interface ViewerRect { left: number, top: number, width: number, height: number }
export type ViewerCaptionRects = Partial<Record<'title' | 'place' | 'description', ViewerRect>>

function hasPositiveFiniteSize(size: ViewerSize): boolean {
	return Number.isFinite(size.width) && size.width > 0 && Number.isFinite(size.height) && size.height > 0
}

/** Return the image's centered contain size, capped at its native dimensions. */
export function fitViewerImage(image: ViewerSize, viewport: ViewerSize): ViewerSize {
	if (!hasPositiveFiniteSize(image) || !hasPositiveFiniteSize(viewport))
		return { width: 0, height: 0 }

	const scale = Math.min(viewport.width / image.width, viewport.height / image.height, 1)
	return {
		width: image.width * scale,
		height: image.height * scale,
	}
}

/** Keep the scaled image covering the viewport while centering any undersized axis. */
export function clampViewerPose(pose: ViewerPose, fitted: ViewerSize, viewport: ViewerSize): ViewerPose {
	const scale = Number.isFinite(pose.scale) ? Math.min(4, Math.max(1, pose.scale)) : 1
	if (!hasPositiveFiniteSize(fitted) || !hasPositiveFiniteSize(viewport))
		return { scale, x: 0, y: 0 }

	const maxX = Math.max(0, (fitted.width * scale - viewport.width) / 2)
	const maxY = Math.max(0, (fitted.height * scale - viewport.height) / 2)
	const x = Number.isFinite(pose.x) ? pose.x : 0
	const y = Number.isFinite(pose.y) ? pose.y : 0
	const clampedX = Math.min(maxX, Math.max(-maxX, x))
	const clampedY = Math.min(maxY, Math.max(-maxY, y))
	return {
		scale,
		x: clampedX === 0 ? 0 : clampedX,
		y: clampedY === 0 ? 0 : clampedY,
	}
}

/** Change scale while keeping the image point under a viewport-relative cursor fixed. */
export function zoomViewerAt(pose: ViewerPose, nextScale: number, point: { x: number, y: number }, fitted: ViewerSize, viewport: ViewerSize): ViewerPose {
	return pinchViewerAt(pose, nextScale, point, point, fitted, viewport)
}

/** Apply pinch scale and centroid movement from the initial gesture anchor in one transform. */
export function pinchViewerAt(pose: ViewerPose, nextScale: number, origin: { x: number, y: number }, point: { x: number, y: number }, fitted: ViewerSize, viewport: ViewerSize): ViewerPose {
	const currentScale = Number.isFinite(pose.scale) ? Math.min(4, Math.max(1, pose.scale)) : 1
	const scale = Number.isFinite(nextScale) ? Math.min(4, Math.max(1, nextScale)) : 1
	const centerX = viewport.width / 2
	const centerY = viewport.height / 2
	return clampViewerPose({
		scale,
		x: point.x - centerX - ((origin.x - centerX - pose.x) / currentScale) * scale,
		y: point.y - centerY - ((origin.y - centerY - pose.y) / currentScale) * scale,
	}, fitted, viewport)
}

/** Return the adjacent photo direction for an unzoomed horizontal swipe. */
export function viewerSwipe(dx: number, dy: number, scale: number): -1 | 0 | 1 {
	if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(scale) || scale > 1.01 || Math.abs(dx) < 60 || Math.abs(dx) <= Math.abs(dy) * 1.3)
		return 0
	return dx < 0 ? 1 : -1
}

/** Transform a centered target element onto the source rectangle for a closing morph. */
export function viewerMorph(source: ViewerRect, target: ViewerRect): string {
	if (
		![source.left, source.top, source.width, source.height, target.left, target.top, target.width, target.height].every(Number.isFinite)
		|| source.width <= 0 || source.height <= 0 || target.width <= 0 || target.height <= 0
	) {
		return 'none'
	}

	const dx = source.left + source.width / 2 - (target.left + target.width / 2)
	const dy = source.top + source.height / 2 - (target.top + target.height / 2)
	return `translate3d(${dx}px, ${dy}px, 0) scale(${source.width / target.width}, ${source.height / target.height})`
}
