import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
// eslint-disable-next-line test/no-import-node-test -- Use the repository's Node test runner.
import test from 'node:test'
import vm from 'node:vm'
import * as scroll from '../utils/travelScroll.ts'
import * as renderer from '../utils/travelScrollRenderer.ts'

function harness(initialWidth = 1000, quantized = false, initialScroll = 0) {
	let screenWidth = initialWidth
	const listenerOptions = new Map<string, { passive?: boolean }>()
	let now = 0
	let sequence = 0
	let dispose = () => {}
	let blocked = false
	let layoutReads = 0
	let scrollWrites = 0
	let scrollPosition = initialScroll
	let resize = () => {}
	let stepSize = 1000
	const frames = new Map<number, (time: number) => void>()
	const timers = new Map<number, () => void>()
	const listeners = new Map<string, (event: any) => void>()
	const windowListeners = new Map<string, (event: any) => void>()
	const mediaListeners = new Map<string, () => void>()
	const media = { matches: false, addEventListener: (key: string, fn: () => void) => mediaListeners.set(key, fn), removeEventListener: (key: string) => mediaListeners.delete(key) }
	class Target {
		selector: string
		constructor(selector = 'button') {
			this.selector = selector
		}

		closest(selector: string) { return selector.split(',').includes(this.selector) ? this : null }
	}
	const win = {
		performance: { now: () => now },
		matchMedia: () => media,
		requestAnimationFrame: (fn: (time: number) => void) => {
			frames.set(++sequence, fn)
			return sequence
		},
		cancelAnimationFrame: (id: number) => frames.delete(id),
		setTimeout: (fn: () => void) => {
			timers.set(++sequence, fn)
			return sequence
		},
		clearTimeout: (id: number) => timers.delete(id),
		addEventListener: (key: string, fn: (event: any) => void) => windowListeners.set(key, fn),
		removeEventListener: (key: string) => windowListeners.delete(key),
	}
	const style = new Map<string, string>()
	const layers = [0, 1, 2].map(() => ({ style: { transform: '' } }))
	const root = {
		get scrollTop() { return scrollPosition },
		set scrollTop(value: number) {
			scrollPosition = quantized ? Math.floor(value) : value
			scrollWrites++
		},
		get clientWidth() { return screenWidth },
		set clientWidth(value: number) { screenWidth = value },
		clientHeight: 1000,
		scrollHeight: 4000,
		dataset: {} as Record<string, string>,
		ownerDocument: { defaultView: win },
		style: { getPropertyValue: (key: string) => style.get(key) ?? '', setProperty: (key: string, value: string) => style.set(key, value), removeProperty: (key: string) => style.delete(key) },
		getBoundingClientRect: () => {
			layoutReads++
			return { top: 0 }
		},
		querySelectorAll: () => [0, 1, 2].map(index => ({
			dataset: { node: `photo-${index}` },
			clientHeight: stepSize,
			getBoundingClientRect: () => {
				layoutReads++
				return { top: index * stepSize - root.scrollTop, bottom: (index + 1) * stepSize - root.scrollTop }
			},
			querySelector: (selector: string) => selector === '.reading-stage' ? layers[index] : null,
		})),
		querySelector: () => null,
		addEventListener: (key: string, fn: (event: any) => void, options?: { passive?: boolean }) => {
			listeners.set(key, fn)
			listenerOptions.set(key, options ?? {})
		},
		removeEventListener: (key: string) => listeners.delete(key),
	}
	const source = stripTypeScriptTypes(readFileSync(new URL('./useTravelSpringScroll.ts', import.meta.url), 'utf8')).replace(/^import .*$/gm, '').replace('export function', 'function')
	const controller = vm.runInNewContext(`${source}\nuseTravelSpringScroll({ value: root }, { blocked, onNodeChange() {} })`, {
		...scroll,
		...renderer,
		root,
		blocked: () => blocked,
		Element: Target,
		ResizeObserver: class {
			constructor(callback: () => void) { resize = callback }
			observe() {}
			disconnect() {}
		},
		onMounted: (fn: () => void) => fn(),
		onScopeDispose: (fn: () => void) => { dispose = fn },
		watch: (source: unknown, fn: (value: unknown) => void, options?: { immediate?: boolean }) => {
			if (options?.immediate)
				fn((source as { value: unknown }).value)
			return () => {}
		},
	}) as { cancel: () => void, wheel: (event: unknown) => void }
	function frame(ms = 16) {
		now += ms
		const pending = [...frames.values()]
		frames.clear()
		pending.forEach(fn => fn(now))
	}
	function wheel(deltaY: number, external = false, extra: Record<string, unknown> = {}) {
		let prevented = false
		const event = {
			target: new Target(external ? 'map' : 'button'),
			deltaY,
			deltaX: 0,
			deltaMode: 0,
			cancelable: true,
			preventDefault: () => { prevented = true },
			...extra,
		}
		if (external)
			controller.wheel(event)
		else
			listeners.get('wheel')!(event)
		return prevented
	}
	return {
		root,
		listenerOptions,
		layers,
		layoutReads: () => layoutReads,
		scrollWrites: () => scrollWrites,
		resize: () => resize(),
		setStepSize: (size: number) => { stepSize = size },
		frame,
		wheel,
		frames,
		listeners,
		windowListeners,
		timers,
		flushTimers: () => {
			const pending = [...timers.values()]
			timers.clear()
			pending.forEach(fn => fn())
		},
		media,
		controller,
		target: (selector: string) => new Target(selector),
		setBlocked: (value: boolean) => { blocked = value },
		dispose: () => dispose(),
	}
}

