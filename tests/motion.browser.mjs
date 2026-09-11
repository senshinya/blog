import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { after, before, test } from 'node:test'

// Run against a production preview. PLAYWRIGHT_MODULE and BROWSER_EXECUTABLE
// allow using an existing local Playwright installation without bundling it.
const baseURL = process.env.MOTION_BASE_URL || 'http://127.0.0.1:3235'
let browser
before(async () => {
	const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright').then(m => m.default || m)
	browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE && { executablePath: process.env.BROWSER_EXECUTABLE }) })
})
after(async () => browser?.close())

async function pageFor(options = {}) {
	const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, locale: 'zh-CN', ...options })
	const page = await context.newPage()
	page.setDefaultTimeout(5000)
	return { context, page }
}

for (const width of [375, 1440]) {
	test(`featured articles are visible before hydration at ${width}px`, async () => {
		const { context, page } = await pageFor({ viewport: { width, height: 1000 } })
		try {
			await context.route('**/*', route => route.request().resourceType() === 'script' || new URL(route.request().url()).origin !== new URL(baseURL).origin ? route.abort() : route.continue())
			await page.goto('/', { waitUntil: 'load' })
			assert.ok(await page.locator('.slide-item').count() > 0, 'featured data must be in the server HTML')
			assert.equal(await page.locator('.z-slide-body').getAttribute('data-ready'), null)
			const style = await page.locator('.z-slide-body').evaluate(e => ({ visibility: getComputedStyle(e).visibility, opacity: getComputedStyle(e).opacity }))
			assert.equal(style.visibility, 'visible', 'server-rendered articles must not wait for the carousel script')
			assert.equal(style.opacity, '1')
			assert.ok(await page.locator('.slide-item .stable-info').first().isVisible())
		}
		finally { await context.close() }
	})

	test(`featured carousel preserves its first paint and manual navigation at ${width}px`, async () => {
		const { context, page } = await pageFor({ viewport: { width, height: 1000 } })
		let releaseScripts
		const scriptsReady = new Promise(resolve => releaseScripts = resolve)
		try {
			await context.route('**/*', async (route) => {
				if (new URL(route.request().url()).origin !== new URL(baseURL).origin)
					return route.abort()
				if (route.request().resourceType() === 'script')
					await scriptsReady
				await route.continue()
			})
			await page.goto('/', { waitUntil: 'commit' })
			await page.waitForFunction(() => {
				const row = document.querySelector('.z-slide-body')
				return row && getComputedStyle(row).maskImage !== 'none'
			})
			const first = page.locator('.slide-item').first()
			const before = await first.boundingBox()
			releaseScripts()
			await page.locator('.z-slide-body[data-ready]').waitFor({ timeout: 30000 })
			const hydrated = await first.boundingBox()
			assert.ok(Math.abs(hydrated.x - before.x) < 2, `hydration must not reposition the visible row: ${JSON.stringify({ before, hydrated })}`)
			assert.ok(Math.abs(hydrated.y - before.y) < 2, 'hydration must not shift content vertically')
			await page.locator('.z-slide').hover()
			await page.locator('.carousel-action.next').click()
			await page.waitForFunction(x => Math.abs(document.querySelector('.slide-item').getBoundingClientRect().x - x) > 20, hydrated.x)
			await page.waitForTimeout(1000)
			const settled = await first.boundingBox()
			await page.waitForTimeout(4500)
			assert.ok(Math.abs((await first.boundingBox()).x - settled.x) < 2, 'carousel must remain still without interaction')
		}
		finally {
			releaseScripts()
			await context.close()
		}
	})
}

