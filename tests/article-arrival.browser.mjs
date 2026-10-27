import assert from 'node:assert/strict'
import process from 'node:process'
import { after, before, test } from 'node:test'
import { isolateExternalRequests } from './browser-network.mjs'

const baseURL = process.env.MOTION_BASE_URL || 'http://127.0.0.1:3000'
let browser
before(async () => {
	const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
	browser = await chromium.launch({ headless: true })
})
after(async () => browser?.close())

for (const width of [375, 1440]) {
	test(`returning to the article list does not wait for a repaint during native capture at ${width}px`, async () => {
		const context = await browser.newContext({ baseURL, viewport: { width, height: 1000 }, locale: 'zh-CN' })
		await isolateExternalRequests(context, baseURL)
		const page = await context.newPage()
		try {
			await page.goto('/')
			await page.waitForFunction(() => document.querySelector('#blog-root')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false)
			await page.locator('.article-card').first().click()
			await page.locator('.article:visible').waitFor()
			await page.waitForFunction(() => !document.documentElement.hasAttribute('data-article-transition'))
			await page.evaluate(() => {
				window.releaseRepaintTimers = []
				window.returnCaptureReady = false
				const timeout = window.setTimeout.bind(window)
				window.setTimeout = (callback, delay, ...args) => {
					// Native capture suspends rAF. Hold the paint-yield fallback too:
					// returning must be able to commit without either paint opportunity.
					if (delay === 100 && document.documentElement.hasAttribute('data-article-transition')) {
						window.releaseRepaintTimers.push(() => callback(...args))
						return timeout(() => {}, 10000)
					}
					return timeout(callback, delay, ...args)
				}
				const start = document.startViewTransition.bind(document)
				document.startViewTransition = (update) => {
					const transition = start(update)
					transition.ready.then(() => window.returnCaptureReady = true).catch(() => {})
					return transition
				}
			})
			await page.goBack()
			await page.waitForFunction(() => window.returnCaptureReady, null, { polling: 25, timeout: 1500 })
			assert.equal(await page.evaluate(() => window.releaseRepaintTimers.length), 0, 'no repaint fallback should be scheduled inside the suspended capture')
			await page.waitForFunction(() => !document.documentElement.hasAttribute('data-article-transition'))
			assert.ok(await page.locator('.article-card').first().isVisible())
		}
		finally {
			await page.evaluate(() => window.releaseRepaintTimers?.forEach(release => release())).catch(() => {})
			await context.close()
		}
	})
}

for (const width of [375, 1440]) {
	test(`a clicked article expands before its content query finishes at ${width}px`, async () => {
		const context = await browser.newContext({ baseURL, viewport: { width, height: 1000 }, locale: 'zh-CN' })
		await isolateExternalRequests(context, baseURL)
		await context.route('**/_payload.json*', route => new URL(route.request().url()).pathname === '/_payload.json' ? route.continue() : route.abort())
		const page = await context.newPage()
		let release
		try {
			await page.goto('/')
			await page.waitForFunction(() => document.querySelector('#blog-root')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false)
			const card = page.locator('.article-card').first()
			const title = (await card.locator('h2').textContent()).trim()
			const target = new URL(await card.getAttribute('href'), baseURL).pathname.replace(/\/$/, '')
			const gate = new Promise(resolve => release = resolve)
			let requested = false
			let queryAfterMotion = false
			const queries = []
			await page.route('**/__nuxt_content/*/query*', async (route) => {
				queries.push(route.request().postData()?.slice(-220))
				if (route.request().postData()?.includes(target)) {
					requested = true
					queryAfterMotion = await page.evaluate(() => !!window.arrivalFinished)
					await gate
				}
				await route.continue()
			})
			await page.evaluate(() => {
				// Exercise Content's supported HTTP fallback so the real query can be held.
				window.arrivalWasm = window.WebAssembly
				window.WebAssembly = undefined
				const nuxt = document.querySelector('#blog-root').__vue_app__.config.globalProperties.$nuxt
				for (const key of Object.keys(nuxt.static.data)) {
					if (key.startsWith('content:'))
						delete nuxt.static.data[key]
				}
				for (const key of Object.keys(nuxt.payload.data)) {
					if (key.startsWith('content:'))
						delete nuxt.payload.data[key]
				}
				const start = document.startViewTransition.bind(document)
				document.startViewTransition = (update) => {
					const transition = start(update)
					transition.finished.then(() => window.arrivalFinished = true)
					transition.ready.then(() => window.arrivalReady = true).catch(() => window.arrivalSkipped = true)
					return transition
				}
			})
			await card.click()
			await page.waitForTimeout(600)
			assert.equal(await page.evaluate(() => window.arrivalReady), true, 'the cover transition must start without waiting for the content query')
			assert.equal((await page.locator('.post-header:visible h1').textContent()).trim(), title)
			assert.equal(await page.locator('.article-arrival-loading').isVisible(), true, JSON.stringify({ requested, queries }))
			await page.waitForFunction(() => !document.documentElement.hasAttribute('data-article-transition'), null, { polling: 25 })
			assert.equal(await page.locator('.article:visible').count(), 0)
			assert.equal(await page.evaluate(() => !!window.arrivalSkipped), false)
			await page.evaluate(() => {
				window.arrivalTicks = 0
				function tick() {
					if (++window.arrivalTicks < 10)
						requestAnimationFrame(tick)
				}
				requestAnimationFrame(tick)
			})
			await page.waitForTimeout(150)
			assert.ok(await page.evaluate(() => window.arrivalTicks) > 2, 'loading the body must leave the page responsive')
			await page.evaluate(() => window.WebAssembly = window.arrivalWasm)
			release()
			await page.locator('.article:visible').waitFor()
			assert.equal(requested, true, 'the scenario must actually hold an article query')
			assert.equal(queryAfterMotion, true, 'cold database work must start after the cover finishes moving')
			assert.equal(await page.locator('.post-header:visible').count(), 1)
			await page.locator('.article-arrival-loading').waitFor({ state: 'detached' })
			assert.doesNotMatch(await page.title(), /404/)
			await page.goBack()
			await page.locator('.article-card').first().waitFor()
			await page.waitForFunction(() => !document.documentElement.hasAttribute('data-article-transition'))
			assert.equal(await page.locator('.article-arrival').count(), 0)
		}
		finally {
			release?.()
			await context.close()
		}
	})
}

