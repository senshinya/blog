import assert from 'node:assert/strict'
import process from 'node:process'
import { after, before, test } from 'node:test'
import { isolateExternalRequests } from './browser-network.mjs'

const baseURL = process.env.MOTION_BASE_URL || 'http://127.0.0.1:3000'
const articlePath = '/fiddling/macos-27-apple-intelligence-chatgpt'
let browser
before(async () => {
	const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
	browser = await chromium.launch({ headless: true })
})
after(async () => browser?.close())

async function article(width, options = {}) {
	const context = await browser.newContext({ baseURL, viewport: { width, height: 900 }, locale: 'zh-CN', ...options })
	await isolateExternalRequests(context, baseURL)
	const page = await context.newPage()
	await page.goto(articlePath)
	await page.locator('.article').waitFor()
	await page.waitForFunction(() => document.querySelector('#blog-root')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false)
	return { context, page }
}

test('desktop directory folds into a curved reading rail and opens for pointer and keyboard', async () => {
	const { context, page } = await article(1440)
	try {
		await page.locator('.reading-navigation').waitFor({ timeout: 3000 })
		await page.locator('.article').hover({ position: { x: 150, y: 150 } })
		await page.evaluate(() => scrollTo({ top: 900, behavior: 'instant' }))
		await page.waitForFunction(() => document.querySelector('.reading-navigation')?.hasAttribute('data-focused') && Number(document.querySelector('.reading-navigation')?.dataset.progress) > 0)
		const rail = page.locator('.reading-rail')
		await page.waitForFunction(() => !!document.querySelector('.rail-track')?.getAttribute('d'))
		assert.ok(await rail.isVisible())
		assert.doesNotMatch(await rail.locator('path').first().getAttribute('d'), /NaN|Infinity/)
		assert.ok(Number(await page.locator('.reading-navigation').getAttribute('data-progress')) > 0)
		await page.locator('.reading-navigation').hover()
		await page.waitForFunction(() => !document.querySelector('.reading-navigation')?.hasAttribute('data-focused'))
		const link = page.locator('.reading-navigation .reading-toc a').nth(2)
		await link.focus()
		await link.press('Enter')
		await page.waitForTimeout(600)
		assert.ok(await page.evaluate(() => Math.abs(document.getElementById(decodeURIComponent(location.hash.slice(1))).getBoundingClientRect().top - 100) < 4))
		assert.equal(await page.locator('.post-progress').count(), 0)
	}
	finally { await context.close() }
})

test('mobile reading line and bottom directory support selection, escape and focus return', async () => {
	const { context, page } = await article(375, { isMobile: true, hasTouch: true })
	try {
		await page.locator('.reading-edge').waitFor({ timeout: 3000 })
		await page.evaluate(() => scrollTo({ top: 1300, behavior: 'instant' }))
		await page.waitForTimeout(100)
		await page.evaluate(() => scrollBy({ top: -160, behavior: 'instant' }))
		const trigger = page.getByRole('button', { name: '显示目录', exact: true })
		await trigger.click()
		const dialog = page.getByRole('dialog', { name: '目录', exact: true })
		await dialog.waitFor()
		await page.keyboard.press('Escape')
		await dialog.waitFor({ state: 'hidden' })
		assert.equal(await trigger.evaluate(el => document.activeElement === el), true)
		await trigger.click()
		const target = dialog.locator('a').nth(2)
		const hash = await target.getAttribute('href')
		await target.click()
		await dialog.waitFor({ state: 'hidden' })
		await page.waitForTimeout(600)
		assert.equal(decodeURIComponent(new URL(page.url()).hash), decodeURIComponent(hash))
		assert.ok(await page.evaluate(() => Math.abs(document.getElementById(decodeURIComponent(location.hash.slice(1))).getBoundingClientRect().top - 100) < 4))
		assert.equal(await page.locator('#blog-panel .toggle-aside').isVisible(), false)
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
	}
	finally { await context.close() }
})