test('travel list opens a working chapter scroller without refresh and returns to list', async () => {
	const { context, page } = await pageFor({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })
	try {
		await page.goto('/travels')
		await page.waitForFunction(() => document.querySelector('#blog-root')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false)
		await page.evaluate(() => window.travelNavigationSentinel = true)
		await page.locator('.travel-card[href$="/travels/kansai-202504"]').click()
		await page.waitForURL('**/travels/kansai-202504')
		await page.locator('.travel').waitFor()
		assert.equal(await page.evaluate(() => window.travelNavigationSentinel), true, 'travel entry must use client navigation')
		const initial = await page.locator('.travel-screen').first().boundingBox()
		await page.locator('[data-index="1"]').evaluate(e => e.scrollIntoView({ behavior: 'instant', block: 'start' }))
		await page.waitForTimeout(250)
		const title = page.locator('[data-index="1"]')
		await page.locator('.travel-map-toggle').click()
		await page.waitForTimeout(400)
		const box = await title.boundingBox()
		const map = await page.locator('.travel-map-col').boundingBox()
		assert.ok(Math.abs(box.y - (map.y + map.height)) < 2, 'collapse must keep the same chapter under the map')
		await page.locator('.travel-map-toggle').click()
		await page.waitForTimeout(400)
		const expanded = await title.boundingBox()
		assert.ok(Math.abs(expanded.y - initial.y) < 2, 'expand must keep the same chapter')
		await page.locator('.travel-back').click()
		await page.locator('.travel-list').waitFor()
		assert.equal(await page.locator('.travel').count(), 0)
	}
	finally { await context.close() }
})

test('search input stays fixed when results change and closing can be interrupted', async () => {
	const { context, page } = await pageFor()
	try {
		await page.goto('/')
		await page.locator('.z-slide-body[data-ready]').waitFor()
		await page.keyboard.press('Meta+k')
		const input = page.locator('.search-input')
		await input.fill('root')
		await page.waitForTimeout(500)
		const before = await input.boundingBox()
		await input.fill('xxxxxzzz')
		await page.waitForTimeout(500)
		assert.ok(Math.abs((await input.boundingBox()).y - before.y) < 1, 'typing must not move the focused input')
		for (let i = 0; i < 3; i++) {
			await page.keyboard.press('Meta+k')
			await page.waitForTimeout(50)
			await page.keyboard.press('Meta+k')
			await page.waitForTimeout(400)
			assert.equal(await page.locator('.blog-search').count(), 1, 'reopening must cancel the pending close')
			assert.equal(await page.locator('.bikariya-overlay').count(), 1)
		}
		await page.keyboard.press('Escape')
		await page.waitForTimeout(400)
		assert.equal(await page.locator('.blog-search').count(), 0)
	}
	finally { await context.close() }
})

test('desktop travel navigation releases the default layout grid', async () => {
	const { context, page } = await pageFor()
	try {
		await page.goto('/travels')
		await page.waitForFunction(() => document.querySelector('#blog-root')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false)
		await page.evaluate(() => window.travelNavigationSentinel = true)
		await page.locator('.travel-card[href$="/travels/kansai-202504"]').click()
		await page.locator('.travel').waitFor()
		assert.equal(await page.evaluate(() => window.travelNavigationSentinel), true, 'travel entry must use client navigation')
		const box = await page.locator('.travel').boundingBox()
		assert.equal(box.width, 1440, 'the fullscreen travel must not inherit the default sidebar grid')
		assert.equal(box.x, 0)
		await page.locator('[data-index="1"]').evaluate(e => e.scrollIntoView({ behavior: 'instant', block: 'start' }))
		await page.waitForTimeout(300)
		assert.ok(Math.abs((await page.locator('[data-index="1"]').boundingBox()).y) < 1)
	}
	finally { await context.close() }
})

