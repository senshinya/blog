import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
// eslint-disable-next-line test/no-import-node-test -- Repository Node test runner.
import test from 'node:test'
import vm from 'node:vm'

function harness(count = 11, chapter = 10) {
	const events: any[][] = []
	const listeners = new Map<string, { callback: (event: any) => void, options: any }>()
	const watchers: any[] = []
	const props = {
		open: false,
		chapter,
		progress: { current: 4, total: 13 },
		anchor: { getBoundingClientRect: () => ({ left: 550, width: 100 }) },
		travel: { title: '新西兰南岛', days: Array.from({ length: count }, (_, index) => ({ title: `完整章节 ${index + 1}`, shortTitle: `短标题 ${index + 1}`, day: index, photos: Array.from({ length: index + 1 }) })) },
	}
	const list = {
		scrollTop: 0,
		clientHeight: 280,
		scrollHeight: 1100,
		getBoundingClientRect: () => ({ top: 100, bottom: 380 }),
		querySelector(selector: string) {
			const index = Number(selector.match(/"(\d+)"/)![1])
			return {
				getBoundingClientRect: () => ({ top: 100 + index * 64 - list.scrollTop, bottom: 164 + index * 64 - list.scrollTop, height: 64 }),
				focus() { throw new Error('Directory must not focus controls') },
			}
		},
	}
	const refs: Record<string, any> = { list: { value: list }, panel: { value: { offsetWidth: 560 } } }
	const source = stripTypeScriptTypes(readFileSync(new URL('./ChapterDirectory.vue', import.meta.url), 'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)![1]!).replace(/^import .*$/gm, '')
	const runtime = vm.runInNewContext(`${source}\n;({ items, columns, handleKey, choose, dismiss, afterLeave, updateEdges })`, {
		defineProps: () => props,
		defineEmits: () => (...args: any[]) => events.push(args),
		ref: (value: unknown) => ({ value }),
		computed: (get: () => unknown) => ({ get value() { return get() } }),
		useTemplateRef: (name: string) => refs[name] ?? { value: null },
		useI18n: () => ({ t: (key: string) => key }),
		nextTick: () => Promise.resolve(),
		window: { innerWidth: 1200 },
		watch(get: () => unknown, callback: (value: unknown) => unknown) { watchers.push({ get, callback, previous: get() }) },
		useEventListener(name: string, callback: (event: any) => void, options: any) { listeners.set(name, { callback, options }) },
	})
	return { props, list, runtime, events, listeners, async setOpen(value: boolean) {
		props.open = value
		for (const watcher of watchers) {
			const next = watcher.get()
			if (next !== watcher.previous) {
				watcher.previous = next
				await watcher.callback(next)
			}
		}
	}, key(key: string, modifiers: Record<string, unknown> = {}) {
		const event = {
			key,
			defaultPrevented: false,
			stopped: false,
			preventDefault() { this.defaultPrevented = true },
			stopPropagation() { this.stopped = true },
			...modifiers,
		}
		listeners.get('keydown')!.callback(event)
		return event
	} }
}

test('directory columns preserve chapter order and use the full chapter titles', () => {
	const h = harness()
	assert.deepEqual(JSON.parse(JSON.stringify(h.runtime.columns.value.map((column: any[]) => column.map(item => item.index)))), [[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11]])
	assert.equal(h.runtime.items.value[0].key, 'intro')
	assert.equal(h.runtime.items.value[11].title, '完整章节 11')
	assert.equal(harness(4, 0).runtime.columns.value.length, 1)
	assert.equal(harness(0, -1).runtime.items.value.length, 1)
})

test('opening and re-opening reveal the current chapter without moving DOM focus', async () => {
	const h = harness()
	await h.setOpen(true)
	assert.ok(h.list.scrollTop > 0)
	await h.setOpen(false)
	h.list.scrollTop = 0
	await h.setOpen(true)
	assert.ok(h.list.scrollTop > 0)
})

test('navigation keys neither select chapters nor change the page behind the directory', async () => {
	const h = harness()
	assert.equal(h.listeners.get('keydown')!.options.capture, true)
	assert.equal(h.key('ArrowDown').defaultPrevented, false)
	await h.setOpen(true)
	const scrollTop = h.list.scrollTop
	for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp', 'Enter', ' ']) {
		const event = h.key(key)
		assert.equal(event.defaultPrevented, true)
		assert.equal(event.stopped, true)
	}
	assert.deepEqual(h.events, [])
	assert.equal(h.list.scrollTop, scrollTop)
	assert.equal(h.key('ArrowDown', { ctrlKey: true }).defaultPrevented, false)
	assert.equal(h.key('x').defaultPrevented, false)
})

test('selection closes first and navigates only after the panel finishes leaving', async () => {
	const h = harness()
	await h.setOpen(true)
	h.runtime.choose('chapter-0')
	assert.deepEqual(h.events, [['close']])
	h.runtime.choose('chapter-1')
	assert.deepEqual(h.events, [['close']], 'repeated input during closing cannot select again')
	await h.setOpen(false)
	h.runtime.afterLeave()
	assert.deepEqual(h.events, [['close'], ['navigate', 'chapter-0']])
})

test('Escape dismisses without navigation and a quick re-open cancels a pending jump', async () => {
	const h = harness()
	await h.setOpen(true)
	assert.equal(h.key('Escape').stopped, true)
	await h.setOpen(false)
	h.runtime.afterLeave()
	assert.deepEqual(h.events, [['close']])
	await h.setOpen(true)
	h.runtime.choose('chapter-2')
	await h.setOpen(false)
	await h.setOpen(true)
	h.runtime.afterLeave()
	assert.equal(h.events.filter(event => event[0] === 'navigate').length, 0)
})

test('Escape is inactive when closed and modified keys retain browser behavior', async () => {
	const h = harness()
	assert.equal(h.key('Escape').stopped, false)
	await h.setOpen(true)
	assert.equal(h.key('Escape', { metaKey: true }).stopped, false)
	assert.deepEqual(h.events, [])
})