test('wheel input accumulates without jumping and cancels on takeover', () => {
	const h = harness()
	assert.equal(h.wheel(200), true)
	assert.equal(h.root.scrollTop, 0)
	h.frame()
	const first = h.root.scrollTop
	assert.ok(first > 0 && first < scroll.magneticScrollPosition(200, scroll.createSnapField([{ start: 0, end: 0, kind: 'photo' }], 3000, 3000, 1000)))
	h.wheel(100)
	assert.equal(h.root.scrollTop, first)
	h.frame()
	assert.ok(h.root.scrollTop > first)
	h.listeners.get('pointerdown')!({ target: null })
	const stopped = h.root.scrollTop
	h.frame()
	assert.equal(h.root.scrollTop, stopped)
	assert.equal(h.frames.size, 0)
	h.dispose()
})
test('reduced motion uses native wheel input and disposal removes pending animation', () => {
	const h = harness()
	h.media.matches = true
	assert.equal(h.wheel(200), false)
	assert.equal(h.frames.size, 0)
	h.media.matches = false
	h.wheel(200)
	assert.equal(h.frames.size, 1)
	h.dispose()
	assert.equal(h.frames.size, 0)
	assert.equal(h.listeners.size, 0)
})

test('map-area wheel shares the reading gesture and smoothing with content wheel', () => {
	const h = harness()
	assert.equal(typeof h.controller.wheel, 'function')
	assert.equal(h.wheel(200, true), true)
	assert.equal(h.root.scrollTop, 0)
	h.frame()
	const first = h.root.scrollTop
	assert.ok(first > 0 && first < 200)
	h.wheel(100)
	assert.equal(h.root.scrollTop, first)
	h.frame()
	assert.ok(h.root.scrollTop > first)
	h.dispose()
})
test('map-area wheel preserves exploration, dialogs, pinch and horizontal gestures', () => {
	const h = harness()
	h.setBlocked(true)
	assert.equal(h.wheel(200, true), false)
	h.setBlocked(false)
	assert.equal(h.wheel(200, true, { ctrlKey: true }), false)
	assert.equal(h.wheel(200, true, { deltaX: 300 }), false)
	assert.equal(h.wheel(200, true, { target: h.target('.map-detail-map') }), false)
	assert.equal(h.frames.size, 0)
	assert.equal(h.root.scrollTop, 0)
	h.dispose()
})
test('reduced motion forwards map-area wheel directly while content keeps native scrolling', () => {
	const h = harness()
	h.media.matches = true
	assert.equal(h.wheel(200), false)
	assert.equal(h.root.scrollTop, 0)
	assert.equal(h.wheel(200, true), true)
	assert.equal(h.root.scrollTop, 200)
	assert.equal(h.frames.size, 0)
	h.dispose()
	assert.equal(h.wheel(200, true), false)
	assert.equal(h.root.scrollTop, 200)
})