test('mobile touch scroll snaps chapters and can read inside a tall chapter', async () => {
	const { context, page } = await pageFor({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })
	try {
		await page.goto('/travels/kansai-202504')
		await page.locator('.travel-screen').first().waitFor()
		const cdp = await context.newCDPSession(page)
		async function swipe() {
			await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: 720 }] })
			for (let y = 690; y >= 390; y -= 30) {
				await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 180, y }] })
				await page.waitForTimeout(18)
			}
			await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
			await page.waitForTimeout(1200)
		}
		await swipe()
		const chapter = await page.locator('[data-index="0"]').boundingBox()
		const map = await page.locator('.travel-map-col').boundingBox()
		assert.ok(Math.abs(chapter.y - map.height) < 2, 'touch must settle at the chapter below the map')
		const position = await page.locator('.travel-screens').evaluate(e => e.scrollTop)
		await swipe()
		assert.ok(await page.locator('.travel-screens').evaluate(e => e.scrollTop) > position + 100, 'content must scroll in the chapter scroller')
		assert.equal(await page.locator('[data-index="0"] .travel-day-content').evaluate(e => e.scrollTop), 0, 'mobile must not trap scrolling inside a nested content box')
	}
	finally { await context.close() }
})

test('reduced motion shows full excerpts, stops autoplay and opens lightbox instantly', async () => {
	const { context, page } = await pageFor({ reducedMotion: 'reduce' })
	try {
		await context.addInitScript(() => {
			window.motionCalls = []
			const animate = Element.prototype.animate
			Element.prototype.animate = function (keys, options) {
				window.motionCalls.push({ target: this.className, duration: options?.duration })
				return animate.call(this, keys, options)
			}
		})
		await page.goto('/daily/anti-chronic-gastritis')
		const excerpt = page.locator('.md-excerpt .dynamic')
		await excerpt.waitFor()
		const text = await excerpt.textContent()
		assert.ok(text.length >= 162, 'the complete excerpt is immediately available')
		await page.waitForTimeout(500)
		assert.equal(await excerpt.textContent(), text)
		const photo = page.locator('.article img').first()
		await photo.scrollIntoViewIfNeeded()
		await page.waitForFunction(() => document.querySelector('.article img')?.naturalWidth > 0)
		await photo.click()
		await page.locator('.bikariya-image-viewer').waitFor()
		const calls = await page.evaluate(() => window.motionCalls.filter(call => String(call.target).includes('bikariya-image-viewer')))
		assert.ok(calls.length > 0)
		assert.ok(calls.every(call => call.duration === 0))
		await page.keyboard.press('Escape')
		await page.goto('/')
		await page.locator('.z-slide-body[data-ready]').waitFor()
		await page.waitForTimeout(300)
		const before = await page.locator('.slide-list').evaluate(e => getComputedStyle(e).transform)
		await page.waitForTimeout(4500)
		assert.equal(await page.locator('.slide-list').evaluate(e => getComputedStyle(e).transform), before)
	}
	finally { await context.close() }
})

for (const width of [375, 1440]) {
	test(`memo skeletons morph in place to real card heights at ${width}px`, async () => {
		const { context, page } = await pageFor({ viewport: { width, height: 1000 } })
		let release
		const responseReady = new Promise(resolve => release = resolve)
		try {
			await context.addInitScript(() => {
				window.memoMorphs = []
				const animate = Element.prototype.animate
				Element.prototype.animate = function (frames, timing) {
					const animation = animate.call(this, frames, timing)
					if (this.classList.contains('memo-loading-card') && frames[0]?.height) {
						animation.pause()
						window.memoMorphs.push(animation)
					}
					return animation
				}
			})
			await context.route('**/api/v1/memos?*', async (route) => {
				if (new URL(route.request().url()).searchParams.get('pageSize') === '5')
					return route.fulfill({ json: { memos: [] } })
				await responseReady
				await route.fulfill({ json: { memos: Array.from({ length: 10 }, (_, i) => ({ name: `memos/morph${i}`, content: i === 0 ? '一段比较长的碎语，用于验证骨架会扩展到真实正文的高度。\n\n'.repeat(8) : '短碎语。', createTime: '2026-09-11T00:00:00Z', pinned: false })) } })
			})
			await page.goto('/memos', { waitUntil: 'domcontentloaded' })
			assert.equal(await page.locator('.memo-list > li[data-loading]').count(), 10)
			const before = await page.locator('.memo-list > li').evaluateAll((nodes) => {
				window.originalMemoSlots = nodes
				return nodes.map(node => node.getBoundingClientRect().height)
			})
			release()
			await page.waitForFunction(() => window.memoMorphs.length === 10)
			assert.ok(await page.locator('.memo-list > li').evaluateAll(nodes => nodes.every((node, i) => node === window.originalMemoSlots[i])), 'the original skeleton containers must survive')
			await page.evaluate(() => window.memoMorphs.forEach(animation => animation.currentTime = 0))
			const start = await page.locator('.memo-list > li').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height))
			assert.ok(start.every((height, i) => Math.abs(height - before[i]) < 1), 'every card starts at its skeleton height')
			await page.evaluate(() => window.memoMorphs.forEach(animation => animation.currentTime = 280))
			const halfway = await page.locator('.memo-list > li').first().boundingBox()
			const target = await page.locator('.memo-slot-content').first().boundingBox()
			assert.ok(halfway.height > before[0] && halfway.height < target.height, 'the first card expands through an intermediate height')
			assert.equal(await page.locator('.memo-slot-content .memo').first().evaluate(e => getComputedStyle(e).animationName), 'none')
			await page.evaluate(() => window.memoMorphs.forEach(animation => animation.finish()))
			await page.waitForFunction(() => !document.querySelector('.memo-loading-card[data-morphing]'))
			assert.equal(await page.locator('.memo-placeholder').count(), 0)
			const settled = await page.locator('.memo-list > li').first().boundingBox()
			assert.ok(Math.abs(settled.height - target.height) < 1)
			assert.equal(await page.locator('.memo-list > li').first().evaluate(e => e.style.height), '')
		}
		finally {
			release()
			await context.close()
		}
	})
}

