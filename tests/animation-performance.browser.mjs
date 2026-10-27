import assert from 'node:assert/strict'
import process from 'node:process'
import { after, before, test } from 'node:test'
import { isolateExternalRequests } from './browser-network.mjs'

const baseURL = process.env.MOTION_BASE_URL || 'http://127.0.0.1:3235'
let browser
before(async () => {
	const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
	browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE && { executablePath: process.env.BROWSER_EXECUTABLE }) })
})
after(async () => browser?.close())

async function open(path = '/', width = 1440, deviceScaleFactor = 1, motion = 'native') {
	const context = await browser.newContext({ baseURL, viewport: { width, height: 1000 }, locale: 'zh-CN', deviceScaleFactor, reducedMotion: motion === 'reduce' ? 'reduce' : 'no-preference' })
	await isolateExternalRequests(context, baseURL)
	const page = await context.newPage()
	if (motion === 'unsupported')
		await page.addInitScript(() => document.startViewTransition = undefined)
	await page.goto(path)
	await page.waitForFunction(() => document.querySelector('#blog-root')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false)
	return { context, page }
}

for (const [width, dpr] of [[375, 3], [1440, 2]]) {
	test(`article snapshots suspend competing DOM animation and resume it after both directions at ${width}px / DPR ${dpr}`, async () => {
		const { context, page } = await open('/', width, dpr)
		try {
			await page.evaluate(() => {
				window.articleAnimationWork = []
				const start = document.startViewTransition.bind(document)
				document.startViewTransition = (update) => {
					const transition = start(update)
					transition.ready.then(() => {
						window.articleAnimationWork.push(document.getAnimations()
							.filter(a => !a.effect?.pseudoElement && a.playState === 'running')
							.map(a => ({ name: a.animationName || a.transitionProperty, target: a.effect.target.className })))
					})
					return transition
				}
			})
			await page.locator('.article-card').first().click()
			await page.waitForFunction(() => window.articleAnimationWork.length === 1 && !document.documentElement.hasAttribute('data-article-transition'))
			await page.locator('.article:visible').waitFor()
			assert.equal(await page.locator('.md-excerpt').evaluate(e => getComputedStyle(e).animationName), 'none', 'the excerpt must not flash and replay its entrance after the snapshot')
			await page.goBack()
			await page.waitForFunction(() => window.articleAnimationWork.length === 2 && !document.documentElement.hasAttribute('data-article-transition'))
			for (const work of await page.evaluate(() => window.articleAnimationWork))
				assert.deepEqual(work, [], 'live DOM must stay stable while the shared snapshots move')
			assert.equal(await page.locator('body').evaluate(e => getComputedStyle(e).animationPlayState), 'running', 'the temporary animation pause must be removed after the transition')
			assert.equal(await page.locator('.article-card').first().evaluate(e => getComputedStyle(e).animationName), 'none', 'the home entrance must not replay on return')
		}
		finally { await context.close() }
	})
}