function touch(h: ReturnType<typeof harness>, type: string, y: number, cancelable = true, x = 100) {
	let prevented = false
	h.listeners.get(type)!({
		target: h.target('button'),
		touches: type === 'touchend' ? [] : [{ clientX: x, clientY: y }],
		cancelable,
		preventDefault: () => { prevented = true },
	})
	return prevented
}

test('touch pointer cancellation keeps vertical input until the actual touch ends', () => {
	const h = harness()
	h.root.clientWidth = 375
	touch(h, 'touchstart', 600)
	h.windowListeners.get('pointercancel')!({ pointerType: 'touch' })
	assert.equal(touch(h, 'touchmove', 570), true)
	h.frame()
	assert.ok(h.root.scrollTop > 0 && h.root.scrollTop < 30)
	touch(h, 'touchend', 570)
	h.flushTimers()
	assert.equal(h.root.dataset.snapState, 'spring')
	for (let i = 0; i < 110; i++) h.frame()
	assert.equal(h.root.scrollTop, 0)
	assert.equal(h.root.dataset.snapState, 'settled')
	h.dispose()
})

test('a deliberate touch swipe springs to the next photo after release', () => {
	const h = harness()
	h.root.clientWidth = 375
	touch(h, 'touchstart', 600)
	assert.equal(touch(h, 'touchmove', 220), true)
	h.frame()
	touch(h, 'touchend', 220)
	h.flushTimers()
	for (let i = 0; i < 110; i++) h.frame()
	assert.equal(h.root.scrollTop, 1000)
	assert.equal(h.root.dataset.snapState, 'settled')
	h.dispose()
})

test('reduced motion leaves touch scrolling to the browser', () => {
	const h = harness()
	h.media.matches = true
	touch(h, 'touchstart', 600)
	assert.equal(touch(h, 'touchmove', 220), false)
	assert.equal(h.root.scrollTop, 0)
	assert.equal(h.frames.size, 0)
	h.dispose()
})

test('desktop wheel release between pages completes the spring to a stable photo', () => {
	const h = harness()
	h.wheel(600)
	for (let i = 0; i < 60; i++) h.frame()
	h.flushTimers()
	for (let i = 0; i < 110; i++) h.frame()
	assert.equal(h.root.scrollTop, 1000)
	assert.equal(h.root.dataset.snapState, 'settled')
	h.dispose()
})

test('short desktop gestures start fresh at each settled stop with no carried input', () => {
	const h = harness()
	function settle(delta: number) {
		h.wheel(delta)
		for (let i = 0; i < 60; i++) h.frame()
		h.flushTimers()
		for (let i = 0; i < 110; i++) h.frame()
		assert.equal(h.root.dataset.snapState, 'settled')
	}
	settle(120)
	assert.equal(h.root.scrollTop, 1000)
	settle(40)
	assert.equal(h.root.scrollTop, 1000)
	settle(120)
	assert.equal(h.root.scrollTop, 2000)
	settle(-120)
	assert.equal(h.root.scrollTop, 1000)
	h.dispose()
})

