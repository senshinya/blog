import { toArray } from '@vueuse/core'

interface Rect {
	left: number | string
	top: number | string
	width: number | string
	height: number | string
}

type MaybeArray<T> = T | T[]

function toRect(rect: Element | Rect): Rect {
	return rect instanceof Element ? rect.getBoundingClientRect() : rect
}

const ensurePx = (val: number | string) => typeof val === 'number' ? `${val}px` : val

/** CSS 时间转为 WAAPI 使用的毫秒，兼容构建压缩前后的 s / ms。 */
export function parseCssTime(value: string) {
	const time = value.trim()
	return Number.parseFloat(time) * (time.endsWith('ms') ? 1 : 1000)
}

export function animateBetweenRects(
	el: MaybeRefOrGetter<Element>,
	rect: MaybeArray<MaybeRefOrGetter<Element> | Rect>,
	options?: KeyframeAnimationOptions,
) {
	const rects = toArray(rect).map(r => toRect(toValue(r)))

	return toValue(el).animate(rects.map(r => ({
		left: ensurePx(r.left),
		top: ensurePx(r.top),
		width: ensurePx(r.width),
		height: ensurePx(r.height),
	})), {
		duration: 100,
		fill: 'forwards',
		...options,
	})
}

/**
 * 逐项错峰的 --delay。列表卡片的入场动画请改用 useEntranceDelay()，
 * 它在这之上多做一件事：切换语言时不播入场（理由见该文件）。
 */
export const getFixedDelay = (s: number, fixed = 2) => ({ '--delay': `${s.toFixed(fixed)}s` })
