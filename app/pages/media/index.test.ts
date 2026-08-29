import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
// eslint-disable-next-line test/no-import-node-test -- Vitest is not a project dependency; use Node's built-in runner.
import test from 'node:test'

const pagePath = new URL('./index.vue', import.meta.url)
const skeletonPath = new URL('../../components/media/CardSkeleton.vue', import.meta.url)

test('renders eight accessible media card placeholders during full-page loading', async () => {
	const page = await readFile(pagePath, 'utf8')

	assert.match(page, /<template v-else-if="loading">/)
	assert.match(page, /v-for="index in 8"/)
	assert.match(page, /<MediaCardSkeleton\s*\/>/)
	assert.match(page, /aria-hidden="true"/)
	assert.match(page, /role="status"/)
	assert.match(page, /正在加载娱乐收藏/)
	assert.doesNotMatch(page, /<p v-else-if="loading" class="media-tip">/)
})

test('keeps media skeleton motion optional', async () => {
	const skeleton = await readFile(skeletonPath, 'utf8')

	assert.match(skeleton, /@media \(prefers-reduced-motion: reduce\)/)
	assert.match(skeleton, /animation: none/)
})