for (const scenario of ['reduce', 'resize', 'empty', 'error']) {
	test(`memo skeletons settle cleanly for ${scenario}`, async () => {
		const { context, page } = await pageFor({ reducedMotion: scenario === 'reduce' ? 'reduce' : 'no-preference' })
		let release
		const ready = new Promise(resolve => release = resolve)
		try {
			await context.addInitScript((scenario) => {
				window.heightMorphCount = 0
				const animate = Element.prototype.animate
				Element.prototype.animate = function (frames, timing) {
					const animation = animate.call(this, frames, timing)
					if (this.classList.contains('memo-loading-card') && frames[0]?.height) {
						window.heightMorphCount++
						if (scenario === 'resize')
							animation.pause()
					}
					return animation
				}
			}, scenario)
			await context.route('**/api/v1/memos?*', async (route) => {
				if (new URL(route.request().url()).searchParams.get('pageSize') === '5')
					return route.fulfill({ json: { memos: [] } })
				await ready
				if (scenario === 'error')
					return route.fulfill({ status: 400, json: { message: 'fixture failure' } })
				await route.fulfill({ json: { memos: scenario === 'empty' ? [] : [{ name: 'memos/one', content: '一条碎语。', createTime: '2026-09-11T00:00:00Z', pinned: false }] } })
			})
			await page.goto('/memos', { waitUntil: 'domcontentloaded' })
			assert.equal(await page.locator('.memo-placeholder').count(), 10)
			release()
			if (scenario === 'resize') {
				await page.waitForFunction(() => window.heightMorphCount === 1)
				await page.setViewportSize({ width: 1000, height: 900 })
			}
			await page.waitForFunction(() => !document.querySelector('.memo-placeholder'))
			assert.equal(await page.locator('.memo-loading-card[data-morphing], .memos[data-revealing]').count(), 0)
			assert.equal(await page.locator('.memo-list > li').count(), scenario === 'empty' || scenario === 'error' ? 0 : 1)
			if (scenario === 'reduce')
				assert.equal(await page.evaluate(() => window.heightMorphCount), 0)
			if (scenario === 'resize') {
				const slot = await page.locator('.memo-loading-card').boundingBox()
				const body = await page.locator('.memo-slot-content').boundingBox()
				assert.ok(Math.abs(slot.height - body.height) < 1)
				assert.equal(await page.locator('.memo-loading-card').evaluate(e => e.getAnimations().length), 0)
			}
		}
		finally {
			release()
			await context.close()
		}
	})
}

