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

test('reading rail retains the reference bulge, scroll pulse and settling range', async () => {
	const { context, page } = await article(1440)
	try {
		await page.locator('.article').hover({ position: { x: 150, y: 150 } })
		await page.evaluate(() => scrollTo({ top: 900, behavior: 'instant' }))
		await page.waitForFunction(() => document.querySelector('.reading-navigation')?.hasAttribute('data-focused'))
		await page.waitForTimeout(1600)
		const baseline = await page.locator('.rail-track').evaluate(el => el.getBBox().width)
		assert.ok(baseline >= 9.7 && baseline <= 11.1, `reference breathing range is 10.4 ± 0.6px: ${baseline}`)
		const samples = await page.evaluate(async () => {
			const path = document.querySelector('.rail-track')
			const samples = []
			const started = performance.now()
			const initialScroll = scrollY
			await new Promise((resolve) => {
				function frame() {
					const elapsed = performance.now() - started
					scrollTo({ top: initialScroll + Math.min(elapsed, 260) * 1.5, behavior: 'instant' })
					samples.push(path.getBBox().width)
					if (performance.now() - started < 1400)
						requestAnimationFrame(frame)
					else resolve()
				}
				requestAnimationFrame(frame)
			})
			return samples
		})
		const peak = Math.max(...samples)
		assert.ok(peak >= 20 && peak <= 26.5, `fast scrolling retains the reference spring amplitude: ${peak}`)
		assert.ok(samples.at(-1) >= 9.7 && samples.at(-1) <= 11.3, `the pulse settles back into the breathing range: ${samples.at(-1)}`)
	}
	finally { await context.close() }
})

for (const width of [1025, 1440]) {
	test(`directory highlight continuously becomes the reading axis at ${width}px`, async () => {
		const { context, page } = await article(width)
		try {
			await page.mouse.move(5, 5)
			await page.evaluate(() => scrollTo({ top: 900, behavior: 'instant' }))
			await page.waitForTimeout(900)
			const measure = () => page.evaluate(() => {
				const path = document.querySelector('.rail-track')
				const rect = path.getBoundingClientRect()
				const links = [...document.querySelectorAll('.reading-navigation a.is-visible')]
				const toc = document.querySelector('.reading-navigation .reading-toc').getBoundingClientRect()
				return { x: rect.x, y: rect.y, height: rect.height, opacity: Number(getComputedStyle(path).opacity), tocRight: toc.right, markerX: toc.x + 8, markerY: links[0]?.getBoundingClientRect().y, markerHeight: links.at(-1)?.getBoundingClientRect().bottom - links[0]?.getBoundingClientRect().y }
			})
			const expanded = await measure()
			assert.ok(expanded.opacity > 0.5 && expanded.height > 0, 'the axis itself must render the expanded highlight')
			assert.ok(expanded.tocRight <= width - 12, 'the outward directory stays inside the viewport')
			assert.ok(Math.abs(expanded.x - expanded.markerX) < 1, 'the line starts at the directory highlight')
			assert.ok(Math.abs(expanded.y - expanded.markerY) < 2 && Math.abs(expanded.height - expanded.markerHeight) < 2, 'the line covers the visible headings')
			async function capture(action) {
				await page.evaluate(() => {
					const path = document.querySelector('.rail-track')
					const start = performance.now()
					window.axisFrames = new Promise((resolve) => {
						const frames = []
						function frame() {
							const rect = path.getBoundingClientRect()
							frames.push({ x: rect.x, y: rect.y, height: rect.height, opacity: Number(getComputedStyle(path).opacity), same: document.querySelector('.rail-track') === path })
							if (performance.now() - start < 950)
								requestAnimationFrame(frame)
							else resolve(frames)
						}
						requestAnimationFrame(frame)
					})
				})
				await action()
				return page.evaluate(() => window.axisFrames)
			}
			const bodyX = (await page.locator('.article').boundingBox()).x + 150
			const folded = await capture(() => page.mouse.move(bodyX, 450))
			assert.equal(await page.locator('.reading-navigation').getAttribute('data-focused'), 'true')
			const compact = folded.at(-1)
			const axisTravel = width < 1360 ? -8 : -16
			assert.ok(Math.abs(compact.x - expanded.x - axisTravel) < 1, 'the right line folds left toward the article')
			assert.ok(compact.height > expanded.height + 50, 'the highlight stretches into the full axis')
			assert.ok(folded.some(frame => (frame.x - expanded.x) / axisTravel > 0.1 && (frame.x - expanded.x) / axisTravel < 0.9 && frame.height > expanded.height + 5 && frame.height < compact.height - 5), 'the line moves and stretches through intermediate frames')
			const unfolded = await capture(() => page.locator('.reading-navigation').hover())
			assert.ok(Math.abs(unfolded.at(-1).x - expanded.x) < 1 && Math.abs(unfolded.at(-1).height - expanded.height) < 2, 'expansion returns the same line to the visible headings')
			assert.ok(unfolded.some(frame => (frame.x - expanded.x) / axisTravel > 0.1 && (frame.x - expanded.x) / axisTravel < 0.9), 'the return is animated too')
			assert.ok([...folded, ...unfolded].every(frame => frame.same && frame.opacity > 0.1 && frame.height > 0), 'the shared line never disappears or gets replaced during either transition')
			const reversed = await capture(async () => {
				await page.mouse.move(bodyX, 450)
				await page.waitForTimeout(150)
				await page.locator('.reading-navigation').hover()
			})
			assert.ok(reversed.some(frame => frame.x < expanded.x - 1), 'an interrupted fold starts moving the line')
			assert.ok(Math.abs(reversed.at(-1).x - expanded.x) < 1, 'reversing partway returns to the highlight')
			assert.ok(reversed.every((frame, i) => frame.same && frame.opacity > 0.1 && (!i || Math.abs(frame.x - reversed[i - 1].x) < 32)), 'reversing preserves position and visibility')
		}
		finally { await context.close() }
	})
}