test('scroll frames use cached geometry and resize refreshes it', () => {
	const h = harness()
	const measured = h.layoutReads()
	h.wheel(80)
	for (let i = 0; i < 60; i++) h.frame()
	h.flushTimers()
	for (let i = 0; i < 110; i++) h.frame()
	assert.equal(h.layoutReads(), measured)
	h.root.clientHeight = 800
	h.resize()
	assert.ok(h.layoutReads() > measured)
	const resized = h.layoutReads()
	h.wheel(60)
	for (let i = 0; i < 60; i++) h.frame()
	assert.equal(h.layoutReads(), resized)
	h.dispose()
})
test('mobile touch moves coalesce and quickly converge without an abrupt target jump', () => {
	const h = harness()
	h.root.clientWidth = 375
	h.resize()
	const writes = h.scrollWrites()
	touch(h, 'touchstart', 600)
	touch(h, 'touchmove', 580)
	touch(h, 'touchmove', 560)
	touch(h, 'touchmove', 540)
	assert.equal(h.scrollWrites(), writes)
	h.frame()
	assert.equal(h.scrollWrites(), writes + 1)
	assert.ok(h.root.scrollTop > 40 && h.root.scrollTop < 60)
	for (let i = 0; i < 5; i++) h.frame()
	assert.equal(h.root.scrollTop, 60)
	touch(h, 'touchend', 540)
	h.flushTimers()
	for (let i = 0; i < 110; i++) h.frame()
	assert.equal(h.root.scrollTop, 1000)
	h.dispose()
})
test('a short mobile swipe reaches a neighbor and the next small swipe has no debt', () => {
	const h = harness()
	h.root.clientWidth = 375
	h.resize()
	function swipe(distance: number) {
		touch(h, 'touchstart', 600)
		touch(h, 'touchmove', 600 - distance)
		h.frame()
		touch(h, 'touchend', 600 - distance)
		h.flushTimers()
		for (let i = 0; i < 110; i++) h.frame()
		assert.equal(h.root.dataset.snapState, 'settled')
	}
	swipe(80)
	assert.equal(h.root.scrollTop, 1000)
	swipe(25)
	assert.equal(h.root.scrollTop, 1000)
	swipe(-80)
	assert.equal(h.root.scrollTop, 0)
	h.dispose()
})

test('mobile viewport changes preserve touch input and settle to the resized neighbor', () => {
	const h = harness()
	h.root.clientWidth = 375
	h.resize()
	touch(h, 'touchstart', 600)
	touch(h, 'touchmove', 580)
	h.frame()
	h.root.clientHeight = 980
	h.setStepSize(980)
	h.resize()
	assert.equal(touch(h, 'touchmove', 500), true)
	h.frame()
	touch(h, 'touchend', 500)
	h.flushTimers()
	for (let i = 0; i < 110; i++) h.frame()
	assert.equal(h.root.scrollTop, 980)
	assert.equal(h.root.dataset.snapState, 'settled')
	h.dispose()
})
test('layout notifications during touch defer measurement until release', () => {
	const h = harness()
	h.root.clientWidth = 375
	h.resize()
	const measured = h.layoutReads()
	touch(h, 'touchstart', 600)
	touch(h, 'touchmove', 575)
	h.frame()
	for (let i = 0; i < 10; i++) h.resize()
	assert.equal(h.layoutReads(), measured)
	touch(h, 'touchmove', 520)
	h.frame()
	touch(h, 'touchend', 520)
	h.flushTimers()
	for (let i = 0; i < 110; i++) h.frame()
	assert.equal(h.root.scrollTop, 1000)
	assert.ok(h.layoutReads() > measured)
	h.dispose()
})
test('viewport changes during spring preserve the selected destination', () => {
	const h = harness()
	h.wheel(80)
	for (let i = 0; i < 60; i++) h.frame()
	h.flushTimers()
	h.frame()
	h.root.clientHeight = 960
	h.setStepSize(960)
	h.resize()
	for (let i = 0; i < 110; i++) h.frame()
	assert.equal(h.root.scrollTop, 960)
	assert.equal(h.root.dataset.snapState, 'settled')
	h.dispose()
})

