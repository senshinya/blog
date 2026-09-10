import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
// eslint-disable-next-line test/no-import-node-test -- Use the project's built-in Node test runner.
import test from 'node:test'
import { parse } from 'yaml'

const aiArticles = new Set(['macos-27-apple-intelligence-chatgpt.md', 'one-trek-twenty-stacks.md'])

test('every article declares its original authorship consistently across locales', async () => {
	const root = new URL('../content/', import.meta.url)
	const paths = (await readdir(new URL('zh/posts/', root), { recursive: true }))
		.filter(path => path.endsWith('.md'))
	assert.ok(paths.length > 0)
	let reviewedCount = 0
	for (const path of paths) {
		const expected = aiArticles.has(path.split('/').at(-1)!) ? 'ai-human-reviewed' : 'human-only'
		if (expected === 'ai-human-reviewed')
			reviewedCount++
		for (const locale of ['zh', 'en', 'ja']) {
			const source = await readFile(new URL(join(locale, 'posts', path), root), 'utf8')
			const metadata = parse(source.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1])
			assert.equal(metadata.authorship, expected, `${locale}/posts/${path}`)
		}
	}
	assert.equal(reviewedCount, 2)
})
