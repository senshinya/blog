import assert from 'node:assert/strict'
import process from 'node:process'
import { after, before, test } from 'node:test'
import { isolateExternalRequests } from './browser-network.mjs'

const baseURL = process.env.SEO_BASE_URL || 'http://127.0.0.1:3236'
let browser
before(async () => {
	const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright').then(m => m.default || m)
	browser = await chromium.launch({ headless: true })
})
after(async () => browser?.close())

async function open(options = {}) {
	const context = await browser.newContext({ baseURL, locale: 'zh-CN', viewport: { width: 375, height: 900 }, ...options })
	await isolateExternalRequests(context, baseURL)
	const page = await context.newPage()
	await page.goto('/projects/mydb/mydb6', { waitUntil: 'domcontentloaded' })
	if (options.javaScriptEnabled !== false)
		await page.waitForFunction(() => document.querySelector('#blog-root')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false)
	return { page, context }
}

test('compact series keeps all links in HTML and supports native disclosure without JavaScript', async () => {
	const { context, page } = await open({ javaScriptEnabled: false })
	try {
		assert.equal(await page.locator('.post-series summary').count(), 1)
		assert.equal(await page.locator('.post-series ol a').count(), 11)
		assert.equal(await page.locator('.series-overview').count(), 0)
		assert.equal(await page.locator('.surround-post').count(), 0, 'Series supplies the single previous/next navigation')
		assert.equal(await page.locator('.post-series details').getAttribute('open'), null)
		await page.locator('.post-series summary').click()
		assert.ok(await page.locator('.post-series ol a').first().isVisible())
	}
	finally { await context.close() }
})

test('opening and closing animate continuously, including reversing mid-animation', async () => {
	for (const width of [375, 1440]) {
		const { context, page } = await open({ viewport: { width, height: 1000 } })
		try {
			assert.equal(await page.locator('.post-series summary').count(), 1)
			await page.locator('.post-series').scrollIntoViewIfNeeded()
			const result = await page.locator('.post-series details').evaluate(async (details) => {
				const summary = details.querySelector('summary')
				const initial = details.getBoundingClientRect().height
				summary.click()
				const opening = details.getAnimations()[0]
				if (!opening)
					return { animated: false }
				opening.pause()
				opening.currentTime = 120
				await new Promise(requestAnimationFrame)
				const midway = details.getBoundingClientRect().height
				summary.click()
				const reversed = details.getBoundingClientRect().height
				// The finish event runs the cleanup after the finished promise resolves.
				await Promise.all(details.getAnimations().map(animation => new Promise(resolve => animation.addEventListener('finish', resolve, { once: true }))))
				return { animated: true, initial, midway, reversed, closed: !details.open, final: details.getBoundingClientRect().height }
			})
			assert.equal(result.animated, true)
			assert.ok(result.midway > result.initial + 5)
			assert.ok(Math.abs(result.midway - result.reversed) < 2, 'Reversal must start at the current height')
			assert.equal(result.closed, true)
			assert.ok(Math.abs(result.final - result.initial) < 2)
			await page.locator('.post-series summary').focus()
			await page.keyboard.press('Enter')
			await page.waitForFunction(() => document.querySelector('.post-series summary')?.getAttribute('aria-expanded') === 'true')
			assert.ok(await page.locator('.post-series ol a').first().isVisible())
			assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
		}
		finally { await context.close() }
	}
})

test('reduced motion toggles immediately and direct series anchors open the directory', async () => {
	const { context, page } = await open({ reducedMotion: 'reduce' })
	try {
		assert.equal(await page.locator('.post-series summary').count(), 1)
		await page.locator('.post-series summary').click()
		assert.equal(await page.locator('.post-series summary').getAttribute('aria-expanded'), 'true')
		assert.equal(await page.locator('.post-series details').evaluate(el => el.getAnimations().length), 0)
		await page.locator('.post-series summary').click()
		assert.equal(await page.locator('.post-series details').getAttribute('open'), null)
		await page.goto('/en/projects/mydb/mydb0#series-mydb', { waitUntil: 'domcontentloaded' })
		await page.waitForFunction(() => document.querySelector('.post-series summary')?.getAttribute('aria-expanded') === 'true')
		assert.ok(await page.locator('.post-series ol a').first().isVisible())
	}
	finally { await context.close() }
})