test('directory axis switches without motion when reduced motion is requested', async () => {
	const { context, page } = await article(1440, { reducedMotion: 'reduce' })
	try {
		await page.locator('.article').hover({ position: { x: 150, y: 150 } })
		await page.evaluate(() => scrollTo({ top: 900, behavior: 'instant' }))
		await page.waitForFunction(() => document.querySelector('.reading-navigation')?.hasAttribute('data-focused'))
		const bounds = () => page.locator('.rail-track').evaluate((el) => {
			const start = el.getPointAtLength(0).matrixTransform(el.getScreenCTM())
			return { x: start.x, height: el.getBoundingClientRect().height }
		})
		const compact = await bounds()
		assert.equal(await page.locator('#blog-sidebar .sidebar-nav-item[href]').first().evaluate(el => el.getAnimations().length), 0, 'compact hit areas settle immediately with reduced motion')
		assert.equal(await page.locator('#blog-sidebar .sidebar-header').evaluate(el => el.getAnimations().length), 0, 'avatar settles immediately with reduced motion')
		await page.locator('.reading-navigation').hover()
		await page.waitForFunction(() => !document.querySelector('.reading-navigation')?.hasAttribute('data-focused'))
		const expanded = await bounds()
		assert.ok(Math.abs(compact.x - expanded.x + 16) < 1, JSON.stringify({ compact, expanded }))
		assert.ok(expanded.height > 0 && compact.height > expanded.height)
		assert.equal(await page.locator('.rail-shape').evaluate(el => el.getAnimations().length), 0)
	}
	finally { await context.close() }
})

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

for (const width of [1440, 1920]) {
	test(`article stays centered while both reading sides settle and navigation expands at ${width}px`, async () => {
		const { context, page } = await article(width, { reducedMotion: 'reduce' })
		try {
			const body = page.locator('.article')
			const original = await body.boundingBox()
			assert.ok(Math.abs(original.x + original.width / 2 - width / 2) < 1, 'article must share the viewport center')
			assert.ok(original.width >= 720 && original.width <= 760, 'desktop reading measure stays comfortable')
			await body.hover({ position: { x: 150, y: 150 } })
			await page.evaluate(() => scrollTo({ top: 900, behavior: 'instant' }))
			await page.waitForFunction(() => document.querySelector('.reading-navigation')?.hasAttribute('data-focused'))
			const label = page.locator('#blog-sidebar .sidebar-nav-item .nav-text').last()
			await page.waitForFunction(() => getComputedStyle(document.querySelector('#blog-sidebar .sidebar-nav-item .nav-text')).opacity === '0')
			const settled = await body.boundingBox()
			assert.equal(settled.x, original.x)
			assert.equal(settled.width, original.width)
			const nav = page.locator('#blog-sidebar .sidebar-nav-item[href]').first()
			assert.ok(await nav.getAttribute('aria-label'), 'compact links keep their accessible names')
			await nav.focus()
			assert.equal(await label.evaluate(el => getComputedStyle(el).opacity), '1')
			const expanded = await body.boundingBox()
			assert.equal(expanded.x, original.x)
			assert.equal(expanded.width, original.width)
			await page.locator('.reading-navigation').hover()
			const directory = await body.boundingBox()
			assert.equal(directory.x, original.x)
			assert.equal(directory.width, original.width)
		}
		finally { await context.close() }
	})
}