test('vertical touch movement keeps every delta when the finger wobbles sideways', () => {
	const h = harness(375)
	touch(h, 'touchstart', 600)
	touch(h, 'touchmove', 540)
	h.frame()
	for (let i = 1; i <= 10; i++) {
		assert.equal(touch(h, 'touchmove', 540 - i * 2, true, i % 2 ? 108 : 100), true)
		h.frame()
	}
	for (let i = 0; i < 8; i++) h.frame()
	const field = scroll.createSnapField([0, 1000, 2000].map(start => ({ start, end: start, kind: 'photo' })), 3000, 3000, 1000, true)
	assert.equal(h.root.scrollTop, scroll.magneticScrollPosition(80, field, 0))
	h.dispose()
})

test('a horizontal touch remains unhandled until vertical dragging starts', () => {
	const h = harness(375)
	touch(h, 'touchstart', 600)
	assert.equal(touch(h, 'touchmove', 598, true, 130), false)
	assert.equal(h.frames.size, 0)
	assert.equal(touch(h, 'touchmove', 560, true, 130), true)
	h.frame()
	assert.ok(h.root.scrollTop > 0)
	h.dispose()
})

test('30Hz touch samples produce continuous position updates on 60Hz animation frames', () => {
	const h = harness(375)
	touch(h, 'touchstart', 600)
	let changes = 0
	let previous = h.root.scrollTop
	for (let sample = 1; sample <= 20; sample++) {
		touch(h, 'touchmove', 600 - sample * 8)
		for (let i = 0; i < 2; i++) {
			h.frame(1000 / 60)
			if (Math.abs(h.root.scrollTop - previous) > 0.1)
				changes++
			previous = h.root.scrollTop
		}
	}
	assert.ok(changes >= 38, `only ${changes} of 40 frames moved`)
	touch(h, 'touchend', 440)
	h.flushTimers()
	for (let i = 0; i < 110; i++) h.frame()
	assert.equal(h.root.scrollTop, 1000)
	assert.equal(h.root.dataset.snapState, 'settled')
	h.dispose()
})

test('input interpolation converges when the browser quantizes scrollTop reads', () => {
	const h = harness(375, true)
	touch(h, 'touchstart', 600)
	touch(h, 'touchmove', 520)
	for (let i = 0; i < 120; i++) h.frame()
	const field = scroll.createSnapField([0, 1000, 2000].map(start => ({ start, end: start, kind: 'photo' })), 3000, 3000, 1000, true)
	const expected = Math.floor(scroll.magneticScrollPosition(80, field, 0))
	assert.equal(h.root.scrollTop, expected)
	assert.equal(h.frames.size, 0)
	h.dispose()
})

test('integer browser offsets retain asymmetric departure from fractional resting stops', () => {
	const h = harness(375, true)
	h.setStepSize(1000.75)
	h.resize()
	touch(h, 'touchstart', 600)
	touch(h, 'touchmove', 520)
	h.frame()
	touch(h, 'touchend', 520)
	h.flushTimers()
	for (let i = 0; i < 110; i++) h.frame()
	assert.equal(h.root.scrollTop, 1000)
	h.resize()
	assert.equal(renderer.readTravelScrollVisualPosition(h.root as unknown as HTMLElement), 1000.75)
	touch(h, 'touchstart', 600)
	touch(h, 'touchmove', 520)
	for (let i = 0; i < 12; i++) h.frame()
	const field = scroll.createSnapField([0, 1000.75, 2001.5].map(start => ({ start, end: start + 0.75, kind: 'photo' })), 3000, 3000, 1000, true)
	const expected = Math.floor(scroll.magneticScrollPosition(1080.75, field, 1000.75))
	assert.equal(h.root.scrollTop, expected)
	h.dispose()
})

