import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
// eslint-disable-next-line test/no-import-node-test -- Use the project's built-in Node test runner.
import test from 'node:test'
import { runInNewContext } from 'node:vm'

for (const skipped of [false, true]) {
	test(`locale cleanup prevents native entrance replay (${skipped ? 'skipped' : 'finished'} snapshot)`, async () => {
		let finish!: () => void
		let reject!: (reason: Error) => void
		const finished = new Promise<void>((resolve, fail) => {
			finish = resolve
			reject = fail
		})
		const oldWidget = { dataset: {} as Record<string, string> }
		const newWidget = { dataset: {} as Record<string, string> }
		let elements = [oldWidget]
		let enteredAtCleanup: boolean[] = []
		const classes = new Set<string>()
		const code = stripTypeScriptTypes(readFileSync(new URL('./localeMotion.ts', import.meta.url), 'utf8')
			.replace(/^import .*\n/gm, '')
			.replace('export async function', 'async function'))
		const context = {
			blogConfig: { locales: [{ code: 'zh' }, { code: 'en' }] },
			matchMedia: () => ({ matches: false }),
			CSS: { supports: () => true },
			document: {
				documentElement: { classList: {
					add: (name: string) => classes.add(name),
					remove: (name: string) => {
						enteredAtCleanup = elements.map(el => el.dataset.nativeEntered === '')
						classes.delete(name)
					},
				} },
				querySelectorAll: (selector: string) => selector === '[data-transition-enter]' ? elements : [],
				startViewTransition: (update: () => Promise<void>) => ({
					ready: Promise.resolve(),
					finished,
					updateCallbackDone: update(),
					skipTransition: () => {},
				}),
			},
		}
		const run = runInNewContext(`${code}\nrunLocaleMotion`, context) as (update: () => Promise<void>) => Promise<void>
		await run(async () => {
			elements = [oldWidget, newWidget]
		})
		assert.equal(classes.has('locale-motion'), true)
		if (skipped)
			reject(new Error('Browser skipped transition'))
		else
			finish()
		await new Promise(resolve => setImmediate(resolve))
		assert.equal(classes.has('locale-motion'), false)
		assert.deepEqual(enteredAtCleanup, [true, true], 'reused and newly rendered widgets must not restart entrance when suppression is removed')
	})
}

interface MotionElement {
	id: string
	top: number
	left: number
	height: number
	width: number
	textContent: string
	visibility: string
	animate: (frames: unknown[], options: { duration: number }) => { finished: Promise<void>, cancel: () => void }
	style: { cssText: string, setProperty: (name: string, value: string) => void }
	properties: Map<string, string>
	getBoundingClientRect: () => { top: number, bottom: number, left: number, right: number, width: number, height: number }
	closest: (selector: string) => boolean
	matches: (selector: string) => boolean
}

