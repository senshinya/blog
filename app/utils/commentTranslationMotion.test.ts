import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Use the project's built-in Node test runner.
import test from 'node:test'

function prose(html: string, top = 100) {
	let calls = 0
	let cancelled = 0
	return {
		element: {
			innerHTML: html,
			getBoundingClientRect: () => ({ top, bottom: top + 60 }),
			animate: () => {
				calls++
				return { finished: Promise.resolve(), cancel: () => cancelled++ }
			},
		} as unknown as HTMLElement,
		calls: () => calls,
		cancelled: () => cancelled,
	}
}

test('translated comments animate only changed, visible prose and retain their nodes', async () => {
	const { captureCommentText, animateCommentTranslation } = await import('./commentTranslationMotion.ts')
	const changed = prose('原文')
	const unchanged = prose('same')
	const offscreen = prose('原文', 1200)
	const root = { querySelectorAll: () => [changed.element, unchanged.element, offscreen.element] } as unknown as HTMLElement
	const before = captureCommentText(root)
	changed.element.innerHTML = 'Translation'
	offscreen.element.innerHTML = 'Translation'
	const cancel = animateCommentTranslation(before, false, 900)
	assert.equal(changed.calls(), 1)
	assert.equal(unchanged.calls(), 0)
	assert.equal(offscreen.calls(), 0)
	assert.equal(changed.element.innerHTML, 'Translation')
	cancel()
	assert.equal(changed.cancelled(), 1)
})

test('reduced motion keeps translated comment text static', async () => {
	const { animateCommentTranslation } = await import('./commentTranslationMotion.ts')
	const changed = prose('Translation')
	animateCommentTranslation(new Map([[changed.element, '原文']]), true, 900)
	assert.equal(changed.calls(), 0)
})
