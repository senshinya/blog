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
	const runtime = vm.runInNewContext(`${script}\n;({ enter, leave, toggleLive: typeof toggleLive === 'function' ? toggleLive : undefined, livePlaying: typeof livePlaying === 'undefined' ? undefined : livePlaying })`, {
		defineProps: () => props,
		withDefaults: (value: unknown) => value,
		defineEmits() {},
		usePreferredReducedMotion: () => ({ value: reduced ? 'reduce' : 'no-preference' }),
		ref: (value: unknown) => ({ value }),
		computed: (get: () => unknown) => ({ get value() { return get() } }),
		getImgMeta: () => undefined,
		onMounted() {},
		watch(source: () => unknown, callback: (value: unknown) => void) {
			watchers.push({ source, callback, previous: source() })
		},
	}) as { enter: (event: { pointerType: string }) => void, leave: () => void, toggleLive: () => void, livePlaying: { value: boolean } }
	return { props, runtime, flush() {
		for (const watcher of watchers) {
			if (watcher.source() !== watcher.previous) {
				watcher.previous = watcher.source()
				watcher.callback(watcher.previous)
			}
		}
	} }
}

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
