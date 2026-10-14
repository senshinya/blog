import type { Ref } from 'vue'
import type { TravelSnapField, TravelSnapKind } from '../utils/travelScroll'
import { onMounted, onScopeDispose, watch } from 'vue'
import { chooseMagneticSnap, createSnapField, inverseMagneticPosition, magneticScrollPosition, smoothTravelScrollPosition } from '../utils/travelScroll'
import { createTravelScrollRenderer } from '../utils/travelScrollRenderer'

interface TravelSpringScrollOptions {
	blocked: () => boolean
	onNodeChange: (key: string) => void
}

const ignoredGestureTargets = 'input,textarea,select,[contenteditable],.map-detail-map'
const ignoredKeyboardTargets = 'a,button,input,textarea,select,summary,video,dialog,[contenteditable],[role="button"],[role="menu"],[role="listbox"],.map-detail-map,.maplibregl-map'

export function useTravelSpringScroll(root: Ref<HTMLElement | null | undefined>, options: TravelSpringScrollOptions) {
	let controller: ReturnType<typeof attach> | undefined
	let stopRootWatch: (() => void) | undefined
	let disposed = false

	function attach(element: HTMLElement) {
		const win = element.ownerDocument.defaultView!
		const reduced = win.matchMedia('(prefers-reduced-motion: reduce)')
		const originalViewport = element.style.getPropertyValue('--reading-viewport')
		const originalSnapState = element.dataset.snapState
		const originalNode = element.dataset.readingNode
		let detached = false
		let springFrame = 0
		let inputFrame = 0
		let measuredWidth = element.clientWidth
		const renderer = createTravelScrollRenderer(element, () => measuredWidth <= 700 && !reduced.matches)
		let smoothTarget = renderer.position
		let smoothTimestamp = 0
		let snapTimer = 0
		let springRunning = false
		let springDestination = 0
		let pointerHeld = false
		let gestureActive = false
		let controlledGesture = false
		let nativeGestureIgnored = false
		let lastScroll = renderer.position
		let gestureOrigin = lastScroll
		let inputField: TravelSnapField | undefined
		let inputPosition = 0
		let inputOrigin = 0
		let lastInputTime = 0
		let inputVelocity = 0
		let touchPoint: { x: number, y: number } | undefined
		let touchVertical = false
		let measuredHeight = element.clientHeight
		let lastNode: string | undefined
		let measuredSteps: { key: string, start: number, end: number }[] = []
		let measuredField: TravelSnapField | undefined
		let measuredMax = 0
		let measurementPending = false

		const readingSteps = () => [...element.querySelectorAll<HTMLElement>('.reading-step[data-node]')]
		const maxScroll = () => measuredMax
		const ignored = (target: EventTarget | null, selector: string) => target instanceof Element && !!target.closest(selector)

		function clearSnapTimer() {
			win.clearTimeout(snapTimer)
			snapTimer = 0
		}

		function cancel() {
			renderer.sync()
			if (inputFrame)
				win.cancelAnimationFrame(inputFrame)
			inputFrame = 0
			if (springFrame)
				win.cancelAnimationFrame(springFrame)
			springFrame = 0
			springRunning = false
			controlledGesture = false
			gestureActive = false
			inputField = undefined
			touchPoint = undefined
			touchVertical = false
			pointerHeld = false
			clearSnapTimer()
			lastScroll = renderer.position
			if (!detached)
				element.dataset.snapState = 'idle'
		}

		function readReadingNode() {
			if (detached || options.blocked())
				return
			const anchor = renderer.position + measuredHeight * 0.5
			const step = measuredSteps.find(step => step.start <= anchor && step.end > anchor) ?? measuredSteps.find(step => step.start > anchor) ?? measuredSteps.at(-1)
			const key = step?.key
			if (!key)
				return
			if (key !== lastNode) {
				element.dataset.readingNode = key
				lastNode = key
				options.onNodeChange(key)
			}
		}

		function springTo(target: number, initialVelocity = 0, immediate = false) {
			cancel()
			if (detached || options.blocked())
				return
			if (measurementPending)
				target = refreshDestination(target)
			nativeGestureIgnored = false
			target = Math.max(0, Math.min(maxScroll(), target))
			springDestination = target
			if (immediate || reduced.matches || Math.abs(renderer.position - target) < 0.5) {
				renderer.write(target)
				lastScroll = renderer.position
				element.dataset.snapState = 'settled'
				readReadingNode()
				return
			}
			let position = renderer.position
			let velocity = Math.sign(target - position) === Math.sign(initialVelocity) ? initialVelocity : 0
			let previous = win.performance.now()
			const started = previous
			const stiffness = 240
			const damping = Math.abs(position - target) > element.clientHeight * 2 ? 32 : 26
			springRunning = true
			element.dataset.snapState = 'spring'
			function tick(now: number) {
				if (detached || options.blocked() || reduced.matches) {
					cancel()
					return
				}
				let remaining = Math.min((now - previous) / 1000, 0.04)
				previous = now
				while (remaining > 0) {
					const dt = Math.min(remaining, 1 / 120)
					velocity += (-stiffness * (position - target) - damping * velocity) * dt
					position += velocity * dt
					remaining -= dt
				}
				renderer.write(position)
				lastScroll = renderer.position
				readReadingNode()
				if (detached || !springRunning)
					return
				if ((Math.abs(position - target) < 0.3 && Math.abs(velocity) < 3) || now - started > 1600) {
					renderer.write(target)
					lastScroll = renderer.position
					springRunning = false
					springFrame = 0
					if (measurementPending) {
						target = refreshDestination(target)
						renderer.write(target)
						lastScroll = renderer.position
					}
					element.dataset.snapState = 'settled'
					readReadingNode()
					return
				}
				springFrame = win.requestAnimationFrame(tick)
			}
			springFrame = win.requestAnimationFrame(tick)
		}

		function refreshDestination(target: number) {
			const start = measuredSteps.find(step => Math.abs(step.start - target) < 1)
			const tail = start ? undefined : measuredSteps.find(step => Math.abs(step.end - measuredHeight - target) < 1)
			const atEnd = Math.abs(target - measuredMax) < 1
			cancel()
			measureReadingSteps()
			const step = measuredSteps.find(step => step.key === (start ?? tail)?.key)
			if (step) {
				const bottom = step.end - measuredHeight
				return Math.min(measuredMax, start || bottom - step.start <= 8 ? step.start : bottom)
			}
			return atEnd ? measuredMax : Math.max(0, Math.min(measuredMax, target))
		}

		function currentSnapField() {
			if (!measuredField)
				measureReadingSteps()
			return measuredField!
		}

		function beginMagneticGesture() {
			const held = pointerHeld
			const touch = touchPoint
			const vertical = touchVertical
			cancel()
			pointerHeld = held
			touchPoint = touch
			touchVertical = vertical
			gestureActive = true
			nativeGestureIgnored = false
			gestureOrigin = renderer.position
			inputField = currentSnapField()
			const resting = inputField.stops.reduce((best, stop) => Math.abs(stop - gestureOrigin) < Math.abs(best - gestureOrigin) ? stop : best, inputField.stops[0]!)
			// WebKit reads and writes integer scrollTop; keep the logical resting anchor.
			inputPosition = Math.abs(resting - gestureOrigin) < 1 ? resting : inverseMagneticPosition(gestureOrigin, inputField)
			inputOrigin = inputPosition
			lastInputTime = win.performance.now()
			inputVelocity = 0
			controlledGesture = true
		}

		function queueSettle(delay: number) {
			if (detached)
				return
			clearSnapTimer()
			snapTimer = win.setTimeout(settleScroll, delay)
		}

		function smoothInputTo(target: number, responseMs = 65) {
			const precision = responseMs < 65 ? renderer.quantized ? 0.01 : 0.1 : 0.5
			smoothTarget = target
			if (inputFrame)
				return
			smoothTimestamp = win.performance.now()
			let position = renderer.position
			function tick(now: number) {
				if (detached || options.blocked() || reduced.matches) {
					cancel()
					return
				}
				const next = smoothTravelScrollPosition(position, smoothTarget, now - smoothTimestamp, responseMs)
				smoothTimestamp = now
				// Accumulate subpixel movement before assigning the browser's integer offset.
				position = Math.abs(next - smoothTarget) < precision ? smoothTarget : next
				renderer.write(position)
				lastScroll = renderer.position
				readReadingNode()
				if (detached || !inputFrame)
					return
				if (Math.abs(position - smoothTarget) < precision) {
					inputFrame = 0
					return
				}
				inputFrame = win.requestAnimationFrame(tick)
			}
			inputFrame = win.requestAnimationFrame(tick)
		}

		function applyMagneticInput(delta: number, touch = false) {
			if (!controlledGesture)
				beginMagneticGesture()
			const field = inputField!
			const before = magneticScrollPosition(inputPosition, field, inputOrigin)
			const now = win.performance.now()
			const elapsed = Math.max(16, now - lastInputTime)
			inputVelocity = Math.max(-3000, Math.min(3000, delta * 1000 / elapsed))
			lastInputTime = now
			inputPosition = Math.max(0, Math.min(field.max, inputPosition + delta))
			const next = magneticScrollPosition(inputPosition, field, inputOrigin)
			const response = Math.abs(next - before) / Math.max(1, Math.abs(delta))
			element.dataset.snapState = response < 0.85 ? 'resisting' : response > 1.08 ? 'attracting' : 'dragging'
			// Touch events can arrive below display refresh rate; follow between samples.
			smoothInputTo(next, touch ? 12 : 65)
			queueSettle(150)
		}

		function settleScroll() {
			clearSnapTimer()
			if (detached || reduced.matches || options.blocked()) {
				cancel()
				return
			}
			if (springRunning || pointerHeld || !gestureActive)
				return
			const field = controlledGesture ? inputField! : currentSnapField()
			const value = controlledGesture ? inputPosition : renderer.position
			const origin = controlledGesture ? inputOrigin : gestureOrigin
			const target = chooseMagneticSnap(value, origin, field)
			const velocity = controlledGesture ? inputVelocity * 0.12 : 0
			gestureActive = false
			controlledGesture = false
			lastScroll = renderer.position
			if (target === null) {
				if (measurementPending) {
					cancel()
					measureReadingSteps()
				}
				element.dataset.snapState = 'free'
				return
			}
			springTo(target, velocity)
		}

		function onScroll() {
			renderer.sync()
			readReadingNode()
			if (detached)
				return
			if (springRunning || inputFrame || controlledGesture || nativeGestureIgnored || reduced.matches || options.blocked()) {
				lastScroll = renderer.position
				return
			}
			if (Math.abs(renderer.position - lastScroll) < 0.5)
				return
			if (!gestureActive) {
				gestureOrigin = lastScroll
				gestureActive = true
			}
			lastScroll = renderer.position
			element.dataset.snapState = 'dragging'
			queueSettle(170)
		}

		function onScrollEnd() {
			if (!controlledGesture)
				settleScroll()
		}

		function onWheel(event: WheelEvent, external = false) {
			if (options.blocked() || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || ignored(event.target, ignoredGestureTargets)) {
				cancel()
				nativeGestureIgnored = true
				return
			}
			const unit = event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? element.clientHeight : 1
			if (reduced.matches) {
				cancel()
				nativeGestureIgnored = true
				// The sibling map has no native scroll ancestor, so forward its delta directly.
				if (external && event.cancelable && event.deltaY) {
					event.preventDefault()
					renderer.write(Math.max(0, Math.min(maxScroll(), renderer.position + event.deltaY * unit)))
					lastScroll = renderer.position
					readReadingNode()
				}
				return
			}
			if (!event.cancelable || !event.deltaY)
				return
			event.preventDefault()
			applyMagneticInput(event.deltaY * unit)
		}

		function onTouchStart(event: TouchEvent) {
			if (reduced.matches || options.blocked() || event.touches.length !== 1 || ignored(event.target, ignoredGestureTargets)) {
				cancel()
				nativeGestureIgnored = true
				return
			}
			if (springRunning || inputFrame)
				cancel()
			const point = event.touches[0]!
			touchPoint = { x: point.clientX, y: point.clientY }
			touchVertical = false
			pointerHeld = true
			nativeGestureIgnored = false
			element.dataset.snapState = 'holding'
		}

		function onTouchMove(event: TouchEvent) {
			if (reduced.matches || options.blocked() || event.touches.length !== 1) {
				cancel()
				return
			}
			if (nativeGestureIgnored || ignored(event.target, ignoredGestureTargets))
				return
			const point = event.touches[0]!
			// A gesture can start before hydration installs touchstart. Adopt its
			// remaining stream; a browser-owned pan cannot be cancelled mid-gesture.
			if (!touchPoint || !event.cancelable) {
				touchPoint = { x: point.clientX, y: point.clientY }
				pointerHeld = true
				element.dataset.snapState = event.cancelable ? 'holding' : 'dragging'
				if (!gestureActive) {
					gestureOrigin = lastScroll
					gestureActive = true
				}
				return
			}
			const delta = touchPoint.y - point.clientY
			const side = touchPoint.x - point.clientX
			touchPoint = { x: point.clientX, y: point.clientY }
			// Once vertical dragging begins, keep its axis despite small sideways jitter.
			if (!touchVertical && Math.abs(side) > Math.abs(delta))
				return
			touchVertical = true
			event.preventDefault()
			applyMagneticInput(delta, true)
		}

		function onTouchEnd() {
			touchPoint = undefined
			touchVertical = false
			pointerHeld = false
			if (gestureActive) {
				queueSettle(70)
			}
			else {
				if (measurementPending)
					measureReadingSteps()
				element.dataset.snapState = 'settled'
			}
		}

		function onPointerDown(event: PointerEvent) {
			if (ignored(event.target, ignoredGestureTargets) || options.blocked())
				return
			if (springRunning || inputFrame)
				cancel()
			nativeGestureIgnored = false
			pointerHeld = true
		}

		function onPointerUp() {
			pointerHeld = false
			if (gestureActive)
				queueSettle(170)
		}

		function onPointerCancel(event: PointerEvent) {
			// Touch ownership may cancel the pointer stream while touch events continue.
			// Only touchend/touchcancel may finish that gesture.
			if (event.pointerType !== 'touch')
				onTouchEnd()
		}

		function onKeyDown(event: KeyboardEvent) {
			const pageKey = event.key === 'ArrowDown' || event.key === 'ArrowUp'
			const control = ignored(event.target, ignoredKeyboardTargets) && !(pageKey && ignored(event.target, '.photo-open'))
			if (event.defaultPrevented || options.blocked() || control || event.ctrlKey || event.metaKey || event.altKey || (pageKey && event.shiftKey))
				return
			if (pageKey) {
				event.preventDefault()
				if (event.repeat)
					return
				const position = springRunning ? springDestination : renderer.position
				const field = currentSnapField()
				const stops = field.stops
				let target = event.key === 'ArrowDown'
					? stops.find(stop => stop > position + 1) ?? maxScroll()
					: stops.findLast(stop => stop < position - 1) ?? 0
				// Longer pages turn a viewport at a time so no paragraph is skipped.
				if (field.free.some(range => position >= range.start - 1 && position <= range.end + 1 && target >= range.start && target <= range.end)) {
					target = event.key === 'ArrowDown'
						? Math.min(target, position + measuredHeight * 0.9)
						: Math.max(target, position - measuredHeight * 0.9)
				}
				springTo(target)
				return
			}
			if (reduced.matches) {
				cancel()
				return
			}
			if (event.key === 'Home' || event.key === 'End') {
				event.preventDefault()
				springTo(event.key === 'Home' ? 0 : maxScroll())
				return
			}
			const deltas: Record<string, number> = {
				'PageDown': element.clientHeight * 0.82,
				'PageUp': -element.clientHeight * 0.82,
				' ': element.clientHeight * 0.82 * (event.shiftKey ? -1 : 1),
			}
			const delta = deltas[event.key]
			if (delta === undefined)
				return
			event.preventDefault()
			applyMagneticInput(delta)
		}

		function measureReadingSteps() {
			if (detached)
				return
			if (pointerHeld || gestureActive || controlledGesture || inputFrame || springRunning) {
				measurementPending = true
				return
			}
			measurementPending = false
			if (element.clientWidth !== measuredWidth || element.clientHeight !== measuredHeight) {
				cancel()
				measuredWidth = element.clientWidth
				measuredHeight = element.clientHeight
			}
			const viewport = `${element.clientHeight}px`
			if (element.style.getPropertyValue('--reading-viewport') !== viewport)
				element.style.setProperty('--reading-viewport', viewport)
			renderer.sync()
			// The native step boxes are unchanged by their children's visual offset.
			const scroll = element.scrollTop
			const top = element.getBoundingClientRect().top
			const ranges = readingSteps().map((step) => {
				const start = scroll + step.getBoundingClientRect().top - top
				const key = step.dataset.node!
				const height = step.clientHeight
				const kind: TravelSnapKind = key.startsWith('photo-') ? 'photo' : key.startsWith('chapter-') ? 'chapter' : 'cover'
				return { key, start, end: start + height, height, kind, layer: step.querySelector<HTMLElement>('.reading-stage') }
			})
			measuredSteps = ranges
			measuredMax = Math.max(0, element.scrollHeight - measuredHeight)
			const footer = element.querySelector<HTMLElement>('.end')
			const footerStart = footer ? scroll + footer.getBoundingClientRect().top - top - renderer.offsetFor(footer) : measuredMax
			renderer.measure([
				...ranges.flatMap(step => step.layer ? [{ element: step.layer, start: step.start, end: step.end }] : []),
				...(footer ? [{ element: footer, start: footerStart, end: footerStart + footer.clientHeight }] : []),
			], measuredHeight)
			measuredField = createSnapField(ranges.map(step => ({ start: step.start, end: step.end - measuredHeight, kind: step.kind })), footerStart, measuredMax, measuredHeight, true)
			readReadingNode()
		}

		const observer = new ResizeObserver(measureReadingSteps)
		observer.observe(element)
		for (const step of readingSteps()) {
			const stage = step.querySelector('.reading-stage')
			if (stage)
				observer.observe(stage)
		}
		element.addEventListener('scroll', onScroll, { passive: true })
		element.addEventListener('scrollend', onScrollEnd)
		element.addEventListener('wheel', onWheel, { passive: false })
		element.addEventListener('touchstart', onTouchStart, { passive: true })
		element.addEventListener('touchmove', onTouchMove, { passive: false })
		element.addEventListener('touchend', onTouchEnd, { passive: true })
		element.addEventListener('touchcancel', onTouchEnd, { passive: true })
		element.addEventListener('pointerdown', onPointerDown, { passive: true })
		win.addEventListener('keydown', onKeyDown)
		win.addEventListener('pointerup', onPointerUp, { passive: true })
		win.addEventListener('pointercancel', onPointerCancel, { passive: true })
		win.addEventListener('resize', measureReadingSteps, { passive: true })
		win.visualViewport?.addEventListener('resize', measureReadingSteps, { passive: true })
		reduced.addEventListener('change', cancel)
		element.dataset.snapState = 'idle'
		measureReadingSteps()
		// Hydration may arrive after the first native pan has already finished.
		// Recover its resting destination even if no further scroll event fires.
		if (!reduced.matches && !options.blocked() && renderer.position > 0) {
			const field = currentSnapField()
			const resting = field.stops.reduce((best, stop) => Math.abs(stop - renderer.position) < Math.abs(best - renderer.position) ? stop : best, field.stops[0]!)
			if (Math.abs(renderer.position - resting) >= 1) {
				gestureOrigin = resting
				gestureActive = true
				queueSettle(170)
			}
		}

		return {
			cancel,
			wheel: (event: WheelEvent) => onWheel(event, true),
			refresh: readReadingNode,
			scrollToNode(key: string, immediate = false) {
				if (detached)
					return
				const step = measuredSteps.find(step => step.key === key)
				if (step)
					springTo(step.start, 0, immediate)
			},
			dispose() {
				detached = true
				cancel()
				observer.disconnect()
				renderer.dispose()
				element.removeEventListener('scroll', onScroll)
				element.removeEventListener('scrollend', onScrollEnd)
				element.removeEventListener('wheel', onWheel)
				element.removeEventListener('touchstart', onTouchStart)
				element.removeEventListener('touchmove', onTouchMove)
				element.removeEventListener('touchend', onTouchEnd)
				element.removeEventListener('touchcancel', onTouchEnd)
				element.removeEventListener('pointerdown', onPointerDown)
				win.removeEventListener('keydown', onKeyDown)
				win.removeEventListener('pointerup', onPointerUp)
				win.removeEventListener('pointercancel', onPointerCancel)
				win.removeEventListener('resize', measureReadingSteps)
				win.visualViewport?.removeEventListener('resize', measureReadingSteps)
				reduced.removeEventListener('change', cancel)
				if (originalViewport)
					element.style.setProperty('--reading-viewport', originalViewport)
				else
					element.style.removeProperty('--reading-viewport')
				if (originalSnapState === undefined)
					delete element.dataset.snapState
				else
					element.dataset.snapState = originalSnapState
				if (originalNode === undefined)
					delete element.dataset.readingNode
				else
					element.dataset.readingNode = originalNode
			},
		}
	}

	const stopBlockedWatch = watch(options.blocked, (blocked) => {
		controller?.cancel()
		if (!blocked)
			controller?.refresh()
	}, { flush: 'sync' })

	onMounted(() => {
		if (disposed)
			return
		stopRootWatch = watch(root, (element) => {
			controller?.dispose()
			controller = element ? attach(element) : undefined
		}, { immediate: true, flush: 'post' })
	})

	onScopeDispose(() => {
		disposed = true
		stopRootWatch?.()
		stopBlockedWatch()
		controller?.dispose()
		controller = undefined
	})

	return {
		wheel: (event: WheelEvent) => controller?.wheel(event),
		scrollToNode: (key: string, immediate = false) => controller?.scrollToNode(key, immediate),
		cancel: () => controller?.cancel(),
	}
}
