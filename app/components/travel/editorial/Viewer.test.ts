import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
// eslint-disable-next-line test/no-import-node-test -- Use the repository's Node test runner.
import test from 'node:test'
import vm from 'node:vm'
import * as geometry from './viewer-geometry.ts'

function harness(reducedMotion = 'no-preference') {
	const props = { photo: { src: 'first.jpg', index: 0, video: false }, index: 0, closing: false }
	const events: string[] = []
	const templateRefs = new Map<string, { value: unknown }>()
	let dispose = () => {}
	const script = readFileSync(new URL('./Viewer.vue', import.meta.url), 'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)![1]!
	const source = stripTypeScriptTypes(script).replace(/^import .*$/gm, '')
	const runtime = vm.runInNewContext(`${source}\n;({ originalLoaded, loaded, originalRequested, originalReady, naturalSize, blankClick: typeof blankClick === 'function' ? blankClick : undefined, entering, enter, leave, notesReady: typeof notesReady === 'undefined' ? undefined : notesReady })`, {
		...geometry,
		defineProps: () => props,
		withDefaults: (value: unknown) => value,
		defineEmits: () => (event: string) => { events.push(event) },
		defineExpose() {},
		useI18n: () => ({ t: () => '' }),
		usePreferredReducedMotion: () => ({ value: reducedMotion }),
		useMediaQuery: () => ({ value: false }),
		ref: (value: unknown) => ({ value }),
		computed: (get: () => unknown) => ({ get value() { return get() } }),
		useTemplateRef: (name: string) => {
			const value = { value: null }
			templateRefs.set(name, value)
			return value
		},
		nextTick: async () => {},
		getComputedStyle: () => ({ transform: 'none', getPropertyValue: (key: string) => key === '--photo-morph-duration' ? '280ms' : 'cubic-bezier(.22,1,.36,1)' }),
		watch() {},
		onMounted() {},
		onScopeDispose: (fn: () => void) => { dispose = fn },
		getImgMeta: () => null,
	}) as { enter: (origin?: geometry.ViewerRect, notes?: Record<string, geometry.ViewerRect>) => Promise<void>, leave: (target?: geometry.ViewerRect, notes?: Record<string, geometry.ViewerRect>) => Promise<void>, notesReady: { value: boolean }, blankClick: (event: { target: unknown, defaultPrevented?: boolean }) => void, entering: { value: boolean }, originalLoaded: (event: { target: unknown }) => void, loaded: (event: { target: unknown }) => void, originalRequested: { value: boolean }, originalReady: { value: boolean }, naturalSize: { value: { width: number, height: number } | null } }
	function image(index: number, src: string) {
		return { isConnected: true, dataset: { photoIndex: String(index) }, getAttribute: () => src, naturalWidth: 1600, naturalHeight: 1200 }
	}
	return { props, runtime, templateRefs, image, events, dispose: () => dispose() }
}

test('only the current requested original may become ready', () => {
	const h = harness()
	const first = h.image(0, 'first.jpg')
	h.templateRefs.get('originalImage')!.value = first
	h.runtime.originalRequested.value = true
	h.runtime.originalLoaded({ target: first })
	assert.equal(h.runtime.originalReady.value, true)
	h.props.index = 1
	h.props.photo = { src: 'second.jpg', index: 1, video: false }
	h.runtime.originalReady.value = false
	const second = h.image(1, 'second.jpg')
	h.templateRefs.get('originalImage')!.value = second
	h.runtime.originalLoaded({ target: first })
	assert.equal(h.runtime.originalReady.value, false)
	h.runtime.originalLoaded({ target: second })
	assert.equal(h.runtime.originalReady.value, true)
})
test('detached and disposed originals cannot publish a load result', () => {
	const h = harness()
	const image = h.image(0, 'first.jpg')
	h.templateRefs.get('originalImage')!.value = image
	h.runtime.originalRequested.value = true
	image.isConnected = false
	h.runtime.originalLoaded({ target: image })
	assert.equal(h.runtime.originalReady.value, false)
	image.isConnected = true
	h.dispose()
	h.runtime.originalLoaded({ target: image })
	assert.equal(h.runtime.originalReady.value, false)
})
test('an old preview never replaces the new photograph dimensions', () => {
	const h = harness()
	const previous = h.image(0, 'first.jpg')
	h.props.index = 1
	h.props.photo = { src: 'second.jpg', index: 1, video: false }
	const current = h.image(1, 'second.jpg')
	h.templateRefs.get('previewImage')!.value = current
	h.runtime.loaded({ target: previous })
	assert.equal(Boolean(h.runtime.naturalSize.value), false)
	h.runtime.loaded({ target: current })
	assert.equal(h.runtime.naturalSize.value?.width, 1600)
})

const clickTarget = (...classes: string[]) => ({ closest: (selector: string) => selector.split(',').some(part => classes.includes(part.trim())) })

test('clicking viewer background gaps returns to reading', () => {
	const h = harness()
	assert.equal(typeof h.runtime.blankClick, 'function')
	for (const blank of ['.lightbox', '.lightbox-content', '.lightbox-header'])
		h.runtime.blankClick({ target: clickTarget(blank) })
	assert.deepEqual(h.events, ['close', 'close', 'close'])
})
test('viewer content and stage gestures retain their own interactions', () => {
	const h = harness()
	for (const content of ['.lightbox-photo', '.lightbox-info', 'button', 'a', '.viewer-count', '.lightbox-stage'])
		h.runtime.blankClick({ target: clickTarget(content) })
	assert.deepEqual(h.events, [])
	h.props.photo.video = true
	h.runtime.blankClick({ target: clickTarget('.lightbox-stage') })
	assert.deepEqual(h.events, ['close'])
})
test('viewer background clicks are ignored during morphing or prevented input', () => {
	const h = harness()
	const event = { target: clickTarget('.lightbox-content') }
	h.runtime.entering.value = true
	h.runtime.blankClick(event)
	h.runtime.entering.value = false
	h.props.closing = true
	h.runtime.blankClick(event)
	h.props.closing = false
	h.runtime.blankClick({ ...event, defaultPrevented: true })
	assert.deepEqual(h.events, [])
})

function animatedViewer(reduced = 'no-preference') {
	const h = harness(reduced)
	const motions: { name: string, frames: Keyframe[], cancelled: boolean, finish: () => void }[] = []
	for (const [name, left, top] of [['photograph', 100, 100], ['captionTitle', 900, 200], ['captionPlace', 900, 260], ['captionDescription', 900, 320]] as const) {
		const element = {
			getBoundingClientRect: () => ({ left, top, width: 200, height: 100 }),
			animate(frames: Keyframe[]) {
				let finish = () => {}
				const finished = new Promise<void>((resolve) => {
					finish = resolve
				})
				const motion = { name, frames, cancelled: false, finish }
				motions.push(motion)
				return { finished, cancel() {
					motion.cancelled = true
					finish()
				} }
			},
		}
		const slot = h.templateRefs.get(name) ?? { value: null as unknown }
		slot.value = element
		h.templateRefs.set(name, slot)
	}
	h.templateRefs.get('stage')!.value = { clientWidth: 1200, clientHeight: 800, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 800 }) }
	const notes = { title: { left: 100, top: 600, width: 300, height: 30 }, place: { left: 100, top: 730, width: 250, height: 20 }, description: { left: 100, top: 650, width: 300, height: 60 } }
	return { ...h, motions, notes }
}

