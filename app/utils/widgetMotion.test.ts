import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Use the project's built-in Node test runner.
import test from 'node:test'
import { finishWidgetEntrance, prepareWidgetLeave } from './widgetMotion.ts'

test('leaving widgets retain their position inside a scrolled sidebar', () => {
	const widget = {
		parentElement: {
			id: 'blog-aside',
			getBoundingClientRect: () => ({ top: 20 }),
			scrollTop: 60,
			clientTop: 1,
		},
		getBoundingClientRect: () => ({ top: 120.1875, height: 317.03125 }),
		style: { top: '', height: '' },
	}
	prepareWidgetLeave(widget as unknown as HTMLElement)
	assert.equal(Number.parseFloat(widget.style.top) + 20 + 1 - 60, 120.1875)
	assert.equal(widget.style.height, '317.03125px')
})

test('entrance already completed before hydration is still consumed', async () => {
	const widget = { dataset: {} as Record<string, string>, getAnimations: () => [] }
	await finishWidgetEntrance(widget as unknown as HTMLElement)
	assert.equal(widget.dataset.nativeEntered, '')
})

test('an active entrance finishes before it is consumed; unrelated animation does not block it', async () => {
	let finish!: () => void
	const finished = new Promise<void>((resolve) => {
		finish = resolve
	})
	const widget = {
		dataset: {} as Record<string, string>,
		getAnimations: () => [
			{ animationName: 'widget-in', finished },
			{ animationName: 'decoration', finished: new Promise(() => {}) },
		],
	}
	const settling = finishWidgetEntrance(widget as unknown as HTMLElement)
	await Promise.resolve()
	assert.equal(widget.dataset.nativeEntered, undefined)
	finish()
	await settling
	assert.equal(widget.dataset.nativeEntered, '')
})
