import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// eslint-disable-next-line test/no-import-node-test -- Use the project's built-in Node test runner.
import test from 'node:test'
import { defineCollection } from '@nuxt/content'

function fixture() {
	const root = mkdtempSync(join(tmpdir(), 'publication-'))
	for (const locale of ['zh', 'en', 'ja']) {
		mkdirSync(join(root, 'content', locale, 'posts'), { recursive: true })
		mkdirSync(join(root, 'content', locale, 'previews'), { recursive: true })
		mkdirSync(join(root, 'travels', locale), { recursive: true })
		writeFileSync(join(root, 'content', locale, 'posts/public.md'), '---\ndraft: false\n---\nPublished body\ndraft: true')
		writeFileSync(join(root, 'content', locale, 'posts/private[1].md'), '---  \n"draft": TRUE\n---  \nPRIVATE_ARTICLE_SENTINEL')
		writeFileSync(join(root, 'content', locale, 'previews/preview.md'), '---\npermalink: /innocent\n---\nPRIVATE_PREVIEW_SENTINEL')
		writeFileSync(join(root, 'travels', locale, 'public.yaml'), 'slug: public\ntitle: Public travel\n')
		writeFileSync(join(root, 'travels', locale, 'private.yaml'), '"draft": true\nslug: private\ntitle: PRIVATE_TRAVEL_SENTINEL\n')
	}
	return root
}

test('Content source enumeration prevents private bodies reaching the parser in every locale', async (t) => {
	const { getContentSourceExcludes } = await import('./sources.ts')
	const root = fixture()
	t.after(() => rmSync(root, { recursive: true, force: true }))
	for (const locale of ['zh', 'en', 'ja']) {
		for (const isDev of [false, true]) {
			const collection = defineCollection({
				type: 'page',
				source: { include: `${locale}/**/*.md`, prefix: '', exclude: getContentSourceExcludes(join(root, 'content'), locale, isDev) },
			})
			const source = collection.source![0]!
			await source.prepare!({ rootDir: root })
			const keys = await source.getKeys!()
			assert.deepEqual(keys.toSorted(), isDev ? ['posts/private[1].md', 'posts/public.md', 'previews/preview.md'] : ['posts/public.md'])
			const bodies = await Promise.all(keys.map(key => source.getItem!(key)))
			assert.equal(bodies.join('\n').includes('PRIVATE_'), isDev)
		}
	}
})

test('travel build output contains only public payloads and imports no private files', async (t) => {
	const { generateTravelData } = await import('./sources.ts')
	const root = fixture()
	t.after(() => rmSync(root, { recursive: true, force: true }))
	const production = generateTravelData(join(root, 'travels'), ['zh', 'en', 'ja'], false)
	assert.equal(production.includes('PRIVATE_TRAVEL_SENTINEL'), false)
	assert.equal(production.includes('private.yaml'), false)
	const result = await import(`data:text/javascript,${encodeURIComponent(production)}`)
	for (const locale of ['zh', 'en', 'ja'])
		assert.deepEqual(result.travelsByLocale[locale].map((travel: { slug: string }) => travel.slug), ['public'])
	const development = generateTravelData(join(root, 'travels'), ['zh', 'en', 'ja'], true)
	assert.equal(development.includes('PRIVATE_TRAVEL_SENTINEL'), true)
})

test('private frontmatter accepts the same delimiter whitespace as Nuxt Content', async () => {
	const { isPrivateContentSource } = await import('./sources.ts')
	for (const source of [
		'---  \ndraft: true\n---\nPRIVATE',
		'---\ndraft: true\n---  \nPRIVATE',
		'---\r\ndraft: true\r\n---\r\nPRIVATE',
		'---\n"draft": TRUE\n---\nPRIVATE',
	]) {
		assert.equal(isPrivateContentSource('posts/secret.md', source), true)
	}
	assert.equal(isPrivateContentSource('posts/public.md', 'Text\n---\ndraft: true\n---'), false)
})