test('memo pages contain ten items and share the slowed reveal timeline', async () => {
	const { context, page } = await pageFor()
	try {
		const sizes = []
		await context.route('**/api/v1/memos?*', async (route) => {
			const query = new URL(route.request().url()).searchParams
			const size = Number(query.get('pageSize'))
			if (size !== 5)
				sizes.push(size)
			const offset = query.has('pageToken') ? 10 : 0
			await route.fulfill({ json: { memos: Array.from({ length: size }, (_, i) => ({ name: `memos/audit${i + offset}`, content: `测试碎语 ${i + offset}\n\n这是一段用于核验加载动画的文字。`, createTime: '2026-09-11T00:00:00Z', pinned: false })), nextPageToken: offset ? '' : 'next' } })
		})
		await page.goto('/memos')
		await page.waitForFunction(() => document.querySelectorAll('.memo-list > li').length === 10)
		await page.locator('.memos-footer button').click()
		await page.waitForFunction(() => document.querySelectorAll('.memo-list > li').length === 20)
		const animation = await page.locator('.memos-footer').evaluate(e => e.getAnimations().map(a => ({ duration: a.effect.getTiming().duration, keys: a.effect.getKeyframes() })))
		assert.ok(animation[0]?.duration >= 1100 && animation[0]?.duration <= 2200)
		const earlyProgress = await page.locator('.memos-footer').evaluate((e) => {
			const animation = e.getAnimations()[0]
			animation.pause()
			animation.currentTime = 250
			const progress = animation.effect.getComputedTiming().progress
			animation.play()
			return progress
		})
		assert.ok(earlyProgress > 0 && earlyProgress < 0.15, 'the divider must ease into its travel instead of racing out of view')
		await page.mouse.move(0, 0)
		await page.waitForFunction(() => !document.querySelector('.memos[data-revealing]'))
		assert.deepEqual(sizes, [10, 10])
		assert.equal(await page.locator('.memos[data-revealing]').count(), 0)
		assert.equal(await page.locator('.memo-list').evaluate(e => e.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length), 0)
	}
	finally { await context.close() }
})

for (const delay of [180, 1500]) {
	test(`media filters show loading immediately and hold result height (${delay}ms)`, async () => {
		const { context, page } = await pageFor()
		try {
			await context.route('**/collections?*', async (route) => {
				const changed = new URL(route.request().url()).searchParams.get('type') === '2'
				if (changed)
					await new Promise(resolve => setTimeout(resolve, delay))
				const count = changed ? 20 : 2
				await route.fulfill({ json: { total: count, data: Array.from({ length: count }, (_, i) => ({ subject_id: i, rate: 0, comment: '', updated_at: '', subject: { id: i, name: `${changed ? '新' : '旧'}筛选 ${i}`, name_cn: '', images: {} } })) } })
			})
			await page.goto('/media')
			await page.locator('.bgm-card').first().waitFor()
			const initial = (await page.locator('.media-results').boundingBox()).height
			await page.locator('.filter-status button').nth(1).click()
			await page.locator('.media-results[aria-busy="true"]').waitFor()
			assert.equal(await page.locator('.bgm-card').count(), 0)
			assert.equal(await page.locator('.media-loading-status').count(), 0)
			assert.equal(await page.locator('.media-skeleton-grid').isVisible(), true)
			assert.ok(Math.abs((await page.locator('.media-results').boundingBox()).height - initial) < 1)
			await page.waitForFunction(() => document.querySelectorAll('.bgm-card').length === 20)
			assert.equal(await page.locator('.media-results').getAttribute('aria-busy'), 'false')
		}
		finally { await context.close() }
	})
}