for (const width of [768, 1024, 1025]) {
	test(`reading navigation uses the reference breakpoint at ${width}px`, async () => {
		const { context, page } = await article(width, { reducedMotion: 'reduce' })
		try {
			await page.locator('.reading-edge').waitFor({ state: 'attached', timeout: 3000 })
			assert.equal(await page.locator('.reading-navigation').isVisible(), width > 1024)
			assert.equal(await page.getByRole('button', { name: '显示目录', exact: true }).isVisible(), width <= 1024)
			assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
			if (width <= 1024) {
				await page.getByRole('button', { name: '显示目录', exact: true }).click()
				await page.setViewportSize({ width: 1440, height: 900 })
				await page.getByRole('dialog').waitFor({ state: 'hidden' })
			}
		}
		finally { await context.close() }
	})
}

test('reading controls unmount on navigation and do not trap the article return transition', async () => {
	const { context, page } = await article(375)
	try {
		await page.getByRole('button', { name: '显示目录', exact: true }).click({ timeout: 3000 })
		await page.keyboard.press('Escape')
		await page.getByRole('dialog').waitFor({ state: 'hidden' })
		await page.evaluate(() => document.querySelector('#blog-root').__vue_app__.config.globalProperties.$nuxt.$router.push('/'))
		await page.locator('.article-card').first().waitFor()
		assert.equal(await page.locator('.reading-edge, .reading-menu, .reading-navigation').count(), 0)
		await page.locator('.article-card').first().click()
		await page.locator('.article:visible').waitFor()
		await page.waitForFunction(() => !document.documentElement.hasAttribute('data-article-transition'))
		assert.equal(await page.locator('.reading-edge').count(), 1)
	}
	finally { await context.close() }
})

test('the reading rail stops writing SVG frames while native article capture is paused', async () => {
	const { context, page } = await article(1440)
	try {
		await page.locator('.article').hover({ position: { x: 150, y: 150 } })
		await page.evaluate(() => scrollTo({ top: 900, behavior: 'instant' }))
		await page.waitForFunction(() => document.querySelector('.reading-navigation')?.hasAttribute('data-focused'))
		await page.waitForTimeout(600)
		await page.evaluate(() => document.documentElement.setAttribute('data-article-transition', 'old'))
		await page.waitForTimeout(50)
		await page.evaluate(() => {
			window.railWrites = 0
			window.railObserver = new MutationObserver(records => window.railWrites += records.length)
			window.railObserver.observe(document.querySelector('.rail-svg'), { subtree: true, attributes: true, attributeFilter: ['d', 'cx', 'cy'] })
		})
		await page.waitForTimeout(150)
		assert.equal(await page.evaluate(() => window.railWrites), 0)
		await page.evaluate(() => document.documentElement.removeAttribute('data-article-transition'))
		await page.waitForFunction(() => window.railWrites > 0)
		await page.evaluate(() => window.railObserver.disconnect())
	}
	finally { await context.close() }
})

test('empty and long mobile directories keep the control useful and the sheet scrollable', async () => {
	const { context, page } = await article(375, { isMobile: true, hasTouch: true })
	try {
		await page.goto('/fiddling/this-in-javac-string-concat')
		await page.locator('.reading-edge').waitFor({ state: 'attached' })
		assert.equal(await page.getByRole('button', { name: '显示目录', exact: true }).count(), 0)
		await page.goto('/fiddling/debian-as-bypass-router')
		await page.getByRole('button', { name: '显示目录', exact: true }).click()
		const dialog = page.getByRole('dialog', { name: '目录', exact: true })
		await dialog.waitFor()
		assert.ok(await dialog.locator('a').count() > 10)
		const panel = await page.locator('.reading-menu-popup').boundingBox()
		assert.ok(panel.height <= 830)
		const last = dialog.locator('a').last()
		const hash = await last.getAttribute('href')
		await last.click()
		await dialog.waitFor({ state: 'hidden' })
		await page.waitForTimeout(600)
		assert.equal(decodeURIComponent(new URL(page.url()).hash), decodeURIComponent(hash))
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
	}
	finally { await context.close() }
})

test('the mobile sheet dismisses from the backdrop and from a downward touch swipe', async () => {
	const { context, page } = await article(375, { isMobile: true, hasTouch: true })
	try {
		const trigger = page.getByRole('button', { name: '显示目录', exact: true })
		await trigger.click()
		await page.waitForTimeout(300)
		await page.locator('.reading-menu-shade').click({ position: { x: 30, y: 30 } })
		await page.getByRole('dialog').waitFor({ state: 'hidden' })
		await trigger.click()
		await page.waitForTimeout(300)
		const box = await page.locator('.reading-menu-panel header').boundingBox()
		const session = await context.newCDPSession(page)
		const point = { x: box.x + 70, y: box.y + 15 }
		await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
		await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y + 90 }] })
		await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
		await page.getByRole('dialog').waitFor({ state: 'hidden' })
		assert.equal(await page.evaluate(() => document.querySelector('.reading-menu').getAnimations({ subtree: true }).length), 0, 'finished sheet animations must be released')
	}
	finally { await context.close() }
})

