/* eslint unicorn/prefer-dom-node-text-content: off -- Verify visible text separately from JSON-LD and payload scripts. */
import assert from 'node:assert/strict'
import { globSync, readFileSync } from 'node:fs'
import process from 'node:process'
import { after, before, test } from 'node:test'
import { parse } from 'yaml'
import { isolateExternalRequests } from './browser-network.mjs'

const baseURL = process.env.SEO_BASE_URL || 'http://127.0.0.1:3236'
let browser
before(async () => {
	const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright').then(m => m.default || m)
	browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE && { executablePath: process.env.BROWSER_EXECUTABLE }) })
})
after(async () => browser?.close())

async function openPage(locale = 'en-US') {
	const context = await browser.newContext({ baseURL, locale, viewport: { width: 390, height: 844 } })
	await isolateExternalRequests(context, baseURL)
	const page = await context.newPage()
	const errors = []
	page.on('pageerror', e => errors.push(e.message))
	page.on('console', (m) => {
		if (/hydration/i.test(m.text()))
			errors.push(m.text())
	})
	return { context, page, errors }
}

async function hydrated(page) {
	await page.waitForFunction(() => document.querySelector('#blog-root')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false)
}

test('all generated article metadata, series links and pagination are present before JavaScript', async () => {
	const { context, page } = await openPage()
	try {
		const articles = globSync('content/*/posts/**/*.md').map((file) => {
			const [, locale, , ...parts] = file.split('/')
			const path = `${locale === 'zh' ? '' : `/${locale}`}/${parts.join('/').replace(/\.md$/, '')}`
			return { path, locale, data: parse(readFileSync(file, 'utf8').split('---')[1]), html: readFileSync(`.output/public${path}/index.html`, 'utf8') }
		})
		const failures = await page.evaluate((articles) => {
			const failures = []
			for (const { path, locale, data, html } of articles) {
				const doc = new DOMParser().parseFromString(html, 'text/html')
				const graph = JSON.parse(doc.querySelector('script[type="application/ld+json"]').textContent)['@graph']
				const post = graph.find(item => item['@type']?.includes('BlogPosting'))
				const check = (condition, label) => {
					if (!condition)
						failures.push(`${path}: ${label}`)
				}
				check(doc.querySelector('meta[name="description"]').content === data.seoDescription, 'meta description')
				check(post?.description === data.seoDescription, 'schema description')
				check(post?.headline === data.title, 'headline')
				check(post?.datePublished && post.mainEntityOfPage === `https://blog.shinya.click${path}`, 'date and URL')
				check(post?.inLanguage === { zh: 'zh-CN', en: 'en-US', ja: 'ja-JP' }[locale], 'language')
				check(post?.author?.['@id'] === 'https://blog.shinya.click/#author', 'stable author')
				check(JSON.stringify(post?.keywords) === JSON.stringify(data.tags), 'keywords')
				doc.querySelectorAll('script,style').forEach(el => el.remove())
				check(!doc.body.textContent.includes(data.seoDescription), 'SEO summary leaked into visible content')
				for (const img of doc.querySelectorAll('article.article img'))
					check(img.loading === 'lazy' && img.decoding === 'async', 'body image loading')
				check(doc.querySelector('.post-cover img')?.loading === 'eager', 'eager cover')
				for (const link of doc.querySelectorAll('.post-series a')) {
					const target = link.getAttribute('href').split('#')[0]
					check(articles.some(article => article.path === target && article.locale === locale), `series target ${target}`)
				}
			}
			return failures
		}, articles)
		assert.equal(articles.length, 135)
		assert.deepEqual(failures, [])
		for (const locale of ['zh', 'en', 'ja']) {
			const pages = Array.from({ length: 5 }, (_, i) => {
				const path = `${locale === 'zh' ? '' : `/${locale}`}${i ? `/page/${i + 1}` : ''}` || '/'
				return { path, html: readFileSync(`.output/public${path}/index.html`, 'utf8') }
			})
			const result = await page.evaluate(pages => pages.map(({ path, html }) => {
				const doc = new DOMParser().parseFromString(html, 'text/html')
				return { path, links: Array.from(doc.querySelectorAll('a.article-card'), el => el.getAttribute('href')), canonical: doc.querySelector('link[rel=canonical]').href, alternates: doc.querySelectorAll('link[hreflang]').length, pagination: doc.querySelectorAll('nav.pagination a').length }
			}), pages)
			assert.equal(new Set(result.flatMap(p => p.links)).size, 45)
			for (const [index, value] of result.entries()) {
				assert.equal(value.links.length, index === 4 ? 5 : 10)
				assert.equal(value.canonical, `https://blog.shinya.click${value.path}`)
				assert.equal(value.alternates, 4)
				assert.ok(value.pagination > 0)
			}
		}
	}
	finally { await context.close() }
})

