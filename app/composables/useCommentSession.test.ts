import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Vitest is not a project dependency; use Node's built-in runner.
import test from 'node:test'

test('clears the local comment session after logout succeeds', async () => {
	const { performCommentLogout } = await import('./useCommentSession.ts')
	let cleared = false

	await performCommentLogout(async () => {}, () => {
		cleared = true
	})

	assert.equal(cleared, true)
})

test('keeps the local comment session when logout fails', async () => {
	const { performCommentLogout } = await import('./useCommentSession.ts')
	const failure = new Error('logout failed')
	let cleared = false

	await assert.rejects(
		performCommentLogout(async () => {
			throw failure
		}, () => {
			cleared = true
		}),
		failure,
	)

	assert.equal(cleared, false)
})
