import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Vitest is not a project dependency; use Node's built-in runner.
import test from 'node:test'

test('prevents duplicate logout requests while one is pending', async () => {
	const { default: useCommentLogout } = await import('./useCommentLogout.ts')
	let calls = 0
	let resolveRequest!: () => void
	const request = new Promise<void>((resolve) => {
		resolveRequest = resolve
	})
	const state = useCommentLogout(() => {
		calls += 1
		return request
	})

	const first = state.logout()
	const second = state.logout()

	assert.equal(state.pending.value, true)
	assert.equal(calls, 1)
	resolveRequest()
	await Promise.all([first, second])
	assert.equal(state.pending.value, false)
})

test('shows a retryable error when logout fails', async () => {
	const { default: useCommentLogout } = await import('./useCommentLogout.ts')
	const state = useCommentLogout(async () => {
		throw new Error('logout failed')
	})

	await state.logout()

	assert.equal(state.pending.value, false)
	assert.equal(state.failed.value, true)
})

test('clears the previous error before retrying logout', async () => {
	const { default: useCommentLogout } = await import('./useCommentLogout.ts')
	let attempt = 0
	let failedDuringRetry = true
	const state = useCommentLogout(async () => {
		attempt += 1
		if (attempt === 1)
			throw new Error('logout failed')
		failedDuringRetry = state.failed.value
	})

	await state.logout()
	await state.logout()

	assert.equal(failedDuringRetry, false)
	assert.equal(state.failed.value, false)
})
