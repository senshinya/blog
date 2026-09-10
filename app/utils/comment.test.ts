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

test('allows comment pagination only from a settled thread', async () => {
	const { canLoadMoreComments } = await import('./comment.ts')

	assert.equal(canLoadMoreComments('pending', 'cursor', false), false)
	assert.equal(canLoadMoreComments('ready', null, false), false)
	assert.equal(canLoadMoreComments('ready', 'cursor', true), false)
	assert.equal(canLoadMoreComments('ready', 'cursor', false), true)
})

test('shares a comment thread across localized page URLs', async () => {
	const { commentPageKey } = await import('./comment.ts')
	const locales = ['zh', 'en', 'ja']
	for (const path of ['/posts/hello', '/en/posts/hello/', '/ja//posts/hello?x=1#comment-42'])
		assert.equal(commentPageKey(path, locales), '/posts/hello')
	assert.equal(commentPageKey('/en/', locales), '/')
	assert.equal(commentPageKey('/enjoy/posts/hello', locales), '/enjoy/posts/hello')
	assert.equal(commentPageKey('/memos/ja', locales), '/memos/ja')
})

test('uses API language codes only for translated comment reads', async () => {
	const { commentRequestLanguage } = await import('./comment.ts')
	for (const path of ['/api/pages/thread', '/api/pages/thread/focus', '/api/comments/recent']) {
		assert.equal(commentRequestLanguage(path, 'zh'), 'zh')
		assert.equal(commentRequestLanguage(path, 'en'), 'en')
		assert.equal(commentRequestLanguage(path, 'ja'), 'jp')
		assert.equal(commentRequestLanguage(path, 'jp'), 'jp')
		assert.equal(commentRequestLanguage(path, 'fr'), 'zh')
		assert.equal(commentRequestLanguage(path, 'en', 'POST'), undefined)
	}
	for (const path of ['/api/pages/counts', '/api/me', '/api/comments/42', '/api/comments/preview'])
		assert.equal(commentRequestLanguage(path, 'en'), undefined)
})
