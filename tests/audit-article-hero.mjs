import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import process from 'node:process'

// Run alone, without another browser audit or build competing for CPU/GPU.
// MOTION_BASE_URL=http://127.0.0.1:3000 PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/audit-article-hero.mjs
async function main() {
	const baseURL = process.env.MOTION_BASE_URL || 'http://127.0.0.1:3000'
	const output = process.env.MOTION_OUTPUT || 'docs/animation-audit/article-hero'
	const rate = Number(process.env.MOTION_CPU_RATE || 4)
	const rounds = Number(process.env.MOTION_ROUNDS || 6)
	const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
	const browser = await chromium.launch({
		headless: true,
		...(process.platform === 'darwin' ? { channel: 'chromium', args: ['--enable-gpu', '--use-angle=metal'] } : {}),
	})
	await mkdir(output, { recursive: true })
	const system = await (await browser.newBrowserCDPSession()).send('SystemInfo.getInfo')
	const results = { baseURL, rate, rounds, external: process.env.MOTION_EXTERNAL === '1', gpu: system.gpu.devices, configurations: [] }

	function summarizeTrace(events) {
		const active = new Map()
		const heroes = []
		const failures = []
		for (const event of events) {
			if (event.name !== 'Animation')
				continue
			const key = `${event.pid}/${event.id2?.local ?? event.id}`
			const data = event.args?.data
			if (event.ph === 'b') {
				active.set(key, event)
			}
			else if (event.ph === 'e') {
				const begin = active.get(key)
				if (begin?.args.data.nodeName === '::view-transition-group(article-hero)')
					heroes.push({ pid: begin.pid, start: begin.ts, end: event.ts })
				active.delete(key)
			}
			else if (data?.compositeFailed && active.get(key)?.args.data.nodeName?.startsWith('::view-transition-') && active.get(key)?.args.data.nodeName?.includes('article-')) {
				failures.push({ target: active.get(key).args.data.nodeName, ...data })
			}
		}
		const playback = heroes.map(({ pid, start, end }) => {
			const frames = new Map()
			let paintMs = 0
			for (const event of events) {
				if (event.pid !== pid || event.ts < start || event.ts >= end)
					continue
				if (event.name === 'Paint')
					paintMs += (event.dur || 0) / 1000
				if (event.name === 'PipelineReporter' && event.ph === 'b') {
					const frame = event.args.frame_reporter
					const key = `${frame.frame_source}/${frame.frame_sequence}`
					const states = frames.get(key) || new Set()
					states.add(frame.state)
					frames.set(key, states)
				}
			}
			// A forked main-frame report may say dropped even when that same display
			// frame was presented by the compositor. Count each sequence only once.
			const states = [...frames.values()]
			return {
				presented: states.filter(s => s.has('STATE_PRESENTED_ALL') || s.has('STATE_PRESENTED_PARTIAL')).length,
				dropped: states.filter(s => s.has('STATE_DROPPED') && !s.has('STATE_PRESENTED_ALL') && !s.has('STATE_PRESENTED_PARTIAL')).length,
				paintMs,
			}
		})
		return { playback, failures }
	}

	try {
		for (const [width, height, dpr] of [[1440, 1000, 2], [375, 812, 3]]) {
			const context = await browser.newContext({ baseURL, viewport: { width, height }, deviceScaleFactor: dpr, locale: 'zh-CN' })
			// Keep real covers. MOTION_EXTERNAL=1 also keeps live APIs, fonts and the
			// normal HTTP cache (request interception otherwise disables that cache).
			if (process.env.MOTION_EXTERNAL !== '1')
				await context.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL).origin || route.request().resourceType() === 'image' ? route.continue() : route.abort())
			const page = await context.newPage()
			const errors = []
			page.on('pageerror', error => errors.push(error.message))
			await page.addInitScript(() => {
				window.heroSamples = []
				const start = document.startViewTransition.bind(document)
				document.startViewTransition = (update) => {
					const sample = { start: performance.now(), frames: [] }
					window.heroSamples.push(sample)
					const transition = start(update)
					transition.ready.then(() => {
						sample.ready = performance.now()
						sample.domAnimations = document.getAnimations().filter(a => !a.effect?.pseudoElement && a.playState === 'running').map(a => a.animationName || a.transitionProperty)
						function tick(time) {
							// The first delivered rAF can retain a pre-capture timestamp.
							if (time >= sample.ready)
								sample.frames.push(time)
							if (!sample.finished)
								requestAnimationFrame(tick)
						}
						requestAnimationFrame(tick)
					}).catch(error => sample.error = String(error))
					transition.finished.then(() => sample.finished = performance.now())
					return transition
				}
			})
			const cdp = await context.newCDPSession(page)
			await cdp.send('Emulation.setCPUThrottlingRate', { rate })
			await page.goto('/')
			await page.waitForFunction(() => document.querySelector('.z-slide-body[data-ready]'))
			await page.waitForTimeout(600)
			await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,blink.animations,cc,benchmark', transferMode: 'ReturnAsStream' })
			for (let round = 0; round < rounds; round++) {
				await page.locator('.article-card').nth(round % 3).click()
				await page.waitForFunction(() => document.querySelector('.post-header') && !document.documentElement.hasAttribute('data-article-transition'))
				await page.locator('.article:visible').waitFor()
				await page.waitForTimeout(150)
				await page.goBack()
				await page.waitForFunction(() => document.querySelector('.article-card') && !document.documentElement.hasAttribute('data-article-transition'))
				await page.waitForTimeout(150)
			}
			const samples = await page.evaluate(() => window.heroSamples)
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
			const summary = summarizeTrace(JSON.parse(trace).traceEvents)
			const configuration = { width, dpr, errors, ...summary, samples: samples.map(({ frames, ...sample }, index) => {
				const intervals = frames.slice(1).map((t, i) => t - frames[i]).sort((a, b) => a - b)
				return { ...sample, direction: index % 2 ? 'back' : 'enter', captureMs: sample.ready - sample.start, frames: frames.length, p95Ms: intervals[Math.floor(intervals.length * 0.95)] || 0, maxMs: intervals.at(-1) || 0 }
			}) }
			results.configurations.push(configuration)
			process.stdout.write(`${JSON.stringify({ width, dpr, errors, dropped: summary.playback.map(p => p.dropped), maxMs: configuration.samples.map(s => s.maxMs), nonCompositedSnapshots: [...new Set(summary.failures.map(f => f.target))] })}\n`)
			await context.close()
			assert.equal(errors.length, 0)
			assert.equal(samples.length, rounds * 2, 'every navigation must actually exercise the shared snapshots')
			assert.ok(samples.every(s => s.finished && !s.error), 'all transitions must complete')
		}
	}
	finally {
		await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2))
		await browser.close()
	}
}

main().catch((error) => {
	console.error(error)
	process.exitCode = 1
})
