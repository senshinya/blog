import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
// eslint-disable-next-line test/no-import-node-test -- Use the project's built-in Node test runner.
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { ref } from 'vue'

function setup() {
	const state = ref(null)
	const code = stripTypeScriptTypes(readFileSync(new URL('./useArticleArrival.ts', import.meta.url), 'utf8')
		.replace(/^import .*\n/gm, '')
		.replaceAll('import.meta.client', 'true'))
		.replace(/^export /gm, '')
	const service = runInNewContext(`${code}\nuseArticleArrival()`, {
		useState: () => state,
		normalizeContentPath: (path: string) => path.replace(/\/+$/, '') || '/',
		window: { location: { origin: 'https://blog.test' } },
		document: { querySelectorAll: () => [] },
	})
	const post = { path: '/article', title: 'Article', description: 'Summary', image: '/cover.webp', body: 'large body', readingTime: { words: 123 } }
	const link = { origin: 'https://blog.test', pathname: '/en/article/', hash: '', target: '', dataset: {}, querySelector: () => ({ complete: true, naturalWidth: 480, currentSrc: '/cover-480.webp' }) }
	const event = { button: 0, currentTarget: link }
	return { state, service, post, event, link }
}

test('arrival carries only display metadata and the already displayed image', () => {
	const { state, service, post, event } = setup()
	service.begin(event, post)
	const arrival = state.value as any
	assert.equal(arrival.path, '/en/article')
	assert.equal(arrival.cover, '/cover-480.webp')
	assert.equal(arrival.post.title, 'Article')
	assert.equal(arrival.post.body, undefined)
	assert.notEqual(arrival.post.readingTime, post.readingTime)
	assert.equal(arrival.visible, false, 'the old page must remain intact until its snapshot is captured')
})

test('modified, external and cancelled clicks keep ordinary link behavior', () => {
	const { state, service, post, event, link } = setup()
	for (const modifier of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey', 'defaultPrevented']) {
		service.begin({ ...event, [modifier]: true }, post)
		assert.equal(state.value, null)
	}
	service.begin({ ...event, button: 1 }, post)
	assert.equal(state.value, null)
	link.origin = 'https://other.test'
	service.begin(event, post)
	assert.equal(state.value, null)
})

test('a late article response cannot change the next arrival', () => {
	const { state, service, post, event } = setup()
	service.begin(event, post)
	const arrival = state.value as any
	arrival.visible = true
	service.resolve('/another', { ...post, title: 'Stale' })
	assert.equal(arrival.resolved, undefined)
	service.resolve('/en/article/', { ...post, title: 'Resolved' })
	assert.equal(arrival.resolved.title, 'Resolved')
	service.resolve('/en/article', null)
	assert.equal(arrival.failed, true)
})
