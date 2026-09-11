import assert from 'node:assert/strict'
import process from 'node:process'
import { after, before, test } from 'node:test'
import { isolateExternalRequests } from './browser-network.mjs'

const baseURL = process.env.SEO_BASE_URL || 'http://127.0.0.1:3000'
let browser
before(async () => {
	const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright').then(m => m.default || m)
	browser = await chromium.launch({ headless: true })
})
after(async () => browser?.close())

test('removed landing pages return 404 and the homepage has no added intro or navigation', async () => {
	const context = await browser.newContext({ baseURL, javaScriptEnabled: false })
	await isolateExternalRequests(context, baseURL)
	const page = await context.newPage()
	try {
		for (const prefix of ['', '/en', '/ja']) {
			for (const path of ['/about', '/topics', '/topics/mydb'])
				assert.equal((await page.request.get(`${prefix}${path}`)).status(), 404)
			await page.goto(prefix || '/')
			assert.equal(await page.locator('.home-intro').count(), 0)
			assert.equal(await page.locator('a[href*="/about"], a[href*="/topics"]').count(), 0)
		}
	}
	finally { await context.close() }
})

test('SEO titles enrich metadata without replacing visible article titles', async () => {
	const context = await browser.newContext({ baseURL, javaScriptEnabled: false })
	await isolateExternalRequests(context, baseURL)
	const page = await context.newPage()
	try {
		await page.goto('/fiddling/go-os')
		assert.match(await page.title(), /Go.*RISC-V/)
		assert.match(await page.locator('h1').textContent(), /春节七天乐/)
		assert.equal(await page.locator('.post-author').getAttribute('href'), 'https://shinya.click/')
		await page.goto('/')
		assert.match(await page.title(), /Java.*Go/)
	}
	finally { await context.close() }
})

test('entertainment is noindex and public preview routes return 404', async () => {
	const context = await browser.newContext({ baseURL, javaScriptEnabled: false })
	await isolateExternalRequests(context, baseURL)
	const page = await context.newPage()
	try {
		for (const prefix of ['', '/en', '/ja']) {
			const response = await page.goto(`${prefix}/media`)
			const robots = `${response.headers()['x-robots-tag'] || ''} ${await page.locator('meta[name="robots"]').getAttribute('content')}`
			assert.match(robots, /noindex/)
			assert.equal((await page.goto(`${prefix}/preview`)).status(), 404)
			assert.equal((await page.goto(`${prefix}/previews/private-draft`)).status(), 404)
		}
	}
	finally { await context.close() }
})