for (const width of [375, 1440]) {
	test(`locale replacement preserves the expanded directory and its reading position at ${width}px`, async () => {
		const { context, page } = await open({ viewport: { width, height: 1000 } })
		try {
			await page.locator('.post-series summary').click()
			await page.waitForFunction(() => !document.querySelector('.post-series details').getAnimations().length)
			await page.locator('.series-chapters li').nth(3).evaluate(el => window.scrollBy({ top: el.getBoundingClientRect().top - 70, behavior: 'instant' }))
			const before = await page.locator('.series-chapters li').nth(3).boundingBox()
			await page.evaluate(() => {
				window.seriesSnapshots = []
				const original = document.startViewTransition.bind(document)
				document.startViewTransition = (update) => {
					const transition = original(update)
					transition.ready.then(() => {
						window.seriesSnapshots.push(...[...document.querySelectorAll('.post-series a')].filter(el => el.style.viewTransitionName).map(el => ({ text: el.textContent, kind: el.style.getPropertyValue('view-transition-class') })))
					}).catch(() => {})
					return transition
				}
			})
			for (const language of ['en', 'ja', 'zh']) {
				if (width === 375)
					await page.locator('.toggle-sidebar').click()
				await page.locator('.language-trigger').click()
				// Use a physical click: locator.click() can scroll the sticky sidebar itself.
				await page.locator('.reading-preferences').evaluate(async el => Promise.allSettled(el.getAnimations({ subtree: true }).map(animation => animation.finished)))
				const option = await page.locator(`.language-options button[lang="${language}"]`).boundingBox()
				await page.mouse.click(option.x + option.width / 2, option.y + option.height / 2)
				await page.waitForURL(new URL(`${language === 'zh' ? '' : `/${language}`}/projects/mydb/mydb6`, baseURL).href)
				await page.waitForFunction(() => !document.documentElement.classList.contains('locale-motion'))
				assert.equal(await page.locator('.post-series details').getAttribute('open'), '', 'Changing language must keep the directory open')
				assert.equal(await page.locator('.post-series summary').getAttribute('aria-expanded'), 'true')
				assert.equal(await page.locator('.series-chapters a').count(), 11)
				assert.equal(await page.locator('.series-chapters a').first().getAttribute('href'), `${language === 'zh' ? '' : `/${language}`}/projects/mydb/mydb0`)
				const after = await page.locator('.series-chapters li').nth(3).boundingBox()
				assert.ok(Math.abs(after.y - before.y) < 3, `Reading position must stay fixed (${language}): ${before.y} -> ${after.y}`)
			}
			assert.ok(await page.evaluate(() => window.seriesSnapshots.some(snapshot => snapshot.kind.includes('locale-body'))), 'Series chapters must participate in the global text replacement animation')
			await page.locator('.post-series summary').click()
			await page.waitForFunction(() => !document.querySelector('.post-series details').open)
			if (width === 375)
				await page.locator('.toggle-sidebar').click()
			await page.locator('.language-trigger').click()
			await page.locator('.language-options button[lang="en"]').click()
			await page.waitForURL('**/en/projects/mydb/mydb6')
			await page.waitForFunction(() => !document.documentElement.classList.contains('locale-motion'))
			assert.equal(await page.locator('.post-series details').getAttribute('open'), null, 'A closed directory must also stay closed')
		}
		finally { await context.close() }
	})
}

for (const mode of ['fallback', 'reduce']) {
	test(`locale replacement retains disclosure state with ${mode} motion`, async () => {
		const { context, page } = await open({ viewport: { width: 1440, height: 1000 }, reducedMotion: mode === 'reduce' ? 'reduce' : 'no-preference' })
		try {
			await page.goto('/projects/mydb/mydb6#series-mydb', { waitUntil: 'domcontentloaded' })
			await page.waitForFunction(() => document.querySelector('.post-series summary')?.getAttribute('aria-expanded') === 'true' && !document.querySelector('.post-series details').getAnimations().length)
			await page.locator('.post-series').evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'start' }))
			await page.evaluate(() => {
				window.seriesFades = 0
				document.startViewTransition = undefined
				const original = Element.prototype.animate
				Element.prototype.animate = function (...args) {
					if (this.closest('.post-series') && args[0][0].opacity === 0)
						window.seriesFades++
					return original.apply(this, args)
				}
			})
			await page.locator('.language-trigger').click()
			await page.locator('.language-options button[lang="en"]').click()
			await page.waitForURL('**/en/projects/mydb/mydb6#series-mydb')
			await page.waitForFunction(() => document.querySelector('.series-title')?.textContent.includes('Building'))
			assert.equal(await page.locator('.post-series summary').getAttribute('aria-expanded'), 'true')
			assert.equal(await page.locator('.post-series details').getAttribute('open'), '')
			if (mode === 'fallback')
				await page.waitForFunction(() => window.seriesFades > 0)
			else
				assert.equal(await page.evaluate(() => window.seriesFades), 0)
			await page.locator('.post-series summary').click()
			await page.waitForFunction(() => !document.querySelector('.post-series details').open)
			await page.locator('.language-trigger').click()
			await page.locator('.language-options button[lang="ja"]').click()
			await page.waitForURL('**/ja/projects/mydb/mydb6#series-mydb')
			await page.waitForFunction(() => document.querySelector('.series-label')?.textContent === 'シリーズ')
			assert.equal(await page.locator('.post-series details').getAttribute('open'), null, 'Preserved state must take precedence over the existing overview hash')
		}
		finally { await context.close() }
	})
}