function motionHarness() {
	const events: string[] = []
	const elements: MotionElement[] = []
	const media: MotionElement[] = []
	const transitions: { finish: () => void, skipped: boolean }[] = []
	const scrolls: number[] = []
	const animations: { frames: unknown[], options: { duration: number } }[] = []
	let phase = 'old'
	const classes = new Set<string>()
	function element(id: string, top: number, options: Partial<Pick<MotionElement, 'height' | 'width' | 'left' | 'visibility'>> = {}) {
		const properties = new Map<string, string>()
		const el: MotionElement = {
			id,
			top,
			left: 0,
			height: 40,
			width: 600,
			visibility: 'visible',
			...options,
			textContent: id,
			properties,
			animate: (frames, options) => {
				events.push(`${phase}:write:${id}`)
				animations.push({ frames, options })
				return { finished: Promise.resolve(), cancel: () => {} }
			},
			style: {
				get cssText() { return '' },
				set cssText(_value: string) { properties.clear() },
				setProperty(name, value) {
					events.push(`${phase}:write:${id}`)
					properties.set(name, value)
				},
			},
			getBoundingClientRect: () => {
				events.push(`${phase}:read:${id}`)
				return { top: el.top, bottom: el.top + el.height, left: el.left, right: el.left + el.width, height: el.height, width: el.width }
			},
			closest: selector => selector === '#main-content',
			matches: () => false,
		}
		elements.push(el)
		return el
	}
	const context = {
		blogConfig: { locales: [{ code: 'zh' }, { code: 'en' }] },
		matchMedia: () => ({ matches: false }),
		CSS: { supports: () => true },
		getComputedStyle: (el: MotionElement) => {
			events.push(`${phase}:read:${el.id}`)
			return { visibility: el.visibility }
		},
		window: {
			innerHeight: 800,
			innerWidth: 1200,
			scrollBy: ({ top }: { top: number }) => {
				scrolls.push(top)
				for (const el of elements)
					el.top -= top
			},
		},
		document: {
			documentElement: { classList: {
				add: (name: string) => classes.add(name),
				remove: (name: string) => classes.delete(name),
			} },
			querySelectorAll: (selector: string) => {
				if (selector === '#main-content > .article > *' || selector.includes('#main-content > .article > :not(pre)'))
					return elements
				if (selector.includes('#main-content > .article img'))
					return media
				return []
			},
			startViewTransition: (update: () => Promise<void>) => {
				let finish!: () => void
				const finished = new Promise<void>((resolve) => {
					finish = resolve
				})
				const state = { finish, skipped: false }
				transitions.push(state)
				return {
					ready: Promise.resolve(),
					finished,
					updateCallbackDone: update(),
					skipTransition: () => { state.skipped = true },
				}
			},
		},
	}
	const code = stripTypeScriptTypes(readFileSync(new URL('./localeMotion.ts', import.meta.url), 'utf8')
		.replace(/^import .*\n/gm, '')
		.replace('export async function', 'async function'))
	const run = runInNewContext(`${code}\nrunLocaleMotion`, context) as (update: () => Promise<void>) => Promise<void>
	return {
		element,
		elements,
		media,
		events,
		animations,
		context,
		run,
		transitions,
		scrolls,
		classes,
		setPhase: (value: string) => { phase = value },
	}
}

test('locale snapshots stay inside the viewport on a long article', async () => {
	const harness = motionHarness()
	const visible = harness.element('visible', 120)
	const above = harness.element('above', -100)
	const below = harness.element('below', 800)
	const beside = harness.element('beside', 120, { left: 1200 })
	const hidden = harness.element('hidden', 120, { visibility: 'hidden' })
	for (let index = 0; index < 200; index++)
		harness.element(`paragraph-${index}`, 900 + index * 100)
	await harness.run(async () => {})
	assert.ok(visible.properties.has('view-transition-name'))
	for (const el of [above, below, beside, hidden])
		assert.equal(el.properties.has('view-transition-name'), false, `${el.id} must not get a snapshot`)
	assert.equal(harness.elements.filter(el => el.properties.has('view-transition-name')).length, 1)
})

test('locale snapshot reads finish before snapshot style writes in each phase', async () => {
	const harness = motionHarness()
	harness.element('first', 120)
	harness.element('second', 200)
	await harness.run(async () => {
		harness.setPhase('new')
	})
	for (const phase of ['old', 'new']) {
		const events = harness.events.filter(event => event.startsWith(`${phase}:`))
		const firstWrite = events.findIndex(event => event.includes(':write:'))
		assert.ok(firstWrite > 0)
		assert.equal(events.slice(firstWrite).some(event => event.includes(':read:')), false, `${phase} snapshots must batch geometry/style reads`)
	}
})

