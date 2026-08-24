import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Vitest is not a project dependency; use Node's built-in runner.
import test from 'node:test'

test('uses the GitHub display name and profile URL for comment identity', async () => {
	const { commentSessionIdentity } = await import('./comment.ts')
	const identity = commentSessionIdentity({
		id: 7,
		login: 'senshinya',
		name: 'shinya',
		avatar_url: 'https://avatars.example/shinya',
		email: null,
	})

	assert.deepEqual(identity, {
		name: 'shinya',
		profile: 'https://github.com/senshinya',
	})
})

test('falls back to the GitHub login when the display name is empty', async () => {
	const { commentSessionIdentity } = await import('./comment.ts')
	const identity = commentSessionIdentity({
		id: 7,
		login: 'senshinya',
		name: '',
		avatar_url: 'https://avatars.example/shinya',
		email: null,
	})

	assert.equal(identity.name, 'senshinya')
})
