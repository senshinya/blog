import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
// eslint-disable-next-line test/no-import-node-test -- Use the repository's Node test runner.
import test from 'node:test'
import vm from 'node:vm'

function harness({ reduced = false, viewer = false, interactive = true } = {}) {
	const props = { photo: { src: 'photo.jpg', live: 'photo.mp4' }, index: 0, active: true, viewer, interactive }
	const watchers: Array<{ source: () => unknown, callback: (value: unknown) => void, previous: unknown }> = []
	const script = stripTypeScriptTypes(readFileSync(new URL('./Photo.vue', import.meta.url), 'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)![1]!).replace(/^import .*$/gm, '')
	const runtime = vm.runInNewContext(`${script}\n;({ enter, leave, hovering, toggleLive, livePlaying, liveMuted: typeof liveMuted === 'undefined' ? undefined : liveMuted, liveVideo: typeof liveVideo === 'undefined' ? undefined : liveVideo, toggleSound: typeof toggleSound === 'undefined' ? undefined : toggleSound })`, {
		defineProps: () => props,
		withDefaults: (value: unknown) => value,
		defineEmits() {},
		usePreferredReducedMotion: () => ({ value: reduced ? 'reduce' : 'no-preference' }),
		ref: (value: unknown) => ({ value }),
		computed: (get: () => unknown) => ({ get value() { return get() } }),
		getImgMeta: () => undefined,
		onMounted() {},
		nextTick: () => Promise.resolve(),
		watch(source: () => unknown, callback: (value: unknown) => void) {
			watchers.push({ source, callback, previous: source() })
		},
	}) as { enter: (event: { pointerType: string }) => void, leave: () => void, toggleLive: () => Promise<void>, livePlaying: { value: boolean }, hovering: { value: boolean }, liveMuted: { value: boolean }, liveVideo: { value: { muted: boolean, play: () => Promise<void> } | undefined }, toggleSound: () => void }
	return { props, runtime, flush() {
		for (const watcher of watchers) {
			if (watcher.source() !== watcher.previous) {
				watcher.previous = watcher.source()
				watcher.callback(watcher.previous)
			}
		}
	} }
}

test('ordinary photographs lift on mouse hover and settle after pointer leave or viewer entry', () => {
	const h = harness()
	delete (h.props.photo as { live?: string }).live
	h.runtime.enter({ pointerType: 'mouse' })
	assert.equal(h.runtime.hovering.value, true)
	h.runtime.leave()
	assert.equal(h.runtime.hovering.value, false)
	h.runtime.enter({ pointerType: 'mouse' })
	h.props.active = false
	h.flush()
	assert.equal(h.runtime.hovering.value, false)
})

test('inactive photos, touch input and reduced-motion readers do not lift', () => {
	const inactive = harness()
	inactive.props.active = false
	for (const h of [inactive, harness({ interactive: false }), harness({ reduced: true })]) {
		h.runtime.enter({ pointerType: 'mouse' })
		assert.equal(h.runtime.hovering.value, false)
	}
	const touch = harness()
	touch.runtime.enter({ pointerType: 'touch' })
	assert.equal(touch.runtime.hovering.value, false)
})

test('manual stop overrides hover and explicit play persists after pointer leave', () => {
	const h = harness()
	h.runtime.enter({ pointerType: 'mouse' })
	assert.equal(h.runtime.livePlaying.value, true)
	h.runtime.toggleLive()
	assert.equal(h.runtime.livePlaying.value, false)
	h.runtime.leave()
	h.runtime.enter({ pointerType: 'mouse' })
	assert.equal(h.runtime.livePlaying.value, false)
	h.runtime.toggleLive()
	h.runtime.leave()
	assert.equal(h.runtime.livePlaying.value, true)
})

test('mobile and reduced-motion readers can explicitly play and stop without hover', () => {
	for (const options of [{ interactive: false }, { reduced: true }]) {
		const h = harness(options)
		h.runtime.enter({ pointerType: 'mouse' })
		assert.equal(h.runtime.livePlaying.value, false)
		h.runtime.toggleLive()
		assert.equal(h.runtime.livePlaying.value, true)
		h.runtime.toggleLive()
		assert.equal(h.runtime.livePlaying.value, false)
	}
})

test('leaving the active photo stops playback and resets the prior manual choice', () => {
	const h = harness()
	h.runtime.toggleLive()
	h.props.active = false
	h.flush()
	assert.equal(h.runtime.livePlaying.value, false)
	h.props.active = true
	h.flush()
	assert.equal(h.runtime.livePlaying.value, false)
})

test('the viewer preserves autoplay preference and offers an explicit stop', () => {
	const h = harness({ viewer: true })
	assert.equal(h.runtime.livePlaying.value, true)
	h.runtime.toggleLive()
	assert.equal(h.runtime.livePlaying.value, false)
	assert.equal(harness({ viewer: true, reduced: true }).runtime.livePlaying.value, false)
})

test('live photos autoplay muted and unmute the current video in the click gesture', () => {
	for (const viewer of [false, true]) {
		const h = harness({ viewer })
		let plays = 0
		const video = { muted: true, play: () => {
			plays++
			return Promise.resolve()
		} }
		assert.equal(h.runtime.liveMuted?.value, true)
		h.runtime.liveVideo.value = video
		h.runtime.enter({ pointerType: 'mouse' })
		h.runtime.toggleSound()
		assert.equal(video.muted, false, 'unmuting happens synchronously inside the user gesture')
		assert.equal(h.runtime.liveMuted.value, false)
		assert.equal(h.runtime.livePlaying.value, true)
		assert.equal(plays, 1)
		h.runtime.toggleSound()
		assert.equal(video.muted, true)
		assert.equal(h.runtime.liveMuted.value, true)
	}
})

test('changing sound while stopped does not start playback and explicit play keeps the choice', async () => {
	const h = harness({ interactive: false })
	let plays = 0
	assert.equal(h.runtime.liveMuted?.value, true)
	h.runtime.toggleSound()
	assert.equal(h.runtime.liveMuted.value, false)
	assert.equal(h.runtime.livePlaying.value, false)
	const pending = h.runtime.toggleLive()
	const video = { muted: true, play: () => {
		plays++
		return Promise.resolve()
	} }
	h.runtime.liveVideo.value = video
	await pending
	assert.equal(video.muted, false)
	assert.equal(plays, 1)
	await h.runtime.toggleLive()
	assert.equal(h.runtime.livePlaying.value, false)
	assert.equal(h.runtime.liveMuted.value, false)
})

test('sound defaults to muted again after leaving or replacing the photo', () => {
	const h = harness()
	assert.equal(h.runtime.liveMuted?.value, true)
	h.runtime.toggleSound()
	h.props.active = false
	h.flush()
	assert.equal(h.runtime.liveMuted.value, true)
	h.runtime.toggleSound()
	h.props.photo.src = 'next.jpg'
	h.flush()
	assert.equal(h.runtime.liveMuted.value, true)
})

test('blocked sound playback settles the control back to stopped', async () => {
	const h = harness({ viewer: true })
	assert.equal(h.runtime.liveMuted?.value, true)
	h.runtime.liveVideo.value = { muted: true, play: () => Promise.reject(new Error('NotAllowedError')) }
	h.runtime.toggleSound()
	await Promise.resolve()
	assert.equal(h.runtime.livePlaying.value, false)
})