test('opening moves title, coordinates and description with the photograph and waits for every motion', async () => {
	const h = animatedViewer()
	let completed = false
	const pending = h.runtime.enter({ left: 0, top: 0, width: 100, height: 100 }, h.notes).then(() => {
		completed = true
	})
	await new Promise<void>(resolve => setImmediate(resolve))
	assert.deepEqual(h.motions.map(motion => motion.name).sort(), ['captionDescription', 'captionPlace', 'captionTitle', 'photograph'])
	assert.equal(h.motions.find(motion => motion.name === 'captionTitle')!.frames[0]!.transform, 'translate3d(-800px, 400px, 0)')
	assert.equal(h.runtime.notesReady.value, true)
	h.motions.find(motion => motion.name === 'photograph')!.finish()
	await Promise.resolve()
	assert.equal(completed, false)
	for (const motion of h.motions)
		motion.finish()
	await pending
	assert.equal(completed, true)
})
test('unmount cancels photo and caption motions without stranding the opening promise', async () => {
	const h = animatedViewer()
	const pending = h.runtime.enter({ left: 0, top: 0, width: 100, height: 100 }, h.notes)
	await new Promise<void>(resolve => setImmediate(resolve))
	assert.equal(h.motions.length, 4)
	h.dispose()
	assert.equal(h.motions.every(motion => motion.cancelled), true)
	await pending
})
test('reduced motion shows the notes immediately without creating animations', async () => {
	const h = animatedViewer('reduce')
	await h.runtime.enter({ left: 0, top: 0, width: 100, height: 100 }, h.notes)
	assert.equal(h.motions.length, 0)
	assert.equal(h.runtime.notesReady.value, true)
})

test('closing returns the caption to its reading anchor and retains the final frame until dialog removal', async () => {
	const h = animatedViewer()
	const target = { left: 0, top: 0, width: 100, height: 100 }
	const pending = h.runtime.leave(target, h.notes)
	assert.equal(h.motions.length, 4)
	const title = h.motions.find(motion => motion.name === 'captionTitle')!
	assert.equal(title.frames[1]!.transform, 'translate3d(-800px, 400px, 0)')
	assert.equal(title.frames[1]!.opacity, 0)
	for (const motion of h.motions)
		motion.finish()
	await pending
	assert.equal(h.motions.some(motion => motion.cancelled), false)
	h.dispose()
	assert.equal(h.motions.every(motion => motion.cancelled), true)
})

test('opening smoothly straightens a tilted reading photo', async () => {
	const h = animatedViewer()
	const pending = h.runtime.enter({ left: 0, top: 0, width: 100, height: 100, rotation: -1.1 }, h.notes)
	await new Promise<void>(resolve => setImmediate(resolve))
	const photo = h.motions.find(motion => motion.name === 'photograph')!
	assert.match(String(photo.frames[0]!.transform), /rotate\(-1\.1deg\)/)
	assert.equal(photo.frames[1]!.transform, 'none')
	for (const motion of h.motions)
		motion.finish()
	await pending
})

test('closing restores the reading tilt before the dialog is removed', async () => {
	const h = animatedViewer()
	const pending = h.runtime.leave({ left: 0, top: 0, width: 100, height: 100, rotation: 1.2 }, h.notes)
	const photo = h.motions.find(motion => motion.name === 'photograph')!
	assert.match(String(photo.frames[1]!.transform), /rotate\(1\.2deg\)/)
	for (const motion of h.motions)
		motion.finish()
	await pending
	assert.equal(photo.cancelled, false)
	h.dispose()
})
