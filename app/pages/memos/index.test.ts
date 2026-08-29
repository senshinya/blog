import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
// eslint-disable-next-line test/no-import-node-test -- Vitest is not a project dependency; use Node's built-in runner.
import test from 'node:test'

const pagePath = new URL('./index.vue', import.meta.url)
const cardPath = new URL('../../components/memo/Card.vue', import.meta.url)

test('hydrates memo cards with the signed-in viewer reaction projection', async () => {
	const page = await readFile(pagePath, 'utf8')

	assert.match(page, /const pageKeys = computed\(\(\) => parsedMemos\.value\.map\(memo => `\/memos\/\$\{memo\.id\}`\)\)/)
	assert.match(page, /const viewerReactions = usePageViewerReactions\(pageKeys\)/)
	assert.match(page, /:viewer-reactions="viewerReactions\[`\/memos\/\$\{memo\.id\}`\]"/)
})

test('memo card prefers the freshest personal reaction state', async () => {
	const card = await readFile(cardPath, 'utf8')

	assert.match(card, /defineProps<ParsedMemo & \{ viewerReactions\?: string\[\] \}>\(\)/)
	assert.match(card, /reacted\.value\?\.viewer_reactions \?\? page\.value\?\.viewer_reactions \?\? props\.viewerReactions/)
	assert.doesNotMatch(card, /<MemoBody v-bind="props"/)
})

test('keeps the reaction border clear of the animated tail clip', async () => {
	const card = await readFile(cardPath, 'utf8')

	assert.match(card, /\.tail-in\s*\{[^}]*padding-bottom:\s*1px;/)
})