for (const width of [1025, 1440]) {
	test(`sidebar footer hides without a compact button and restores all settings when expanded at ${width}px`, async () => {
		const { context, page } = await article(width, { reducedMotion: 'reduce' })
		try {
			await page.locator('.article').hover({ position: { x: 150, y: 150 } })
			const before = await page.locator('.sidebar-footer').boundingBox()
			await page.evaluate(() => scrollTo({ top: 900, behavior: 'instant' }))
			await page.waitForFunction(() => document.querySelector('.reading-navigation')?.hasAttribute('data-focused'))
			assert.equal(await page.locator('.reading-settings-trigger').count(), 0, 'compact mode has no settings button')
			assert.equal(await page.locator('#blog-sidebar .reading-preferences').isVisible(), false)
			assert.equal(await page.locator('#blog-sidebar .sidebar-social a').first().isVisible(), false)
			assert.equal((await page.locator('.sidebar-footer').boundingBox()).height, before.height)
			await page.locator('.reading-navigation').hover()
			await page.waitForFunction(() => !document.querySelector('.reading-navigation')?.hasAttribute('data-focused'))
			assert.equal(await page.locator('#blog-sidebar .reading-preferences').isVisible(), true)
			assert.equal(await page.locator('#blog-sidebar .language-trigger').isVisible(), true)
			for (const theme of ['light', 'system', 'dark'])
				assert.equal(await page.locator(`#blog-sidebar button[data-theme="${theme}"]`).isVisible(), true)
			assert.equal(await page.locator('#blog-sidebar .sidebar-social a').first().isVisible(), true)
			await page.locator('#blog-sidebar button[data-theme="dark"]').click()
			await page.waitForFunction(() => document.documentElement.classList.contains('dark'))
			await page.locator('#blog-sidebar .language-trigger').click()
			assert.equal(await page.locator('#blog-sidebar .language-options button').count(), 3)
			await page.keyboard.press('Escape')
			assert.equal(await page.locator('#blog-sidebar .language-trigger').evaluate(el => document.activeElement === el), true)
			assert.equal((await page.locator('.sidebar-footer').boundingBox()).height, before.height)
		}
		finally { await context.close() }
	})
}

for (const width of [900, 1025]) {
	test(`tablet article reserves a light navigation rail without horizontal overflow at ${width}px`, async () => {
		const { context, page } = await article(width, { reducedMotion: 'reduce' })
		try {
			assert.ok((await page.locator('#blog-sidebar').boundingBox()).width <= 80)
			assert.equal(await page.locator('#blog-sidebar .nav-text').first().evaluate(el => getComputedStyle(el).opacity), '0')
			assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
			const original = await page.locator('.article').boundingBox()
			assert.ok(Math.abs(original.x + original.width / 2 - width / 2) < 1, 'tablet article stays on the viewport center')
			const link = page.locator('#blog-sidebar .sidebar-nav-item[href]').first()
			await link.focus()
			assert.equal(await page.locator('#blog-sidebar .nav-text').first().evaluate(el => getComputedStyle(el).opacity), '1')
			assert.equal((await page.locator('.article').boundingBox()).x, original.x)
		}
		finally { await context.close() }
	})
}

for (const width of [1280, 1359]) {
	test(`medium desktop keeps the article centered and bounded at ${width}px`, async () => {
		const { context, page } = await article(width, { reducedMotion: 'reduce' })
		try {
			const bounds = await page.locator('.article').boundingBox()
			assert.ok(bounds.width <= 760, 'article must not grow past its reading measure')
			assert.ok(Math.abs(bounds.x + bounds.width / 2 - width / 2) < 1)
		}
		finally { await context.close() }
	})
}

