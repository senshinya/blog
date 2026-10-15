import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
// eslint-disable-next-line test/no-import-node-test -- Use the repository's Node test runner.
import test from 'node:test'
import vm from 'node:vm'

function harness(viewer = false) {
	const props = { src: 'video.mp4', poster: 'poster.webp', active: true, viewer }
	const watchers: { get: () => unknown, callback: (value: unknown) => void, previous: unknown }[] = []
	let mount = () => {}
	let dispose = () => {}
	const emitted: string[] = []
	const script = stripTypeScriptTypes(readFileSync(new URL('./Video.vue', import.meta.url), 'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)![1]!).replace(/^import .*$/gm, '')
	const runtime = vm.runInNewContext(`${script}\n;({ video, toggle, activateSurface, toggleMuted, seek, seekPointer: typeof seekPointer === 'undefined' ? undefined : seekPointer, stopSeeking: typeof stopSeeking === 'undefined' ? undefined : stopSeeking, onPlaying, onPause, onEnded, onError, sync, playing, started, loading, failed, current, duration, formatTime })`, {
		defineProps: () => props,
		withDefaults: (value: unknown) => value,
		defineEmits: () => (event: string) => emitted.push(event),
		useI18n: () => ({ t: (key: string) => key }),
		usePreferredReducedMotion: () => ({ value: 'no-preference' }),
		ref: (value: unknown) => ({ value }),
		computed: (get: () => unknown) => ({ get value() { return get() } }),
		onMounted: (callback: () => void) => { mount = callback },
		onScopeDispose: (callback: () => void) => { dispose = callback },
		watch(get: () => unknown, callback: (value: unknown) => void) {
			watchers.push({ get, callback, previous: get() })
		},
	}) as any
	const media = {
		paused: true,
		ended: false,
		muted: false,
		currentTime: 0,
		duration: 26.642,
		plays: 0,
		pauses: 0,
		play: async () => {
			media.plays++
			media.paused = false
		},
		pause: () => {
			media.pauses++
			media.paused = true
		},
		load() {},
	}
	runtime.video.value = media
	return { props, runtime, media, emitted, mount: () => mount(), dispose: () => dispose(), flush() {
		for (const watcher of watchers) {
			const value = watcher.get()
			if (watcher.previous !== value) {
				watcher.previous = value
				watcher.callback(value)
			}
		}
	} }
}

test('the reading surface opens the viewer while the viewer surface controls playback', async () => {
	const reading = harness()
	assert.equal(typeof reading.runtime.activateSurface, 'function')
	await reading.runtime.activateSurface()
	assert.deepEqual(reading.emitted, ['enlarge'])
	assert.equal(reading.media.plays, 0)
	const viewer = harness(true)
	await viewer.runtime.activateSurface()
	assert.equal(viewer.media.plays, 1)
	assert.deepEqual(viewer.emitted, [])
})

test('reading video waits for explicit play, preserves sound, and follows media playback events', async () => {
	const h = harness()
	h.mount()
	assert.equal(h.media.plays, 0)
	await h.runtime.toggle()
	assert.equal(h.media.plays, 1)
	assert.equal(h.media.muted, false)
	h.runtime.onPlaying()
	assert.equal(h.runtime.playing.value, true)
	assert.equal(h.runtime.started.value, true)
	assert.equal(h.runtime.loading.value, false)
	await h.runtime.toggle()
	assert.equal(h.media.paused, true)
	h.runtime.onPause()
	assert.equal(h.runtime.playing.value, false)
})

test('leaving the page, entering the viewer, replacing media and disposal stop inline sound', async () => {
	const h = harness()
	await h.runtime.toggle()
	h.media.currentTime = 12
	h.runtime.onPlaying()
	h.props.active = false
	h.flush()
	assert.equal(h.media.paused, true)
	assert.equal(h.media.currentTime, 12)
	h.props.active = true
	h.flush()
	assert.equal(h.media.plays, 1)
	h.props.src = 'next.mp4'
	h.flush()
	assert.equal(h.runtime.started.value, false)
	assert.equal(h.runtime.current.value, 0)
	assert.equal(h.runtime.duration.value, 0)
	h.dispose()
	assert.ok(h.media.pauses >= 3)
})

test('scrubbing clamps to media duration and mute changes apply synchronously', () => {
	const h = harness()
	h.runtime.sync()
	h.runtime.seek({ target: { value: '100' } })
	assert.equal(h.media.currentTime, 26.642)
	h.runtime.seek({ target: { value: '-8' } })
	assert.equal(h.media.currentTime, 0)
	h.runtime.seek({ target: { value: 'NaN' } })
	assert.equal(h.media.currentTime, 0)
	h.runtime.toggleMuted()
	assert.equal(h.media.muted, true)
	h.runtime.toggleMuted()
	assert.equal(h.media.muted, false)
	assert.equal(h.runtime.formatTime(26.642), '0:26')
	assert.equal(h.runtime.formatTime(Number.POSITIVE_INFINITY), '0:00')
})

test('pointer seeking works without giving the progress slider focus', () => {
	const h = harness()
	h.runtime.sync()
	assert.equal(typeof h.runtime.seekPointer, 'function')
	let captures = 0
	let prevented = 0
	const event = {
		type: 'pointerdown',
		button: 0,
		pointerId: 1,
		clientX: 154,
		currentTarget: { getBoundingClientRect: () => ({ left: 100, width: 208 }), setPointerCapture: () => captures++ },
		preventDefault: () => prevented++,
	}
	h.runtime.seekPointer(event)
	assert.equal(h.media.currentTime, h.media.duration / 4)
	assert.equal(captures, 1)
	event.type = 'pointermove'
	event.clientX = 400
	h.runtime.seekPointer(event)
	assert.equal(h.media.currentTime, h.media.duration)
	assert.equal(prevented, 2)
	h.runtime.stopSeeking()
	event.clientX = 100
	h.runtime.seekPointer(event)
	assert.equal(h.media.currentTime, h.media.duration)
})

test('blocked playback leaves an actionable play button and media errors can be retried', async () => {
	const h = harness()
	h.media.play = () => Promise.reject(new Error('NotAllowedError'))
	await h.runtime.toggle()
	assert.equal(h.runtime.playing.value, false)
	assert.equal(h.runtime.loading.value, false)
	h.runtime.onError()
	assert.equal(h.runtime.failed.value, true)
	h.media.play = async () => {
		h.media.paused = false
	}
	await h.runtime.toggle()
	h.runtime.onPlaying()
	assert.equal(h.runtime.failed.value, false)
	assert.equal(h.runtime.playing.value, true)
})