test('returning during a mobile directory rebound releases the interrupted gesture safely', async () => {
	const context = await browser.newContext({ baseURL, viewport: { width: 375, height: 900 }, isMobile: true, hasTouch: true })
	await isolateExternalRequests(context, baseURL)
	const page = await context.newPage()
	const errors = []
	page.on('console', (message) => {
		if (message.type() === 'error' && /TypeError|Unhandled error|reading 'style'/.test(message.text()))
			errors.push(message.text())
	})
	page.on('pageerror', error => errors.push(error.message))
	try {
		await page.goto('/')
		await page.locator(`.article-card[href="${articlePath}"]`).click()
		await page.getByRole('button', { name: '显示目录', exact: true }).click()
		await page.waitForTimeout(600)
		const reboundStarted = await page.evaluate(() => {
			const panel = document.querySelector('.reading-menu-popup')
			const touch = y => new Touch({ identifier: 1, target: panel, clientX: 100, clientY: y })
			panel.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [touch(600)] }))
			panel.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [touch(612)] }))
			panel.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [touch(612)] }))
			const rebounds = document.querySelector('.reading-menu-popup').getAnimations().filter(animation => animation.effect.getTiming().duration === 200)
			// Hold playback so route teardown deterministically cancels the awaited rebound.
			rebounds.forEach(animation => animation.pause())
			history.back()
			return rebounds.length > 0
		})
		assert.equal(reboundStarted, true, 'the return must interrupt a real 200ms rebound')
		await page.locator('.article-card').first().waitFor()
		await page.waitForTimeout(1000)
		assert.deepEqual(errors, [])
		assert.equal(await page.locator('.reading-menu').count(), 0)
	}
	finally { await context.close() }
})

test('entering an article keeps the directory expanded until the body reaches the reading area', async () => {
	const { context, page } = await article(1440)
	try {
		const body = await page.locator('.article').boundingBox()
		await page.mouse.move(body.x + 120, body.y + 50)
		await page.waitForTimeout(500)
		assert.equal(await page.locator('.reading-navigation').getAttribute('data-focused'), null, 'hovering the newly entered article must preserve the full directory')
		await page.evaluate(() => scrollTo({ top: 100, behavior: 'instant' }))
		await page.waitForTimeout(350)
		assert.equal(await page.locator('.reading-navigation').getAttribute('data-focused'), null, 'a small initial scroll must preserve the directory')
		await page.evaluate(top => scrollTo({ top: top - 99, behavior: 'instant' }), body.y)
		await page.waitForFunction(() => document.querySelector('.reading-navigation')?.hasAttribute('data-focused'))
		await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }))
		await page.waitForFunction(() => !document.querySelector('.reading-navigation')?.hasAttribute('data-focused'))
	}
	finally { await context.close() }
})

for (const width of [375, 1440]) {
	test(`reading accents follow the project primary color in both themes at ${width}px`, async () => {
		const { context, page } = await article(width, { reducedMotion: 'reduce' })
		try {
			await page.locator('.reading-edge').waitFor({ state: 'attached' })
			for (const theme of ['light', 'dark']) {
				const colors = await page.evaluate((theme) => {
					document.documentElement.classList.remove('light', 'dark')
					document.documentElement.classList.add(theme)
					const probe = document.createElement('span')
					probe.style.color = 'var(--c-primary)'
					document.body.append(probe)
					const primary = getComputedStyle(probe).color
					const edge = getComputedStyle(document.querySelector('.reading-edge > div')).backgroundColor
					const selected = document.querySelector('.reading-navigation a[aria-current]')
					const active = selected ? getComputedStyle(selected).color : primary
					probe.remove()
					return { edge, active, primary }
				}, theme)
				assert.equal(colors.edge, colors.primary, `${theme} edge progress must render the project primary color`)
				assert.equal(colors.active, colors.primary, `${theme} selected chapter must render the project primary color`)
			}
		}
		finally { await context.close() }
	})
}
