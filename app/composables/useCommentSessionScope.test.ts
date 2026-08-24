import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Vitest is not a project dependency; use Node's built-in runner.
import test from 'node:test'
import { effectScope, nextTick, ref } from 'vue'

test('invalidates and aborts requests from an earlier comment session', async () => {
	const { default: useCommentSessionScope } = await import('./useCommentSessionScope.ts')
	const epoch = ref(0)
	const scope = effectScope()
	const guard = scope.run(() => useCommentSessionScope(epoch))!
	const request = guard.start()

	assert.equal(guard.current(request), true)
	epoch.value += 1
	await nextTick()

	assert.equal(guard.current(request), false)
	assert.equal(request.controller.signal.aborted, true)
	scope.stop()
})

test('invalidates and aborts requests when the consumer is disposed', async () => {
	const { default: useCommentSessionScope } = await import('./useCommentSessionScope.ts')
	const epoch = ref(0)
	const scope = effectScope()
	const guard = scope.run(() => useCommentSessionScope(epoch))!
	const request = guard.start()

	scope.stop()

	assert.equal(guard.current(request), false)
	assert.equal(request.controller.signal.aborted, true)
})