test('translation reflow restores the paragraph anchor before selecting new visible snapshots', async () => {
	const harness = motionHarness()
	const anchor = harness.element('anchor', -20, { height: 200 })
	const next = harness.element('next', 220)
	const offscreen = harness.element('offscreen', 900)
	await harness.run(async () => {
		for (const el of harness.elements)
			el.top += 1000
		anchor.textContent = 'translated anchor'
		next.textContent = 'translated next'
	})
	assert.deepEqual(harness.scrolls, [1000])
	assert.equal(anchor.top, -20)
	assert.ok(anchor.properties.has('view-transition-name'))
	assert.ok(next.properties.has('view-transition-name'))
	assert.equal(offscreen.properties.has('view-transition-name'), false)
})

test('unchanged text and visible media keep stable snapshot classes', async () => {
	const harness = motionHarness()
	const unchanged = harness.element('unchanged', 120)
	const changed = harness.element('changed', 200)
	const image = harness.element('image', 280)
	harness.elements.pop()
	harness.media.push(image)
	await harness.run(async () => {
		changed.textContent = 'translated'
	})
	assert.match(unchanged.properties.get('view-transition-class')!, /locale-stable/)
	assert.match(changed.properties.get('view-transition-class')!, /locale-body/)
	assert.match(image.properties.get('view-transition-class')!, /locale-stable/)
})

test('rapid locale changes retain the latest snapshot styles after the old update resolves', async () => {
	const harness = motionHarness()
	const paragraph = harness.element('paragraph', 120)
	let finishOldUpdate!: () => void
	const oldUpdate = new Promise<void>((resolve) => {
		finishOldUpdate = resolve
	})
	const first = harness.run(() => oldUpdate)
	await harness.run(async () => {
		paragraph.textContent = 'latest language'
	})
	assert.equal(harness.transitions[0]!.skipped, true)
	finishOldUpdate()
	await first
	assert.ok(paragraph.properties.has('view-transition-name'))
	assert.equal(harness.classes.has('locale-motion'), true)
	harness.transitions[0]!.finish()
	await new Promise(resolve => setImmediate(resolve))
	assert.ok(paragraph.properties.has('view-transition-name'))
	harness.transitions[1]!.finish()
	await new Promise(resolve => setImmediate(resolve))
	assert.equal(paragraph.properties.size, 0)
	assert.equal(harness.classes.has('locale-motion'), false)
})

test('fallback batches visible text reads before starting short opacity fades', async () => {
	const harness = motionHarness()
	harness.context.CSS.supports = () => false
	harness.element('first', 120)
	harness.element('second', 200)
	harness.element('offscreen', 900)
	await harness.run(async () => {})
	assert.equal(harness.animations.length, 2)
	const firstWrite = harness.events.findIndex(event => event.includes(':write:'))
	assert.equal(harness.events.slice(firstWrite).some(event => event.includes(':read:')), false)
	for (const { frames, options } of harness.animations) {
		assert.equal(JSON.stringify(frames), JSON.stringify([{ opacity: 0 }, { opacity: 1 }]))
		assert.ok(options.duration <= 160)
	}
})

test('a superseded fallback update cannot start a late animation', async () => {
	const harness = motionHarness()
	harness.context.CSS.supports = () => false
	harness.element('paragraph', 120)
	let finishOldUpdate!: () => void
	const oldUpdate = new Promise<void>((resolve) => {
		finishOldUpdate = resolve
	})
	const first = harness.run(() => oldUpdate)
	await harness.run(async () => {})
	assert.equal(harness.animations.length, 1)
	finishOldUpdate()
	await first
	assert.equal(harness.animations.length, 1)
})

test('reduced motion updates the locale without measuring or animating content', async () => {
	const harness = motionHarness()
	harness.context.matchMedia = () => ({ matches: true })
	const paragraph = harness.element('paragraph', 120)
	await harness.run(async () => {
		paragraph.textContent = 'translated'
	})
	assert.equal(paragraph.textContent, 'translated')
	assert.equal(harness.events.length, 0)
	assert.equal(harness.transitions.length, 0)
	assert.equal(harness.animations.length, 0)
})
