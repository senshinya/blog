import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
// eslint-disable-next-line test/no-import-node-test -- Vitest is not a project dependency; use Node's built-in runner.
import test from 'node:test'

const composablePath = new URL('./usePageViewerReactions.ts', import.meta.url)

test('loads viewer reactions in authenticated batches without leaking stale sessions', async () => {
	const source = await readFile(composablePath, 'utf8')

	assert.match(source, /const CHUNK = 50/)
	assert.match(source, /session\.load\(\)/)
	assert.match(source, /if \(!session\.ready\.value \|\| !session\.user\.value\)/)
	assert.match(source, /'\/api\/pages\/viewer-reactions'/)
	assert.match(source, /query:\s*\{ key: chunk \}/)
	assert.match(source, /const startedEpoch = session\.epoch\.value/)
	assert.match(source, /const startedUser = session\.user\.value\.id/)
	assert.match(source, /session\.epoch\.value !== startedEpoch/)
	assert.match(source, /session\.user\.value\?\.id !== startedUser/)
})

test('clears personal reaction projections when the session changes', async () => {
	const source = await readFile(composablePath, 'utf8')

	assert.match(source, /watch\(session\.epoch/)
	assert.match(source, /viewerReactions\.value = \{\}/)
	assert.match(source, /fetched\.clear\(\)/)
	assert.match(source, /pending\.clear\(\)/)
})