test('the displayed cover stays in place until the full cover has decoded', async () => {
	const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' })
	await isolateExternalRequests(context, baseURL)
	await context.route('**/*', route => route.request().resourceType() === 'image'
		? route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="#59736f"/></svg>' })
		: route.fallback())
	const page = await context.newPage()
	try {
		await page.goto('/')
		await page.waitForFunction(() => document.querySelector('#blog-root')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false)
		const card = page.locator('.article-card').first()
		await card.locator('img').evaluate(image => image.decode())
		const displayed = await card.locator('img').evaluate(image => image.currentSrc)
		await page.evaluate(() => {
			const decode = HTMLImageElement.prototype.decode
			HTMLImageElement.prototype.decode = function () {
				if (this.closest('.post-cover'))
					return new Promise(resolve => window.releaseFullCover = resolve)
				return decode.call(this)
			}
		})
		await card.click()
		await page.waitForFunction(() => window.releaseFullCover && !document.documentElement.hasAttribute('data-article-transition'))
		const header = page.locator('.post-header:visible')
		const bounds = await header.boundingBox()
		assert.equal(await header.locator('.post-cover-preview').getAttribute('src'), displayed)
		await page.waitForTimeout(250)
		assert.equal(await header.locator('.post-cover-preview').count(), 1, 'a loaded but undecoded full image must not replace the displayed cover')
		await page.evaluate(() => window.releaseFullCover())
		await header.locator('.post-cover-preview').waitFor({ state: 'detached' })
		assert.deepEqual(await header.boundingBox(), bounds, 'the image upgrade must not move the header')
	}
	finally { await context.close() }
})

test('a featured article returns to the clicked carousel cover', async () => {
	const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' })
	await isolateExternalRequests(context, baseURL)
	const page = await context.newPage()
	try {
		await page.goto('/')
		await page.waitForFunction(() => document.querySelector('#blog-root')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false)
		await page.evaluate(() => {
			window.arrivalTargets = []
			const start = document.startViewTransition.bind(document)
			document.startViewTransition = (update) => {
				const transition = start(update)
				transition.ready.then(() => window.arrivalTargets.push(document.querySelector('[data-article-source]')?.className)).catch(() => {})
				return transition
			}
		})
		await page.locator('.slide-item').first().click()
		await page.locator('.article:visible').waitFor()
		await page.waitForFunction(() => !document.documentElement.hasAttribute('data-article-transition'))
		await page.goBack()
		await page.waitForFunction(() => window.arrivalTargets.length === 2 && !document.documentElement.hasAttribute('data-article-transition'))
		assert.match((await page.evaluate(() => window.arrivalTargets))[1], /slide-item/)
	}
	finally { await context.close() }
})

test('leaving while the body loads discards the arrival and its late response', async () => {
	const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' })
	await isolateExternalRequests(context, baseURL)
	await context.route('**/_payload.json*', route => new URL(route.request().url()).pathname === '/_payload.json' ? route.continue() : route.abort())
	const page = await context.newPage()
	let release
	try {
		await page.goto('/')
		await page.waitForFunction(() => document.querySelector('#blog-root')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false)
		const card = page.locator('.article-card').first()
		const target = new URL(await card.getAttribute('href'), baseURL).pathname.replace(/\/$/, '')
		const gate = new Promise(resolve => release = resolve)
		let requested = false
		await page.route('**/__nuxt_content/*/query*', async (route) => {
			if (route.request().postData()?.includes(target)) {
				requested = true
				await gate
			}
			await route.continue()
		})
		await page.evaluate(() => {
			window.arrivalWasm = window.WebAssembly
			window.WebAssembly = undefined
			const nuxt = document.querySelector('#blog-root').__vue_app__.config.globalProperties.$nuxt
			for (const data of [nuxt.static.data, nuxt.payload.data]) {
				for (const key of Object.keys(data)) {
					if (key.startsWith('content:'))
						delete data[key]
				}
			}
		})
		await card.click()
		await page.locator('.article-arrival-loading').waitFor()
		await page.waitForFunction(() => !document.documentElement.hasAttribute('data-article-transition'))
		await page.waitForTimeout(300)
		assert.equal(requested, true)
		await page.evaluate(() => {
			window.WebAssembly = window.arrivalWasm
			document.querySelector('#blog-root').__vue_app__.config.globalProperties.$nuxt.$router.push('/archive')
		})
		await page.waitForURL('**/archive')
		release()
		await page.waitForFunction(() => !document.documentElement.hasAttribute('data-article-transition'), null, { timeout: 4500 })
		await page.waitForTimeout(200)
		assert.equal(await page.locator('.article-arrival').count(), 0)
		assert.equal(await page.locator('html').getAttribute('data-article-transition'), null)
		assert.match(page.url(), /\/archive$/)
	}
	finally {
		release?.()
		await context.close()
	}
})
