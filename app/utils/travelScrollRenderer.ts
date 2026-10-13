interface ScrollLayer { element: HTMLElement, start: number, end: number }
const positions = new WeakMap<HTMLElement, (native: number) => number>()

/** Diagnostics report the visible position separately from integer native offsets. */
export function readTravelScrollVisualPosition(element: HTMLElement, native = element.scrollTop) {
	return positions.get(element)?.(native) ?? native
}

/** Preserve subpixel movement without compositing the whole travel article. */
export function createTravelScrollRenderer(element: HTMLElement, enabled: () => boolean) {
	let native = element.scrollTop
	let position = native
	let quantized = false
	let viewport = element.clientHeight
	let layers: ScrollLayer[] = []
	const active = new Set<HTMLElement>()
	const originals = new Map<HTMLElement, string>()

	function clear() {
		for (const layer of active)
			layer.style.transform = originals.get(layer) ?? ''
		active.clear()
	}
	function paint() {
		const offset = native - position
		if (!enabled() || Math.abs(offset) < 0.001) {
			clear()
			return
		}
		const visible = new Set(layers.filter(layer => layer.end > native - 1 && layer.start < native + viewport + 1).map(layer => layer.element))
		for (const layer of active) {
			if (!visible.has(layer)) {
				layer.style.transform = originals.get(layer) ?? ''
				active.delete(layer)
			}
		}
		for (const layer of visible) {
			layer.style.transform = `translate3d(0, ${offset}px, 0)`
			active.add(layer)
		}
	}
	positions.set(element, actual => actual === native && (active.size || position === native) ? position : actual)
	return {
		get position() { return position },
		get quantized() { return quantized },
		offsetFor(layer: HTMLElement) { return active.has(layer) ? native - position : 0 },
		sync() {
			const actual = element.scrollTop
			if (actual !== native || !enabled()) {
				clear()
				native = position = actual
			}
		},
		write(value: number) {
			element.scrollTop = value
			native = element.scrollTop
			const fraction = native - value
			if (enabled() && Number.isInteger(native) && Math.abs(fraction) > 0.02 && Math.abs(fraction) < 1.01)
				quantized = true
			const compensate = enabled() && quantized && Math.abs(fraction) < 1.01
			position = compensate ? value : native
			paint()
		},
		measure(next: ScrollLayer[], height: number) {
			layers = next
			viewport = height
			for (const layer of next) {
				if (!originals.has(layer.element))
					originals.set(layer.element, layer.element.style.transform)
			}
			paint()
		},
		dispose() {
			clear()
			positions.delete(element)
			layers = []
			originals.clear()
		},
	}
}