test('search stacks its backdrop above an already open lightbox', async () => {
	const { context, page } = await pageFor({ reducedMotion: 'reduce' })
	try {
		await page.goto('/daily/anti-chronic-gastritis')
		const photo = page.locator('.article img').first()
		await photo.scrollIntoViewIfNeeded()
		await page.waitForFunction(() => document.querySelector('.article img')?.naturalWidth > 0)
		await photo.click()
		await page.locator('.bikariya-image-viewer').waitFor()
		await page.keyboard.press('Meta+k')
		await page.locator('.blog-search').waitFor()
		const stack = await page.evaluate(() => ({
			viewer: Number(getComputedStyle(document.querySelector('.bikariya-image-viewer')).zIndex),
			backdrop: Math.max(...Array.from(document.querySelectorAll('.bikariya-overlay'), e => Number(getComputedStyle(e).zIndex))),
		}))
		assert.ok(stack.backdrop > stack.viewer, 'search backdrop must intercept interaction above the image viewer')
	}
	finally { await context.close() }
})

test('friends can disable shuffle without an initial rearrangement animation', async () => {
	const { context, page } = await pageFor()
	try {
		await page.goto('/friends?shuffle=false')
		await page.locator('.feed-list .feed-card').first().waitFor()
		await page.waitForTimeout(250)
		const source = await readFile(new URL('../app/feeds.ts', import.meta.url), 'utf8')
		const expected = [...source.matchAll(/link: '([^']+)'/g)].map(match => match[1])
		const actual = await page.locator('.feed-list .feed-card').evaluateAll(cards => cards.map(card => card.getAttribute('href')))
		assert.deepEqual(actual.slice(1), expected)
		assert.equal(await page.locator('.feed-list .float-in-move').count(), 0)
		const delays = await page.locator('.feed-list .feed-card').evaluateAll(cards => cards.map(card => getComputedStyle(card).animationDelay))
		assert.ok(new Set(delays).size > 5, 'friend cards must have varied entrance delays')
		assert.ok(delays.every(delay => Number.parseFloat(delay) >= 0 && Number.parseFloat(delay) <= 1))
	}
	finally { await context.close() }
})

test('friends retain staggered float-in on initial load and refresh', async () => {
	const { context, page } = await pageFor()
	try {
		for (let visit = 0; visit < 2; visit++) {
			await page.goto('/friends', { waitUntil: 'domcontentloaded' })
			await page.waitForFunction(() => document.querySelector('.feed-list') && !document.querySelector('.feed-list[data-preparing]'))
			const animations = await page.locator('.feed-list .feed-card').evaluateAll(cards => cards.map((card) => {
				const style = getComputedStyle(card)
				return { name: style.animationName, delay: style.animationDelay }
			}))
			assert.ok(animations.every(animation => animation.name.includes('float-in')))
			assert.ok(new Set(animations.map(animation => animation.delay)).size > 5)
			assert.equal(await page.locator('.feed-list .float-in-move').count(), 0)
		}
	}
	finally { await context.close() }
})

test('static friends remain visible with JavaScript disabled', async () => {
	const { context, page } = await pageFor({ javaScriptEnabled: false })
	try {
		await page.goto('/friends')
		await page.locator('.feed-list .feed-card').first().waitFor()
		assert.equal(await page.locator('.feed-list').evaluate(e => getComputedStyle(e).opacity), '1')
	}
	finally { await context.close() }
})

test('long articles defer offscreen code highlighting until the code approaches the viewport', async () => {
	const { context, page } = await pageFor({ locale: 'en-US' })
	try {
		await page.goto('/en/fiddling/vitepress-memos-component')
		await page.waitForFunction(() => document.querySelector('#blog-root')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false)
		await page.waitForTimeout(500)
		const last = page.locator('.z-codeblock').last()
		assert.ok((await last.boundingBox()).y > 1200)
		assert.equal(await last.locator('pre span').count(), 0, 'offscreen code keeps the lightweight plaintext DOM')
		await last.scrollIntoViewIfNeeded()
		await page.waitForFunction(() => [...document.querySelectorAll('.z-codeblock')].at(-1)?.querySelector('pre span'))
		assert.ok(await last.locator('pre span').count() > 0, 'approaching the code produces the usual highlighted content')
	}
	finally { await context.close() }
})
