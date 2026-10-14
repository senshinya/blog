import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
// eslint-disable-next-line test/no-import-node-test -- Use the repository's Node test runner.
import test from 'node:test'
import vm from 'node:vm'

function harness() {
	const source = { value: 'next-1600.jpg' as string | undefined }
	const blocked = { value: false }
	const connection = { saveData: false, effectiveType: '4g' }
	const document = { visibilityState: 'visible' }
	const timers = new Map<number, () => void>()
	const idle = new Map<number, () => void>()
	const loaded: string[] = []
	let sequence = 0
	let queue = () => {}
	let mounted = () => {}
	let dispose = () => {}
	const script = stripTypeScriptTypes(readFileSync(new URL('./useTravelPhotoPreload.ts', import.meta.url), 'utf8')).replace(/^import .*$/gm, '').replace('export function', 'function')
	vm.runInNewContext(`${script}\nuseTravelPhotoPreload(source, blocked)`, {
		source,
		blocked,
		document,
		navigator: { connection },
		Image: class {
			get src() { return loaded.at(-1) ?? '' }
			set src(value: string) { loaded.push(value) }
		},
		window: {
			setTimeout(fn: () => void) {
				timers.set(++sequence, fn)
				return sequence
			},
			clearTimeout(id: number) { timers.delete(id) },
			requestIdleCallback(fn: () => void) {
				idle.set(++sequence, fn)
				return sequence
			},
			cancelIdleCallback(id: number) { idle.delete(id) },
		},
		watch(_sources: unknown, callback: () => void) {
			queue = callback
			queue()
			return () => {}
		},
		useEventListener() {},
		onMounted(fn: () => void) { mounted = fn },
		onScopeDispose(fn: () => void) { dispose = fn },
	})
	const flush = (jobs: Map<number, () => void>) => {
		const callbacks = [...jobs.values()]
		jobs.clear()
		for (const callback of callbacks)
			callback()
	}
	return { source, blocked, connection, document, loaded, timers, idle, mount: () => mounted(), queue: () => queue(), flushTimers: () => flush(timers), flushIdle: () => flush(idle), dispose: () => dispose() }
}

test('only the settled next image loads, once, after the idle phase', () => {
	const h = harness()
	assert.equal(h.timers.size, 0)
	h.mount()
	h.source.value = 'new-next-800.jpg'
	h.queue()
	h.flushTimers()
	assert.deepEqual(h.loaded, [])
	h.flushIdle()
	assert.deepEqual(h.loaded, ['new-next-800.jpg'])
	h.queue()
	assert.equal(h.timers.size, 0)
})

test('opening the viewer or disposing cancels pending idle downloads', () => {
	for (const close of ['viewer', 'dispose']) {
		const h = harness()
		h.mount()
		h.flushTimers()
		if (close === 'viewer') {
			h.blocked.value = true
			h.queue()
		}
		else {
			h.dispose()
		}
		h.flushIdle()
		assert.deepEqual(h.loaded, [])
	}
})

test('data-saving, slow and hidden readers do not preload', () => {
	for (const condition of ['saveData', 'slow-2g', '2g', 'hidden']) {
		const h = harness()
		if (condition === 'saveData')
			h.connection.saveData = true
		else if (condition === 'hidden')
			h.document.visibilityState = 'hidden'
		else h.connection.effectiveType = condition
		h.mount()
		assert.equal(h.timers.size, 0)
	}
})

test('visibility and network are checked again before a scheduled download', () => {
	const h = harness()
	h.mount()
	h.flushTimers()
	h.connection.saveData = true
	h.flushIdle()
	assert.deepEqual(h.loaded, [])
})