test('article video embeds start near the viewport after the shared animation finishes', async () => {
	const { context, page } = await open()
	try {
		await page.evaluate(() => {
			const start = document.startViewTransition.bind(document)
			document.startViewTransition = (update) => {
				const transition = start(update)
				transition.ready.then(() => {
					window.snapshotVideoSources = Array.from(document.querySelectorAll('.video iframe')).map(frame => frame.getAttribute('src'))
				}).catch(() => {})
				return transition
			}
		})
		await page.locator('.article-card').first().click()
		await page.waitForFunction(() => window.snapshotVideoSources && !document.documentElement.hasAttribute('data-article-transition'))
		assert.ok((await page.evaluate(() => window.snapshotVideoSources)).every(source => source === null), 'the embedded player must not compete with the moving snapshots')
		await page.locator('.article:visible').waitFor()
		const frame = page.locator('.video iframe').first()
		await frame.scrollIntoViewIfNeeded()
		await page.waitForFunction(() => document.querySelector('.video iframe')?.src.includes('youtube.com/embed/'))
		assert.match(await frame.getAttribute('src'), /youtube\.com\/embed\//)
		await page.locator('.post-header').scrollIntoViewIfNeeded()
		await page.goBack()
		await page.waitForFunction(() => document.querySelector('.article-card') && !document.documentElement.hasAttribute('data-article-transition'))
	}
	finally { await context.close() }
})

test('article snapshots flush deferred head changes and wait for their stylesheet before playback', async () => {
	const { context, page } = await open()
	let releaseCSS
	try {
		await page.locator('.article-card').first().click()
		await page.locator('.article:visible').waitFor()
		await page.waitForFunction(() => !document.documentElement.hasAttribute('data-article-transition'))
		const css = new Promise(resolve => releaseCSS = resolve)
		await page.route('**/__snapshot-test.css', async (route) => {
			await css
			await route.fulfill({ contentType: 'text/css', body: ':root { --snapshot-css-ready: 1 }' })
		})
		await page.evaluate(() => {
			const nuxt = document.querySelector('#blog-root').__vue_app__.config.globalProperties.$nuxt
			const head = nuxt.vueApp.config.globalProperties.$head
			// Make the framework's deferred render deterministic; the plugin must flush it.
			head.render = () => {}
			nuxt.hook('page:finish', () => head.push({ meta: [{ name: 'snapshot-head', content: 'ready' }], link: [{ rel: 'stylesheet', href: '/__snapshot-test.css' }] }))
			window.headSnapshotReady = false
			const start = document.startViewTransition.bind(document)
			document.startViewTransition = (update) => {
				const transition = start(update)
				transition.ready.then(() => {
					window.headSnapshotReady = true
					window.headSnapshotMeta = document.querySelector('meta[name="snapshot-head"]')?.content
					window.headSnapshotCSS = getComputedStyle(document.documentElement).getPropertyValue('--snapshot-css-ready').trim()
				}).catch(() => {})
				return transition
			}
		})
		await page.goBack()
		await page.waitForFunction(() => document.querySelector('link[href="/__snapshot-test.css"]'), null, { polling: 25, timeout: 1000 })
		assert.equal(await page.evaluate(() => window.headSnapshotReady), false, 'late stylesheets must settle before the snapshots start moving')
		releaseCSS()
		await page.waitForFunction(() => window.headSnapshotReady && !document.documentElement.hasAttribute('data-article-transition'))
		assert.equal(await page.evaluate(() => window.headSnapshotMeta), 'ready')
		assert.equal(await page.evaluate(() => window.headSnapshotCSS), '1')
	}
	finally {
		releaseCSS?.()
		await context.close()
	}
})

test('the first article after a full refresh keeps its animation across cold page and stylesheet loading', async () => {
	const { context, page } = await open()
	let releaseCSS
	try {
		await page.reload()
		await page.waitForFunction(() => document.querySelector('#blog-root')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false)
		const css = new Promise(resolve => releaseCSS = resolve)
		await page.route('**/__cold-article.css', async (route) => {
			await css
			await route.fulfill({ contentType: 'text/css', body: ':root { --cold-article-ready: 1 }' })
		})
		await page.evaluate(() => {
			const nuxt = document.querySelector('#blog-root').__vue_app__.config.globalProperties.$nuxt
			window.coldEvents = []
			nuxt.hook('page:start', () => {
				window.coldEvents.push(['start', performance.now()])
				return new Promise(resolve => window.releaseColdPage = resolve)
			})
			nuxt.hook('page:finish', () => {
				window.coldEvents.push(['finish', performance.now()])
				nuxt.vueApp.config.globalProperties.$head.push({ link: [{ rel: 'stylesheet', href: '/__cold-article.css' }] })
			})
			window.coldTransitionState = 'pending'
			const start = document.startViewTransition.bind(document)
			document.startViewTransition = (update) => {
				window.coldEvents.push(['snapshot', performance.now()])
				const transition = start(async () => {
					await update()
					window.coldEvents.push(['updated', performance.now(), !!document.querySelector('.post-header')])
				})
				transition.ready.then(() => window.coldTransitionState = 'ready').catch(() => window.coldTransitionState = 'skipped')
				return transition
			}
		})
		await page.locator('.article-card').first().click()
		await page.waitForFunction(() => window.releaseColdPage, null, { polling: 25 })
		// Loading indicators can finish while the route's Suspense is still pending.
		await page.evaluate(() => document.querySelector('#blog-root').__vue_app__.config.globalProperties.$nuxt.callHook('page:loading:end'))
		await page.waitForTimeout(600)
		assert.equal(await page.evaluate(() => window.coldTransitionState), 'ready', `the lightweight header must finish before the cold page hook: ${JSON.stringify(await page.evaluate(() => window.coldEvents))}`)
		await page.evaluate(() => window.releaseColdPage())
		await page.waitForFunction(() => document.querySelector('link[href="/__cold-article.css"]'), null, { polling: 25 })
		await page.waitForTimeout(600)
		assert.equal(await page.evaluate(() => window.coldTransitionState), 'ready', 'body stylesheets must not hold the header snapshot')
		releaseCSS()
		await page.waitForFunction(() => window.coldTransitionState !== 'pending' && !document.documentElement.hasAttribute('data-article-transition'))
		assert.equal(await page.evaluate(() => window.coldTransitionState), 'ready')
		assert.equal(await page.locator('html').evaluate(e => getComputedStyle(e).getPropertyValue('--cold-article-ready').trim()), '1')
	}
	finally {
		releaseCSS?.()
		await context.close()
	}
})

test('a stalled return hero falls back to the page entrance instead of being marked as already animated', async () => {
	const { context, page } = await open()
	try {
		await page.locator('.article-card').first().click()
		await page.locator('.article:visible').waitFor()
		await page.waitForFunction(() => !document.documentElement.hasAttribute('data-article-transition'))
		await page.evaluate(() => {
			const decode = HTMLImageElement.prototype.decode
			HTMLImageElement.prototype.decode = function () {
				if (this.closest('.article-card')) {
					window.heroPreparationPending = true
					return new Promise(() => {})
				}
				return decode.call(this)
			}
			const start = document.startViewTransition.bind(document)
			document.startViewTransition = (update) => {
				const transition = start(async () => {
					await update()
					window.fallbackUpdateFinished = true
				})
				transition.ready.catch(() => window.fallbackSkipped = true)
				return transition
			}
		})
		await page.goBack()
		await page.waitForFunction(() => window.heroPreparationPending, null, { polling: 25 })
		await page.waitForFunction(() => window.fallbackSkipped && window.fallbackUpdateFinished && !document.documentElement.hasAttribute('data-article-transition'), null, { polling: 25, timeout: 4000 })
		const header = page.locator('.article-card').first()
		assert.equal(await header.getAttribute('data-native-entered'), null, 'skipping before ready must leave the ordinary entrance available')
		assert.equal(await header.evaluate(e => getComputedStyle(e).animationName), 'float-in')
		await page.waitForTimeout(350)
		assert.equal(await header.evaluate(e => getComputedStyle(e).opacity), '1')
		assert.equal(await page.locator('[data-article-source]').count(), 0)
	}
	finally { await context.close() }
})

test('article snapshots prepare the hero image and visible body before moving, and cancel pending decoding safely', async () => {
	const { context, page } = await open()
	try {
		// Warm Vite's article module graph before testing the bounded preparation phase.
		await page.locator('.article-card').first().click()
		await page.locator('.article:visible').waitFor()
		await page.waitForFunction(() => !document.documentElement.hasAttribute('data-article-transition'))
		await page.evaluate(() => {
			window.heroDecodeRequests = 0
			window.heroReady = false
			window.completedUpdates = []
			window.startedUpdates = 0
			const decode = HTMLImageElement.prototype.decode
			HTMLImageElement.prototype.decode = function () {
				if (window.holdHomeImage && this.closest('.article-card')) {
					window.pendingCardImage = this
					window.loadingDuringDecode = this.loading
					return new Promise(() => {})
				}
				if (!this.closest('.article-card'))
					return decode.call(this)
				window.heroDecodeRequests++
				return new Promise(resolve => window.releaseHeroImage = resolve)
			}
			const start = document.startViewTransition.bind(document)
			document.startViewTransition = (update) => {
				window.heroReady = false
				const id = ++window.startedUpdates
				const transition = start(async () => {
					await update()
					window.completedUpdates.push(id)
				})
				transition.ready.then(() => {
					window.heroReady = true
					const main = document.getElementById('main-content')
					window.bodySnapshotClip = getComputedStyle(main).clipPath
					const inset = document.documentElement.style.getPropertyValue('--article-body-clip').slice(6, -1).trim().split(/\s+/)
					if (inset.length >= 4) {
						const rect = main.getBoundingClientRect()
						window.bodySnapshotSides = { left: rect.left + Number.parseFloat(inset.at(-1)), right: rect.right - Number.parseFloat(inset[1]) }
					}
				}).catch(() => {})
				return transition
			}
		})
		await page.goBack()
		// Native capture suspends rAF; poll on timers while image preparation waits.
		await page.waitForFunction(() => window.heroDecodeRequests === 1, null, { polling: 25, timeout: 1000 })
		assert.equal(await page.evaluate(() => window.heroReady), false, 'the head image must be decoded before animation playback')
		await page.evaluate(() => window.releaseHeroImage())
		await page.waitForFunction(() => window.heroReady && !document.documentElement.hasAttribute('data-article-transition'))
		assert.notEqual(await page.evaluate(() => window.bodySnapshotClip), 'none', 'the body snapshot must clip offscreen raster work')
		assert.deepEqual(await page.evaluate(() => window.bodySnapshotSides), { left: 0, right: 1440 }, 'the viewport clip must preserve fixed descendants and shadows outside the main column')
		assert.equal(await page.locator('#main-content').evaluate(e => getComputedStyle(e).clipPath), 'none', 'temporary viewport clipping must be removed')
		await page.locator('.article-card').first().click()
		await page.locator('.article:visible').waitFor()
		await page.waitForFunction(() => !document.documentElement.hasAttribute('data-article-transition'))
		await page.evaluate(() => window.holdHomeImage = true)
		await page.goBack()
		await page.waitForFunction(() => window.pendingCardImage, null, { polling: 25, timeout: 1000 })
		assert.equal(await page.evaluate(() => window.loadingDuringDecode), 'eager', 'a lazy shared image must start loading while rendering is suspended')
		await page.evaluate(() => document.querySelector('#blog-root').__vue_app__.config.globalProperties.$nuxt.$router.push('/archive'))
		await page.waitForURL('**/archive')
		await page.waitForFunction(() => window.completedUpdates.includes(3) && !document.documentElement.hasAttribute('data-article-transition'))
		assert.equal(await page.evaluate(() => window.pendingCardImage.loading), 'lazy', 'cancelling must restore lazy loading even if decoding never settles')
		assert.equal(await page.locator('html').evaluate(e => e.style.getPropertyValue('--article-body-clip')), '')
		assert.equal(await page.locator('#main-content').evaluate(e => getComputedStyle(e).clipPath), 'none')
	}
	finally { await context.close() }
})

for (const width of [375, 1440]) {
	test(`search renders a bounded first batch and retains keyboard access to later results at ${width}px`, async () => {
		const { context, page } = await open('/', width)
		try {
			await page.keyboard.press('Meta+k')
			await page.locator('.search-input').fill('的')
			await page.locator('.search-item').first().waitFor()
			assert.ok(await page.locator('.search-item').count() <= 24, 'offscreen results must not all mount during the reveal')
			for (let i = 0; i < 25; i++)
				await page.keyboard.press('ArrowDown')
			assert.equal(await page.locator('.search-item.active').getAttribute('data-result-id'), await page.locator('.search-item').nth(25).getAttribute('data-result-id'))
			assert.ok(await page.locator('.search-item.active').evaluate((e) => {
				const box = e.getBoundingClientRect()
				const list = e.parentElement.getBoundingClientRect()
				return box.top >= list.top && box.bottom <= list.bottom
			}))
			const before = await page.locator('.search-item').count()
			await page.locator('.search-result').evaluate(e => e.scrollTop = e.scrollHeight)
			await page.waitForFunction(count => document.querySelectorAll('.search-item').length > count, before)
			await page.locator('.search-input').fill('xxxxxzzz')
			await page.locator('.no-result').waitFor()
			await page.keyboard.press('Escape')
			await page.waitForFunction(() => !document.querySelector('.blog-search'))
		}
		finally { await context.close() }
	})

	test(`article round trip keeps all snapshot animation on compositor properties at ${width}px`, async () => {
		const { context, page } = await open('/', width)
		try {
			await page.evaluate(() => {
				window.articleSnapshots = []
				const start = document.startViewTransition.bind(document)
				document.startViewTransition = (update) => {
					const source = document.querySelector('[data-article-source]')
					const sourceRect = source.getBoundingClientRect().toJSON()
					const panelRect = document.getElementById('blog-panel').getBoundingClientRect().toJSON()
					const transition = start(update)
					transition.ready.then(() => {
						const animations = document.getAnimations().filter(a => a.effect?.pseudoElement?.includes('article-'))
						const moving = animations.filter(a => a.effect.pseudoElement.includes('group(') || a.effect.pseudoElement.includes('image-pair('))
						moving.forEach((a) => {
							a.pause()
							a.currentTime = 0
						})
						const group = getComputedStyle(document.documentElement, '::view-transition-group(article-hero)')
						const matrix = new DOMMatrix(group.transform)
						const panelGroup = getComputedStyle(document.documentElement, '::view-transition-group(article-panel)')
						const panelMatrix = new DOMMatrix(panelGroup.transform)
						const panelEndKey = animations.find(a => a.effect.pseudoElement === '::view-transition-group(article-panel)')?.effect.getKeyframes().at(-1)
						const panelEndMatrix = new DOMMatrix(panelEndKey?.transform || panelGroup.transform)
						window.articleSnapshots.push({
							animations: animations.map(a => ({ pseudo: a.effect.pseudoElement, keys: a.effect.getKeyframes() })),
							sourceRect,
							panelRect,
							panelTargetRect: document.getElementById('blog-panel').getBoundingClientRect().toJSON(),
							startRect: { left: matrix.e, top: matrix.f, width: Number.parseFloat(group.width) * matrix.a, height: Number.parseFloat(group.height) * matrix.d },
							panelStartRect: { left: panelMatrix.e, top: panelMatrix.f, width: Number.parseFloat(panelGroup.width) * panelMatrix.a, height: Number.parseFloat(panelGroup.height) * panelMatrix.d },
							panelEndRect: { left: panelEndMatrix.e, top: panelEndMatrix.f, width: Number.parseFloat(panelGroup.width) * panelEndMatrix.a, height: Number.parseFloat(panelGroup.height) * panelEndMatrix.d },
						})
						moving.forEach(a => a.play())
					})
					return transition
				}
			})
			await page.locator('.article-card').first().click()
			await page.waitForFunction(() => window.articleSnapshots.length === 1 && !document.documentElement.hasAttribute('data-article-transition'))
			await page.locator('.article:visible').waitFor()
			await page.goBack()
			await page.waitForFunction(() => window.articleSnapshots.length === 2 && !document.documentElement.hasAttribute('data-article-transition'))
			const snapshots = await page.evaluate(() => window.articleSnapshots)
			for (const { animations, sourceRect, startRect, panelRect, panelStartRect, panelTargetRect, panelEndRect } of snapshots) {
				const hero = animations.find(a => a.pseudo === '::view-transition-group(article-hero)')
				assert.ok(hero?.keys.some(key => key.transform), 'the card/header must still morph in both directions')
				assert.ok(hero.keys.every(key => !('width' in key) && !('height' in key)), 'size interpolation must not force layout every frame')
				if (['left', 'top', 'width', 'height'].every(key => Math.abs(panelRect[key] - panelTargetRect[key]) < 0.1))
					assert.ok(!animations.some(a => a.pseudo === '::view-transition-group(article-panel)'), 'stationary floating controls must not start a redundant snapshot animation')
				const allowed = new Set(['offset', 'computedOffset', 'easing', 'composite', 'transform', 'opacity'])
				for (const animation of animations) {
					for (const key of animation.keys)
						assert.ok(Object.keys(key).every(property => allowed.has(property)), `${animation.pseudo} must not animate paint or layout properties: ${Object.keys(key).join(', ')}`)
				}
				for (const property of ['left', 'top', 'width', 'height']) {
					assert.ok(Math.abs(startRect[property] - sourceRect[property]) < 1, `shared hero must start at the actual ${property}`)
					if (panelRect.width && panelRect.height)
						assert.ok(Math.abs(panelStartRect[property] - panelRect[property]) < 1, `floating controls must start at the actual ${property}`)
					if (panelTargetRect.width && panelTargetRect.height)
						assert.ok(Math.abs(panelEndRect[property] - panelTargetRect[property]) < 1, `floating controls must finish at the actual ${property}`)
				}
			}
			assert.equal(await page.locator('[data-article-source]').count(), 0)
			assert.equal(await page.locator('.article-card').first().evaluate(e => getComputedStyle(e).animationName), 'none', 'native entrances must not replay after snapshots')
		}
		finally { await context.close() }
	})
}

test('search fills additional batches when the initial results do not overflow', async () => {
	const { context, page } = await open()
	try {
		await page.keyboard.press('Meta+k')
		await page.locator('.search-input').fill('的')
		await page.locator('.search-item').first().waitFor()
		await page.setViewportSize({ width: 1440, height: 16000 })
		await page.waitForFunction(() => document.querySelectorAll('.search-item').length > 24)
	}
	finally { await context.close() }
})

test('the travel map veil animates locally without invalidating the article descendants', async () => {
	const { context, page } = await open('/travels/kansai-202504')
	try {
		await page.waitForFunction(() => document.querySelector('.map-cover') && document.querySelector('.maplibregl-canvas'))
		await page.keyboard.press('ArrowDown')
		await page.waitForTimeout(900)
		const styles = await page.evaluate(() => {
			const root = document.querySelector('.travel-editorial')
			const cover = root.querySelector('.map-cover')
			return { root: root.style.getPropertyValue('--travel-map-fade-start'), local: cover.style.getPropertyValue('--travel-map-fade-start'), child: getComputedStyle(root.querySelector('.story-photo')).getPropertyValue('--travel-map-fade-start'), transition: getComputedStyle(cover).transitionProperty }
		})
		assert.equal(styles.root, '', 'a map-only animated value must not be written to the article root')
		assert.ok(styles.local.endsWith('px'))
		assert.equal(styles.child.trim(), '0px', 'the animated value must not inherit into article content')
		assert.ok(styles.transition.includes('--travel-map-fade-start'), 'the map edge must retain its smooth transition')
	}
	finally { await context.close() }
})

for (const [width, motion] of [[375, 'native'], [1440, 'native'], [375, 'reduce'], [375, 'unsupported']]) {
	test(`a scrolled article round trip restores the home viewport at ${width}px with ${motion} motion`, async () => {
		const { context, page } = await open('/', width, 1, motion)
		try {
			const card = page.locator('.article-card').nth(3)
			await card.scrollIntoViewIfNeeded()
			await page.waitForTimeout(500)
			const before = await page.evaluate(() => window.scrollY)
			await card.click()
			await page.waitForFunction(() => document.querySelector('.post-header') && !document.documentElement.hasAttribute('data-article-transition'))
			await page.locator('.article:visible').waitFor()
			await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' }))
			await page.goBack()
			await page.waitForFunction(() => document.querySelector('.article-card') && !document.documentElement.hasAttribute('data-article-transition'))
			await page.waitForFunction(top => Math.abs(window.scrollY - top) < 2, before)
			assert.ok(Math.abs(await page.evaluate(() => window.scrollY) - before) < 2)
		}
		finally { await context.close() }
	})
}

test('interrupting an article transition releases the snapshot and leaves the next route usable', async () => {
	const { context, page } = await open()
	try {
		await page.locator('.article-card').first().click()
		await page.waitForFunction(() => document.documentElement.hasAttribute('data-article-transition'))
		await page.evaluate(() => document.querySelector('#blog-root').__vue_app__.config.globalProperties.$nuxt.$router.push('/archive'))
		await page.waitForURL('**/archive')
		await page.locator('.article-link').first().waitFor()
		await page.waitForFunction(() => !document.documentElement.hasAttribute('data-article-transition'))
		assert.equal(await page.locator('[data-article-source]').count(), 0)
		assert.deepEqual(await page.locator('html').evaluate(e => ['--article-hero-from', '--article-hero-to', '--article-panel-from', '--article-panel-to', '--article-panel-motion'].map(name => e.style.getPropertyValue(name))), ['', '', '', '', ''])
		await page.locator('.article-link').first().click()
		await page.locator('.post-header').waitFor()
	}
	finally { await context.close() }
})

for (const mode of ['reduce', 'unsupported']) {
	test(`article navigation remains usable with ${mode} view transitions`, async () => {
		const context = await browser.newContext({ baseURL, reducedMotion: mode === 'reduce' ? 'reduce' : 'no-preference' })
		await isolateExternalRequests(context, baseURL)
		const page = await context.newPage()
		try {
			await page.addInitScript((mode) => {
				window.snapshotCalls = 0
				const start = document.startViewTransition?.bind(document)
				document.startViewTransition = mode === 'unsupported'
					? undefined
					: (...args) => {
							window.snapshotCalls++
							return start(...args)
						}
			}, mode)
			await page.goto('/')
			await page.waitForFunction(() => document.querySelector('#blog-root')?.__vue_app__?.config.globalProperties.$nuxt?.isHydrating === false)
			await page.locator('.article-card').first().click()
			await page.locator('.article:visible').waitFor()
			await page.goBack()
			await page.locator('.article-card').first().waitFor()
			assert.equal(await page.evaluate(() => window.snapshotCalls), 0)
			assert.equal(await page.locator('html[data-article-transition]').count(), 0)
		}
		finally { await context.close() }
	})
}
