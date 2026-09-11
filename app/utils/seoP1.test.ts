import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
// eslint-disable-next-line test/no-import-node-test -- Use the project's Node test runner.
import test from 'node:test'
import { runInNewContext } from 'node:vm'

test('locale middleware preserves explicit URLs across browser and cookie languages', () => {
	const source = stripTypeScriptTypes(readFileSync(new URL('../middleware/01.locale-preference.global.ts', import.meta.url), 'utf8')
		.replace(/^import .*\n/gm, '').replace('export default ', '').replaceAll('import.meta.server', 'false'))
	for (const path of ['/fiddling/debian-as-bypass-router', '/en/fiddling/debian-as-bypass-router', '/ja/fiddling/debian-as-bypass-router']) {
		for (const language of ['zh', 'en', 'ja']) {
			for (const stored of [null, 'zh', 'en', 'ja']) {
				let handler: (to: unknown) => unknown = () => {}
				runInNewContext(source, {
					blogConfig: { locales: ['zh', 'en', 'ja'].map(code => ({ code })) },
					manifest: {},
					defineNuxtRouteMiddleware: (fn: typeof handler) => { handler = fn },
					useLocalePreference: () => ({ stored: { value: stored }, persist: () => assert.fail('Only explicit choices may persist preferences') }),
					navigator: { languages: [language] },
					useState: () => ({ value: null }),
					resolvePreferred: () => language,
					decideLocale: () => '/en/fiddling/debian-as-bypass-router',
					suggestLocale: () => '/en/fiddling/debian-as-bypass-router',
					localeRedirectPath: () => '/en/fiddling/debian-as-bypass-router',
					window: { location: { origin: 'https://blog.example' } },
					useNuxtApp: () => ({ isHydrating: true }),
					navigateTo: () => assert.fail('Explicit language URLs must stay put'),
				})
				handler({ path, fullPath: path })
			}
		}
	}
})

test('pagination paths are localized, canonical, and reject invalid page numbers', async () => {
	const { paginationPath, parsePageNumber } = await import('./pagination.ts')
	assert.equal(paginationPath(1, 'en'), '/en')
	assert.equal(paginationPath(2, 'zh'), '/page/2')
	assert.equal(paginationPath(3, 'ja'), '/ja/page/3')
	assert.equal(parsePageNumber('2'), 2)
	for (const value of ['0', '-1', '1.5', '02', 'abc', 'Infinity'])
		assert.equal(parsePageNumber(value), undefined)
})

test('article schema separates SEO description and preserves local publication time', async () => {
	const { articleSchemaData } = await import('./articleSeo.ts')
	const result = articleSchemaData({ title: 'Title', description: 'Visible intro', seoDescription: 'Search summary', date: '2022-12-16 02:06:10', image: '/cover.jpg', tags: ['Raft'] }, '/en/notes/raft', 'en', {
		url: 'https://blog.example/',
		author: { name: 'shinya', homepage: 'https://github.com/senshinya', avatar: '/avatar.png' },
	})
	assert.equal(result.article.description, 'Search summary')
	assert.equal(result.article.datePublished, '2022-12-16T02:06:10+08:00')
	assert.equal(result.article.mainEntityOfPage, 'https://blog.example/en/notes/raft')
	assert.equal(result.article.inLanguage, 'en')
	assert.equal(result.article.image, 'https://blog.example/cover.jpg')
	assert.deepEqual(result.article.author, { '@id': 'https://blog.example/#author' })
	assert.equal(result.person['@id'], 'https://blog.example/#author')
})

test('series navigation reaches every chapter and existing translations', async () => {
	const { articleSeries } = await import('./articleSeries.ts')
	const { existsSync } = await import('node:fs')
	assert.equal(articleSeries.find(s => s.id === 'mydb')!.paths.length, 11)
	for (const series of articleSeries) {
		assert.equal(new Set(series.paths).size, series.paths.length)
		for (const path of series.paths) {
			for (const locale of ['zh', 'en', 'ja'])
				assert.ok(existsSync(new URL(`../../content/${locale}/posts${path}.md`, import.meta.url)), `${locale}: ${path}`)
		}
	}
})

test('Cloudflare candidates represent distinct real widths and preserve unsupported sources', async () => {
	const { responsiveImage } = await import('./responsiveImage.ts')
	const result = responsiveImage('https://blog-img.774352199.xyz/test.webp', 1024)
	assert.match(result.src, /width=1024,/)
	assert.match(result.srcset!, /width=480,format=auto\/test.webp 480w/)
	assert.match(result.srcset!, /width=1024,format=auto\/test.webp 1024w/)
	assert.doesNotMatch(result.srcset!, /1920w/)
	assert.equal(responsiveImage('https://elsewhere.example/a.jpg').srcset, undefined)
	assert.equal(responsiveImage('https://blog-img.774352199.xyz.evil.example/a.jpg').srcset, undefined)
	assert.equal(responsiveImage('https://blog-img.774352199.xyz/a.svg').srcset, undefined)
})

test('legacy pagination redirects before static hydration, retaining filters and fragments', () => {
	const source = stripTypeScriptTypes(readFileSync(new URL('../plugins/00.legacy-pagination.client.ts', import.meta.url), 'utf8')
		.replace(/^import .*\n/gm, '').replace('export default ', ''))
	let destination = ''
	runInNewContext(source, {
		URL,
		window: { location: { href: 'https://blog.example/en/?page=2&category=notes#posts' } },
		stripLocale: () => ({ basePath: '/', locale: 'en' }),
		parsePageNumber: (value: string) => Number(value),
		paginationPath: (page: number, locale: string) => `/${locale}/page/${page}`,
		defineNuxtPlugin: (plugin: { setup: () => void }) => plugin.setup(),
		navigateTo: (target: string, options: { external: boolean, replace: boolean }) => {
			destination = target
			assert.equal(options.external, true)
			assert.equal(options.replace, true)
		},
	})
	assert.equal(destination, '/en/page/2?category=notes#posts')
})