test('fractional touch input in a long description stops its frame loop after release on WebKit offsets', () => {
	const h = harness(375, true)
	h.setStepSize(1400)
	h.resize()
	touch(h, 'touchstart', 600)
	touch(h, 'touchmove', 519.6)
	h.frame()
	touch(h, 'touchend', 519.6)
	h.flushTimers()
	for (let i = 0; i < 60; i++) h.frame()
	assert.equal(h.root.dataset.snapState, 'free')
	assert.equal(h.root.scrollTop, 80)
	assert.equal(h.frames.size, 0)
	h.dispose()
})

test('a swipe started before hydration is adopted and springs after its native touch stream ends', () => {
	const h = harness(375)
	try {
		// The browser owns this gesture: touchstart happened before listeners existed.
		h.root.scrollTop = 80
		h.listeners.get('scroll')!({})
		assert.equal(touch(h, 'touchmove', 520, false), false)
		assert.equal(h.root.dataset.snapState, 'dragging', 'map work remains paused during the adopted pan')
		h.root.clientHeight = 980
		h.setStepSize(980)
		h.resize()
		h.flushTimers()
		assert.equal(h.frames.size, 0, 'never fight a finger still held by native scrolling')
		touch(h, 'touchend', 520, false)
		h.flushTimers()
		for (let i = 0; i < 110; i++) h.frame()
		assert.equal(h.root.scrollTop, 980)
		assert.equal(h.root.dataset.snapState, 'settled')
	}
	finally { h.dispose() }
})

test('a pre-hydration swipe that already ended is settled without requiring another scroll event', () => {
	const h = harness(375, false, 80)
	try {
		h.flushTimers()
		for (let i = 0; i < 110; i++) h.frame()
		assert.equal(h.root.scrollTop, 1000)
		assert.equal(h.root.dataset.snapState, 'settled')
	}
	finally { h.dispose() }
})

test('a cancelable ongoing touch without a captured start regains spring ownership', () => {
	const h = harness(375)
	try {
		touch(h, 'touchmove', 600)
		assert.equal(touch(h, 'touchmove', 520), true)
		h.frame()
		touch(h, 'touchend', 520)
		h.flushTimers()
		for (let i = 0; i < 110; i++) h.frame()
		assert.equal(h.root.scrollTop, 1000)
		assert.equal(h.root.dataset.snapState, 'settled')
	}
	finally { h.dispose() }
})

test('slow low-frequency mobile touch preserves visible motion between integer browser offsets', () => {
	const h = harness(375, true)
	let nativeChanges = 0
	let visibleChanges = 0
	let previous = 0
	let previousVisible = 0
	let nextSample = 0
	let sample = 0
	const measured = h.layoutReads()
	try {
		touch(h, 'touchstart', 600)
		for (let frame = 0; frame < 112; frame++) {
			if (frame * 1000 / 56 >= nextSample) {
				sample++
				touch(h, 'touchmove', 600 - sample * 0.9)
				nextSample += 1000 / 24
			}
			h.frame(1000 / 56)
			if (h.root.scrollTop !== previous)
				nativeChanges++
			previous = h.root.scrollTop
			const visible = renderer.readTravelScrollVisualPosition(h.root as unknown as HTMLElement)
			if (Math.abs(visible - previousVisible) > 0.01)
				visibleChanges++
			previousVisible = visible
			assert.ok(h.layers.filter(layer => layer.style.transform).length <= 2)
		}
		assert.equal(h.layoutReads(), measured)
		assert.ok(nativeChanges < 80)
		assert.ok(visibleChanges >= 96, `only ${visibleChanges} of112 frames moved visibly; native changes:${nativeChanges}`)
		touch(h, 'touchend', 600 - sample * 0.9)
		h.flushTimers()
		for (let i = 0; i < 110; i++) h.frame()
		assert.equal(h.root.dataset.snapState, 'settled')
		assert.equal(h.root.scrollTop, 0)
	}
	finally { h.dispose() }
})
