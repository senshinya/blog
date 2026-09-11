import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
// eslint-disable-next-line test/no-import-node-test -- Use the project's built-in Node test runner.
import test from 'node:test'
import { runInNewContext } from 'node:vm'

function setup(supported = true) {
	const source = readFileSync(new URL('./useVisibleTask.ts', import.meta.url), 'utf8')
	const code = stripTypeScriptTypes(source.replace(/^import .*\n/gm, '').replace('export function', 'function'))
	let intersect = (_entries: { isIntersecting: boolean }[]) => {}
	let dispose = () => {}
	let mount = () => {}
	let stops = 0
	const calls: (() => boolean)[] = []
	const useVisibleTask = runInNewContext(`${code}; useVisibleTask`, {
		useIntersectionObserver: (_target: unknown, callback: typeof intersect) => {
			intersect = callback
			return { stop: () => stops++, isSupported: { value: supported } }
		},
		onScopeDispose: (callback: typeof dispose) => dispose = callback,
		onMounted: (callback: typeof mount) => mount = callback,
	})
	useVisibleTask({}, (active: () => boolean) => calls.push(active))
	return { calls, mount: () => mount(), intersect: (visible: boolean) => intersect([{ isIntersecting: visible }]), dispose: () => dispose(), stops: () => stops }
}

test('visible tasks do not start at mount or while offscreen and start once on entry', () => {
	const task = setup()
	task.mount()
	task.intersect(false)
	assert.equal(task.calls.length, 0)
	task.intersect(true)
	task.intersect(true)
	assert.equal(task.calls.length, 1)
	assert.equal(task.calls[0]!(), true)
	assert.equal(task.stops(), 1)
})

test('late asynchronous work and queued observer callbacks can detect disposal', () => {
	const task = setup()
	task.intersect(true)
	task.dispose()
	assert.equal(task.calls[0]!(), false)
	task.intersect(true)
	assert.equal(task.calls.length, 1)
	const unmounted = setup()
	unmounted.dispose()
	unmounted.intersect(true)
	assert.equal(unmounted.calls.length, 0)
})

test('browsers without IntersectionObserver still render after mount', () => {
	const task = setup(false)
	assert.equal(task.calls.length, 0)
	task.mount()
	assert.equal(task.calls.length, 1)
})
