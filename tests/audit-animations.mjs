import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import process from 'node:process'

// Production preview only. Example:
// MOTION_BASE_URL=http://127.0.0.1:3235 PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/audit-animations.mjs
// Optional: MOTION_TRACE=1, MOTION_CPU_RATE=4, MOTION_OUTPUT=docs/animation-audit, MOTION_EXTERNAL=1.
async function main() {
	const baseURL = process.env.MOTION_BASE_URL || 'http://127.0.0.1:3235'
	const output = process.env.MOTION_OUTPUT || 'docs/animation-audit'
	const rate = Number(process.env.MOTION_CPU_RATE || 4)
	const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
	// The default headless shell uses SwiftShader on macOS. Use the full browser's
	// Metal backend so WebGL and backdrop-filter measurements reflect real hardware.
	const browser = await chromium.launch({
		headless: true,
		...(process.platform === 'darwin' && !process.env.BROWSER_EXECUTABLE ? { channel: 'chromium', args: ['--enable-gpu', '--use-angle=metal'] } : {}),
		...(process.env.BROWSER_EXECUTABLE && { executablePath: process.env.BROWSER_EXECUTABLE }),
	})
	await mkdir(output, { recursive: true })
	const system = await (await browser.newBrowserCDPSession()).send('SystemInfo.getInfo')
	const gpu = { devices: system.gpu.devices, featureStatus: system.gpu.featureStatus }
	const rows = []

	try {
		for (const width of [1440, 375]) {
			const context = await browser.newContext({ baseURL, viewport: { width, height: width === 375 ? 812 : 1000 }, isMobile: width === 375, hasTouch: width === 375, locale: 'zh-CN' })
			// Read-only fixtures make loading/reveal/reaction motion reproducible without
			// relying on live services or writing comments/reactions to a real account.
			await context.route('**/*', async (route) => {
				const url = new URL(route.request().url())
				let json
				if (url.pathname === '/api/v1/memos') {
					const size = Number(url.searchParams.get('pageSize') || 10)
					const offset = url.searchParams.has('pageToken') ? 10 : 0
					json = { memos: Array.from({ length: size }, (_, i) => ({ name: `memos/audit${offset + i}`, content: `动画测试 ${offset + i}\n\n${'用于测试骨架、展开和列表加载的文字。'.repeat(i === 0 ? 15 : 2)}`, createTime: '2026-09-11T00:00:00Z', pinned: false })), nextPageToken: offset ? '' : 'next' }
				}
				else if (url.pathname.includes('/collections')) {
					const offset = Number(url.searchParams.get('offset') || 0)
					json = { data: Array.from({ length: 20 }, (_, i) => ({ subject_id: offset + i + 1, updated_at: '2026-09-11', rate: 8, comment: '动画测试', subject: { id: offset + i + 1, name: `Motion ${offset + i}`, name_cn: `测试 ${offset + i}`, score: 8.5, short_summary: '用于验证卡片加载和标签切换。', images: { common: `${baseURL}/icons/favicon-192.png` } } })), total: 40, offset, limit: 20 }
				}
				else if (url.pathname === '/api/me') {
					json = { user: null }
				}
				else if (url.pathname === '/api/pages/thread') {
					json = { page: { id: 1, key: '/', title: 'Audit', reactions: {}, viewer_reactions: [], viewer_subscribed: false }, comments: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, parent_id: null, depth: 0, deleted: false, user: { id: i + 2, login: `reader${i}`, name: `Reader ${i}`, avatar_url: `${baseURL}/icons/favicon-192.png`, is_owner: false }, body_html: '<p>用于验证评论入场、排序和翻译动画。</p>', body_md: '用于验证评论入场、排序和翻译动画。', created_at: '2026-09-11T00:00:00Z', reactions: {}, viewer_reactions: [], can_edit: false, can_delete: false })), next_cursor: null, total_comments: 8 }
				}
				else if (url.pathname === '/api/pages/counts') {
					json = { counts: {} }
				}
				if (json) {
					await new Promise(resolve => setTimeout(resolve, 180))
					return route.fulfill({ json })
				}
				if (url.origin === new URL(baseURL).origin || process.env.MOTION_EXTERNAL === '1')
					return route.continue()
				return route.abort()
			})
			const page = await context.newPage()
			page.setDefaultTimeout(10000)
			await page.addInitScript(() => {
				window.motionFrames = []
				window.motionTasks = []
				window.motionTransitions = []
				new PerformanceObserver(list => window.motionTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true })
				let previous
				function frame(now) {
					if (previous)
						window.motionFrames.push({ time: now, duration: now - previous })
					previous = now
					requestAnimationFrame(frame)
				}
				requestAnimationFrame(frame)
				if (!document.startViewTransition)
					return
				const start = document.startViewTransition.bind(document)
				document.startViewTransition = (update) => {
					const row = { start: performance.now() }
					window.motionTransitions.push(row)
					const transition = start(async () => {
						row.callback = performance.now()
						await update()
						row.updated = performance.now()
					})
					transition.ready.then(() => row.ready = performance.now()).catch(error => row.error = String(error))
					transition.finished.then(() => row.finished = performance.now()).catch(() => {})
					return transition
				}
			})
			const cdp = await context.newCDPSession(page)
			await cdp.send('Performance.enable')
			await cdp.send('Emulation.setCPUThrottlingRate', { rate })
			if (process.env.MOTION_TRACE)
				await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,blink.animations', transferMode: 'ReturnAsStream' })
			const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]))
			async function ready() {
				await page.waitForFunction(() => document.querySelector('#blog-root')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false)
			}
			async function visit(path) {
				await page.goto(path, { waitUntil: 'domcontentloaded' })
				await run(`entry:${path}`, ready, 800)
			}
			async function run(name, action, wait = 700) {
				const before = await metrics()
				const start = await page.evaluate(() => performance.now())
				let error
				try {
					await action()
					await page.waitForTimeout(wait)
				}
				catch (failure) { error = failure.message.split('\n')[0] }
				const samples = await page.evaluate((start) => {
					const end = performance.now()
					const transitions = window.motionTransitions.filter(t => t.start >= start && t.start < end)
					// Native view transitions intentionally suspend rAF while capturing the
					// new document. Report that wait separately from animation playback.
					const frames = window.motionFrames.filter(f => f.time >= start && f.time < end && !transitions.some(t => t.ready && f.time - f.duration < t.ready && f.time >= t.start)).map(f => f.duration).sort((a, b) => a - b)
					const tasks = window.motionTasks.filter(t => t.start >= start && t.start < end)
					return { start, end, frames: frames.length, p95: frames[Math.floor(frames.length * 0.95)] ?? 0, max: frames.at(-1) ?? 0, over34: frames.filter(f => f > 34).length, longTasks: tasks.length, longestTask: Math.max(0, ...tasks.map(t => t.duration)), transitions }
				}, start)
				const after = await metrics()
				const delta = {}
				for (const key of ['LayoutCount', 'RecalcStyleCount', 'LayoutDuration', 'RecalcStyleDuration', 'ScriptDuration', 'TaskDuration'])
					delta[key] = Number((after[key] - before[key]).toFixed(5))
				const row = { width, name, ...samples, clockStart: before.Timestamp, clockEnd: after.Timestamp, metrics: delta, ...(error && { error }) }
				rows.push(row)
				process.stdout.write(`${JSON.stringify(row)}\n`)
			}

			await visit('/')
			await run('carousel', () => page.locator('.carousel-action.next').evaluate(e => e.click()), 1300)
			await run('card-hover', () => page.locator('.article-card').first().hover())
			await run('article-enter', () => page.locator('.article-card').first().click(), 1100)
			await run('article-scroll-and-progress', () => page.evaluate(() => window.scrollBy({ top: 900, behavior: 'smooth' })), 1000)
			await run('article-back', () => page.goBack(), 1000)
			await run('filter-menu', () => page.locator('.post-filter .dropdown').click())
			await run('filter-list', () => page.locator('.tippy-content button').last().click())
			await page.goto('/')
			await ready()
			await page.waitForTimeout(600)
			await run('pagination', () => page.locator('.pagination-num').nth(1).click(), 900)
			await page.goBack()
			await page.waitForTimeout(600)
			await run('search-open', () => page.keyboard.press('Meta+k'), 1400)
			await run('search-results', () => page.locator('.search-input').fill('的'))
			await run('search-replace', () => page.locator('.search-input').fill('root'))
			await run('search-close', () => page.keyboard.press('Escape'))
			if (width === 375) {
				await run('sidebar-open', () => page.locator('#blog-panel .toggle-sidebar').click())
				await run('sidebar-close', () => page.locator('#blog-panel .toggle-sidebar').click())
				await run('aside-open', () => page.locator('#blog-panel .toggle-aside').click())
				await run('aside-close', () => page.locator('#blog-panel .toggle-aside').click())
				await page.locator('#blog-panel .toggle-sidebar').click()
			}
			await run('theme-dark', () => page.locator('.theme-toggle [data-theme="dark"]').click())
			await run('theme-light', () => page.locator('.theme-toggle [data-theme="light"]').click())
			await run('language-open', () => page.locator('.language-trigger').click())
			await run('language-switch', () => page.locator('.language-options [lang="en"]').click(), 1500)
			await visit('/archive')
			await run('archive-hover', () => page.locator('[data-cover] .article-link').first().hover())
			await run('archive-idle', async () => {}, 1000)
			await visit('/friends')
			await run('friends-cards-hover', () => page.locator('.feed-card').first().hover())
			await run('friends-tabs', () => page.locator('.tabs button').last().click())
			await visit('/projects/mydb/mydb0')
			await page.locator('.series-summary').scrollIntoViewIfNeeded()
			await page.waitForTimeout(250)
			await run('series-open', () => page.locator('.series-summary').click())
			await run('series-close', () => page.locator('.series-summary').click())
			await page.locator('.authorship-seal').scrollIntoViewIfNeeded()
			await page.waitForTimeout(250)
			await run('authorship-stamp', () => page.locator('.authorship-seal').click())
			await run('comments-reveal', async () => {
				await page.locator('#comment').scrollIntoViewIfNeeded()
				await page.locator('.z-comment .comment').first().waitFor()
			})
			await visit('/memos')
			await run('memo-comments-expand', () => page.locator('.memo button.comments').first().click())
			await run('memo-comments-collapse', () => page.locator('.memo button.comments').first().click())
			await run('memo-load-more', () => page.locator('.memos-footer button').click(), 2400)
			await visit('/media')
			await run('media-status', () => page.locator('.filter-status-tab').nth(1).click())
			await run('media-category', () => page.locator('.filter-cats button').last().click())
			await run('media-load-more', () => page.locator('.media-footer button').click())
			await visit('/travels/kansai-202504')
			await run('travel-chapter-scroll', () => page.keyboard.press('ArrowDown'), 1400)
			await run('travel-photo-scroll', () => page.keyboard.press('ArrowDown'), 1400)
			await run('travel-chapter-menu', () => page.locator('.chapter-trigger').click())
			await page.keyboard.press('Escape')
			await run('travel-theme-menu', () => page.locator('.theme-control > .theme-trigger').click())
			await page.keyboard.press('Escape')
			if (width === 1440) {
				await run('travel-viewer-open', () => page.locator('.photo-zoom').first().click(), 800)
				await run('travel-viewer-next', async () => {
					const box = await page.locator('.lightbox-stage').boundingBox()
					const x = box.x + box.width / 2
					const y = box.y + box.height / 2
					await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x + 65, y }] })
					await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 65, y }] })
					await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
				}, 800)
				await run('travel-viewer-zoom', () => page.locator('.lightbox-photo').click({ position: { x: 50, y: 50 } }), 700)
				await run('travel-viewer-close', () => page.keyboard.press('Escape'), 800)
				await run('travel-map-open', () => page.locator('.map-control .map-trigger').click())
				await page.keyboard.press('Escape')
				await run('travel-map-explore', () => page.locator('.topbar .mode-button').click(), 1000)
				await run('travel-map-close', () => page.keyboard.press('Escape'), 800)
			}
			else {
				await run('travel-photo-map-open', () => page.locator('.story-photo .photo-place').first().click(), 1100)
				await run('travel-photo-map-close', () => page.locator('.map-drawer-head button').click(), 800)
			}

			if (process.env.MOTION_TRACE) {
				const completed = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve))
				await cdp.send('Tracing.end')
				const { stream } = await completed
				let trace = ''
				while (true) {
					const chunk = await cdp.send('IO.read', { handle: stream })
					trace += chunk.data
					if (chunk.eof)
						break
				}
				await cdp.send('IO.close', { handle: stream })
				await writeFile(`${output}/trace-${width}.json`, trace)
			}
			await context.close()
		}
	}
	finally {
		await writeFile(`${output}/results.json`, JSON.stringify({ baseURL, rate, gpu, rows }, null, 2))
		await browser.close()
	}
	assert.equal(rows.filter(row => row.error).length, 0, 'some scenarios did not run; inspect results.json')
}

main().catch((error) => {
	console.error(error)
	process.exitCode = 1
})