test('starting reading preserves focus already inside the preferences', async () => {
	const { context, page } = await article(1440, { reducedMotion: 'reduce' })
	try {
		const theme = page.locator('#blog-sidebar button[data-theme="dark"]')
		await theme.focus()
		await page.evaluate(() => scrollTo({ top: 900, behavior: 'instant' }))
		await page.waitForFunction(() => document.querySelector('.reading-navigation')?.hasAttribute('data-reading'))
		assert.equal(await theme.isVisible(), true)
		assert.equal(await theme.evaluate(el => document.activeElement === el), true)
	}
	finally { await context.close() }
})

test('article sidebar keeps the home typography and navigation rhythm', async () => {
	const { context, page } = await article(1440, { reducedMotion: 'reduce' })
	try {
		const styles = () => page.evaluate(() => Object.fromEntries(['.header-title', '.sidebar-header', '.sidebar-nav-item[href]'].map((selector) => {
			const el = document.querySelector(selector)
			const css = getComputedStyle(el)
			return [selector, { font: css.fontSize, padding: css.padding, height: el.getBoundingClientRect().height }]
		})))
		const entry = await styles()
		await page.goto('/')
		await page.waitForFunction(() => document.querySelector('#blog-root')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false)
		assert.deepEqual(entry, await styles(), 'article sidebar uses the same title, avatar and navigation sizing as home')
	}
	finally { await context.close() }
})

test('reading keeps the footer anchored between frames', async () => {
	const { context, page } = await article(1440)
	try {
		await page.waitForTimeout(300)
		await page.locator('.article').hover({ position: { x: 150, y: 150 } })
		const samples = await page.evaluate(async () => {
			const selectors = ['#blog-sidebar .sidebar-footer']
			const samples = []
			const measure = () => selectors.map((selector) => {
				const rect = document.querySelector(selector).getBoundingClientRect()
				return { x: rect.x, y: rect.y, height: rect.height }
			})
			samples.push(measure())
			scrollTo({ top: 900, behavior: 'instant' })
			const start = performance.now()
			await new Promise((resolve) => {
				function frame() {
					samples.push(measure())
					if (performance.now() - start < 450)
						requestAnimationFrame(frame)
					else resolve()
				}
				requestAnimationFrame(frame)
			})
			return samples
		})
		assert.equal(await page.locator('.reading-navigation').getAttribute('data-reading'), 'true')
		for (const frame of samples) {
			for (let i = 0; i < frame.length; i++) {
				assert.ok(Math.abs(frame[i].x - samples[0][i].x) < 0.5, `item ${i} must stay horizontally anchored`)
				assert.ok(Math.abs(frame[i].y - samples[0][i].y) < 0.5, `item ${i} must keep its vertical position`)
				assert.ok(Math.abs(frame[i].height - samples[0][i].height) < 0.5, `item ${i} must retain its height`)
			}
		}
	}
	finally { await context.close() }
})