test('explicit language URLs stay stable in all three browser languages', async () => {
	for (const language of ['zh-CN', 'en-US', 'ja-JP']) {
		const { context, page, errors } = await openPage(language)
		try {
			for (const prefix of ['', '/en', '/ja']) {
				const path = `${prefix}/fiddling/debian-as-bypass-router`
				await page.goto(path, { waitUntil: 'domcontentloaded' })
				await hydrated(page)
				assert.equal(new URL(page.url()).pathname, path)
				assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'), `https://blog.shinya.click${path}`)
				assert.ok((await page.locator('article.article').innerText()).length > 500)
			}
			assert.deepEqual(errors, [])
		}
		finally { await context.close() }
	}
})

test('pagination anchors, language switching, filtering and legacy URLs work after hydration', async () => {
	const { context, page, errors } = await openPage()
	try {
		await page.goto('/en/page/2', { waitUntil: 'domcontentloaded' })
		await hydrated(page)
		const titles = await page.locator('.article-card h2').allTextContents()
		await page.locator('.pagination a').filter({ hasText: /^3$/ }).click()
		await page.waitForURL('**/en/page/3')
		await hydrated(page)
		assert.notDeepEqual(await page.locator('.article-card h2').allTextContents(), titles)
		assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'), 'https://blog.shinya.click/en/page/3')
		await page.setViewportSize({ width: 1440, height: 1000 })
		await page.locator('.language-trigger').click()
		await page.locator('.language-options button[lang="ja"]').click()
		await page.waitForURL('**/ja/page/3')
		await hydrated(page)
		assert.equal(await page.locator('link[hreflang="en-US"]').getAttribute('href'), 'https://blog.shinya.click/en/page/3')
		await page.goto('/en?page=2', { waitUntil: 'domcontentloaded' })
		await page.waitForURL('**/en/page/2')
		await hydrated(page)
		assert.equal(await page.locator('.article-card').count(), 10)
		await page.goto('/en/page/2?category=projects', { waitUntil: 'domcontentloaded' })
		await hydrated(page)
		await page.waitForFunction(() => document.querySelectorAll('.article-card').length === 1)
		assert.ok((await page.locator('.article-card h2').innerText()).includes('MYDB'))
		assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'), 'https://blog.shinya.click/en/page/2')
		assert.deepEqual(errors, [])
	}
	finally { await context.close() }
})

test('mobile image candidates, SEO-only summaries and series navigation remain usable', async () => {
	const { context, page, errors } = await openPage('zh-CN')
	try {
		await page.goto('/fiddling/steamdeck-switch-60fps', { waitUntil: 'domcontentloaded' })
		await hydrated(page)
		const desc = await page.locator('meta[name=description]').getAttribute('content')
		assert.ok(!(await page.locator('body').innerText()).includes(desc))
		assert.ok((await page.locator('.md-excerpt').innerText()).includes('这何尝不是一种 NTR'))
		const cover = page.locator('.post-cover img')
		assert.equal(await cover.getAttribute('loading'), 'eager')
		assert.ok((await cover.getAttribute('srcset')).includes('480w'))
		const images = await page.locator('article.article img').evaluateAll(images => images.map(img => ({ loading: img.loading, decoding: img.decoding })))
		assert.ok(images.every(img => img.loading === 'lazy' && img.decoding === 'async'))
		await page.goto('/projects/mydb/mydb6', { waitUntil: 'domcontentloaded' })
		await hydrated(page)
		assert.equal(await page.locator('.post-series ol a').count(), 11)
		assert.equal(await page.locator('.post-series [aria-current=page]').count(), 1)
		assert.deepEqual(errors, [])
	}
	finally { await context.close() }
})

test('invalid pagination returns 404 and page one normalizes to the home URL', async () => {
	const { context, page } = await openPage()
	try {
		for (const path of ['/page/0', '/page/999', '/en/page/02', '/ja/page/abc']) {
			const response = await page.request.get(path, { timeout: 5000 })
			assert.equal(response.status(), 404)
			assert.ok(!(await response.text()).includes('class="post-list"'))
		}
		const response = await page.request.get('/en/page/1', { maxRedirects: 0, timeout: 5000 })
		assert.equal(response.status(), 301)
		assert.equal(new URL(response.headers().location, baseURL).pathname, '/en')
	}
	finally { await context.close() }
})