for (const width of [1025, 1440]) {
	test(`compact avatar and navigation move together with the reading axis at ${width}px`, async () => {
		const { context, page } = await article(width)
		try {
			await page.mouse.move(5, 5)
			await page.evaluate(() => scrollTo({ top: 900, behavior: 'instant' }))
			await page.waitForTimeout(900)
			const measure = () => page.evaluate(() => {
				const icon = document.querySelector('#blog-sidebar .sidebar-nav-item[href] .iconify').getBoundingClientRect()
				const path = document.querySelector('.rail-track')
				const axis = path.getPointAtLength(0).matrixTransform(path.getScreenCTM())
				const avatar = document.querySelector('#blog-sidebar .blog-logo').getBoundingClientRect()
				return { iconX: icon.x, axisX: axis.x, avatarX: avatar.x, avatarY: avatar.y, avatarWidth: avatar.width, avatarHeight: avatar.height }
			})
			const expanded = await measure()
			const body = await page.locator('.article').boundingBox()
			async function capture(action) {
				await page.evaluate(() => {
					const start = performance.now()
					window.inwardFrames = new Promise((resolve) => {
						const frames = []
						function frame() {
							const icon = document.querySelector('#blog-sidebar .sidebar-nav-item[href] .iconify').getBoundingClientRect()
							const path = document.querySelector('.rail-track')
							const avatar = document.querySelector('#blog-sidebar .blog-logo').getBoundingClientRect()
							frames.push({ iconX: icon.x, axisX: path.getPointAtLength(0).matrixTransform(path.getScreenCTM()).x, avatarX: avatar.x, avatarY: avatar.y, avatarWidth: avatar.width, avatarHeight: avatar.height, iconOpacity: Number(getComputedStyle(document.querySelector('#blog-sidebar .sidebar-nav-item[href] .iconify')).opacity), avatarOpacity: Number(getComputedStyle(document.querySelector('#blog-sidebar .blog-logo')).opacity), backgroundOpacity: Number(getComputedStyle(document.querySelector('#blog-sidebar .emoji-tail')).opacity) })
							if (performance.now() - start < 800)
								requestAnimationFrame(frame)
							else resolve(frames)
						}
						requestAnimationFrame(frame)
					})
				})
				await action()
				return page.evaluate(() => window.inwardFrames)
			}
			const folded = await capture(() => page.mouse.move(body.x + 150, 450))
			const compact = folded.at(-1)
			const travel = compact.iconX - expanded.iconX
			assert.ok(compact.iconOpacity >= 0.4 && compact.iconOpacity <= 0.5, 'compact controls soften to the rail label emphasis')
			assert.ok(folded.some(frame => frame.iconOpacity > 0.55 && frame.iconOpacity < 0.95), 'icons dim progressively during collapse')
			assert.ok(travel > 80 && travel < 190, 'the compact icon group moves right toward the article')
			assert.ok(compact.axisX < expanded.axisX - 5, 'the right axis moves left, opposing the left navigation')
			assert.ok(folded.some(frame => frame.iconX > expanded.iconX + 10 && frame.iconX < compact.iconX - 10), 'icons move through intermediate positions')
			const unfolded = await capture(() => page.locator('.reading-navigation').hover())
			assert.ok(Math.abs(unfolded.at(-1).iconX - expanded.iconX) < 0.5, 'expanded navigation returns to its existing position')
			assert.equal(unfolded.at(-1).iconOpacity, 1, 'expanded icons restore their full emphasis')
			assert.ok(unfolded.every(frame => Math.abs(frame.iconX - expanded.iconX) <= 0.5 || frame.backgroundOpacity < 0.01), 'the decorative background stays hidden while the avatar returns')
			assert.ok(unfolded.some(frame => Math.abs(frame.iconX - expanded.iconX) <= 0.5 && frame.backgroundOpacity > 0.01 && frame.backgroundOpacity < 0.18), 'the background fades in only after the avatar settles')
			assert.ok(folded.every(frame => frame.iconX - expanded.iconX < 0.5 || frame.backgroundOpacity < 0.01), 'the background hides before compact movement')
			for (const frame of [...folded, ...unfolded]) {
				const left = (frame.iconX - expanded.iconX) / travel
				const right = (frame.axisX - expanded.axisX) / (width < 1360 ? -8 : -16)
				assert.ok(Math.abs(left - right) < 0.15, `both sides move with the same timing: ${left}, ${right}`)
				assert.ok(Math.abs(frame.avatarX - expanded.avatarX - (frame.iconX - expanded.iconX)) < 0.5, 'avatar and navigation translate together in every frame')
				assert.ok(Math.abs(frame.avatarY - expanded.avatarY) < 0.5, 'avatar keeps its vertical position')
				assert.ok(Math.abs(frame.avatarWidth - expanded.avatarWidth) < 0.5 && Math.abs(frame.avatarHeight - expanded.avatarHeight) < 0.5, 'avatar retains its size throughout the transition')
				assert.ok(Math.abs(frame.avatarOpacity - frame.iconOpacity) < 0.02, 'avatar and navigation dim together')
			}
			assert.deepEqual(await page.locator('.article').boundingBox(), body, 'the reading column stays fixed')
		}
		finally { await context.close() }
	})
}

for (const width of [1025, 1280, 1359, 1440, 1920]) {
	test(`settled reading controls keep balanced space beside the article at ${width}px`, async () => {
		const { context, page } = await article(width, { reducedMotion: 'reduce' })
		try {
			await page.locator('.article').hover({ position: { x: 150, y: 150 } })
			await page.evaluate(() => scrollTo({ top: 900, behavior: 'instant' }))
			await page.waitForFunction(() => document.querySelector('.reading-navigation')?.hasAttribute('data-focused'))
			const body = await page.locator('.article').boundingBox()
			const icon = await page.locator('#blog-sidebar .sidebar-nav-item[href] .iconify').first().boundingBox()
			const railX = await page.locator('.rail-track').evaluate(el => el.getPointAtLength(0).matrixTransform(el.getScreenCTM()).x)
			const leftGap = body.x - icon.x - icon.width / 2
			const rightGap = railX - body.x - body.width
			const minimumGap = width < 1360 ? 77 : 114
			assert.ok(leftGap >= minimumGap && leftGap <= minimumGap + 10, `left controls leave slightly more room: ${leftGap}`)
			assert.ok(Math.abs(rightGap - (width < 1360 ? 80 : 107)) < 1, `right axis leaves slightly more room: ${rightGap}`)
			assert.ok(Math.abs(leftGap - rightGap) < 20, `side gaps stay visually balanced: ${leftGap}, ${rightGap}`)
			assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
		}
		finally { await context.close() }
	})
}

for (const width of [1025, 1440]) {
	test(`both sidebars follow the directory when either side is hovered or focused at ${width}px`, async () => {
		const { context, page } = await article(width, { reducedMotion: 'reduce' })
		try {
			const bodyX = (await page.locator('.article').boundingBox()).x + 150
			await page.mouse.move(5, 5)
			await page.evaluate(() => scrollTo({ top: 900, behavior: 'instant' }))
			await page.waitForFunction(() => document.querySelector('.reading-navigation')?.hasAttribute('data-reading'))
			const label = page.locator('#blog-sidebar .sidebar-nav-item[href] .nav-text').first()
			assert.equal(await label.evaluate(el => getComputedStyle(el).opacity), '1', 'expanded directory keeps the left labels expanded too')
			// Exercise the reference's 300ms pointer sampler with a continuing move.
			await page.mouse.move(bodyX, 450)
			await page.waitForTimeout(310)
			await page.mouse.move(bodyX + 1, 450)
			await page.waitForFunction(() => document.querySelector('.reading-navigation')?.hasAttribute('data-focused'))
			assert.equal(await label.evaluate(el => getComputedStyle(el).opacity), '0')
			await page.locator('.reading-navigation').hover()
			await page.waitForFunction(() => !document.querySelector('.reading-navigation')?.hasAttribute('data-focused'))
			assert.equal(await label.evaluate(el => getComputedStyle(el).opacity), '1', 'hovering the right side expands both sides')
			// Exercise the reference's 300ms pointer sampler with a continuing move.
			await page.mouse.move(bodyX, 450)
			await page.waitForTimeout(310)
			await page.mouse.move(bodyX + 1, 450)
			await page.waitForFunction(() => document.querySelector('.reading-navigation')?.hasAttribute('data-focused'))
			await page.locator('#blog-sidebar .sidebar-nav-item[href]').first().focus()
			await page.waitForFunction(() => !document.querySelector('.reading-navigation')?.hasAttribute('data-focused'), { timeout: 3000 })
			assert.equal(await label.evaluate(el => getComputedStyle(el).opacity), '1', 'left keyboard navigation expands the directory too')
		}
		finally { await context.close() }
	})
}

test('left labels follow the actual directory fade on collapse and expansion', async () => {
	const { context, page } = await article(1440)
	try {
		const bodyX = (await page.locator('.article').boundingBox()).x + 150
		await page.mouse.move(5, 5)
		await page.evaluate(() => scrollTo({ top: 900, behavior: 'instant' }))
		await page.waitForTimeout(850)
		async function capture(action) {
			await page.evaluate(() => {
				window.sideFrames = []
				const start = performance.now()
				window.sideCapture = new Promise((resolve) => {
					function frame() {
						const label = document.querySelector('#blog-sidebar .sidebar-nav-item[href] .nav-text')
						const item = document.querySelector('.reading-navigation a[aria-current]')?.closest('.toc-item')
						if (item)
							window.sideFrames.push({ left: Number(getComputedStyle(label).opacity), right: Number(getComputedStyle(item).opacity) })
						if (performance.now() - start < 800)
							requestAnimationFrame(frame)
						else resolve(window.sideFrames)
					}
					requestAnimationFrame(frame)
				})
			})
			await action()
			return page.evaluate(() => window.sideCapture)
		}
		for (const action of [
			() => page.mouse.move(bodyX, 450),
			() => page.locator('.reading-navigation').hover(),
			() => page.mouse.move(bodyX, 450),
			() => page.locator('#blog-sidebar .sidebar-nav-item[href]').first().hover(),
		]) {
			const frames = await capture(action)
			assert.ok(frames.some(frame => frame.right > 0.1 && frame.right < 0.9), 'capture must include the directory transition')
			assert.ok(frames.every(frame => Math.abs(frame.left - frame.right) < 0.12), `both sides should fade together: ${JSON.stringify(frames)}`)
		}
	}
	finally { await context.close() }
})
