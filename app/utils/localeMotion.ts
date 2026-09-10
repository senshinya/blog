import blogConfig from '~~/blog.config'
import { stripLocale } from './locale'

const locales = blogConfig.locales.map(locale => locale.code)
let stopPrevious: (() => void) | undefined

/**
 * B: snapshots keep asynchronous locale navigation atomic, without cloning live
 * Vue nodes or fading images. Names are paired by content path, never card order.
 */
export async function runLocaleMotion(update: () => Promise<void>) {
	stopPrevious?.()
	if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
		await update()
		return
	}
	if (!document.startViewTransition || !CSS.supports('view-transition-class', 'locale-copy')) {
		await update()
		return animateFallback()
	}

	const root = document.documentElement
	const names = new Map<string, string>()
	const styles = new Map<HTMLElement, string>()
	const texts = new Map<string, string>()
	const anchors = new Map<string, { top: number, bottom: number }>()
	let anchor: string | undefined
	let anchorTop = 0

	function mark(el: HTMLElement, key: string, kind: string) {
		if (styles.has(el))
			return
		const rect = el.getBoundingClientRect()
		if (!rect.width || !rect.height || getComputedStyle(el).visibility === 'hidden')
			return
		if (!names.has(key))
			names.set(key, `locale-${names.size}`)
		const text = el.textContent ?? ''
		// Identical source text (dates, code, untranslated memos) does not blink.
		const unchanged = texts.get(key) === text
		texts.set(key, text)
		styles.set(el, el.style.cssText)
		el.style.setProperty('view-transition-name', names.get(key)!)
		el.style.setProperty('view-transition-class', `locale-part ${unchanged ? 'locale-stable' : kind}`)
		if (el.closest('#main-content'))
			anchors.set(key, { top: rect.top, bottom: rect.bottom })
	}

	function collect() {
		const select = (selector: string, kind: string, prefix: string) => {
			document.querySelectorAll<HTMLElement>(selector).forEach((el, index) => mark(el, `${prefix}-${index}`, kind))
		}
		select('.sidebar-nav .nav-text, .sidebar-nav h3', 'locale-nav', 'nav')
		select('.widget-header, .filter-text, .post-info, .post-nav .operations, .archive-info, .age-label, .blog-footer hgroup, .blog-footer .nav-text, .header-subtitle, .toc a, .blog-widget:not(.blog-stats) dt', 'locale-label', 'label')
		select('.blog-stats dt, .blog-stats dd', 'locale-metric', 'stat')
		select('.post-title, .travels-header > h1, .feed-title, .travel-cover-title, .travel-day-title', 'locale-heading', 'heading')
		select('.md-excerpt .dynamic, .travels-desc, .travel-cover-subtitle, .travel-cover-desc, .travel-para', 'locale-body', 'intro')
		document.querySelectorAll<HTMLElement>('#main-content > .article > *').forEach((el, index) => {
			mark(el, `body-${index}`, el.matches('pre') ? 'locale-stable' : 'locale-body')
		})
		select('.post-cover, .travel-photos, .travel-map-col, #main-content > .article img', 'locale-stable', 'media')
		select('.reading-preferences', 'locale-stable', 'preferences')

		document.querySelectorAll<HTMLElement>('.article-card, .travel-card, .article-item').forEach((card, index) => {
			const link = card.matches('a') ? card : card.querySelector('a')
			const href = link?.getAttribute('href') ?? `item-${index}`
			const key = stripLocale(href, locales, 'zh').basePath
			mark(card, `card-${key}`, 'locale-surface')
			card.querySelectorAll<HTMLElement>('.article-title, .article-description, .article-info, .travel-title, .travel-subtitle, .travel-summary, .travel-meta').forEach((el, part) => {
				mark(el, `card-${key}-${part}`, `locale-copy locale-step-${Math.min(index, 2)}`)
			})
			card.querySelectorAll<HTMLElement>('.article-cover, .travel-cover').forEach((el, part) => mark(el, `image-${key}-${part}`, 'locale-stable'))
		})
	}

	function restoreStyles() {
		for (const [el, style] of styles)
			el.style.cssText = style
		styles.clear()
	}

	collect()
	// Keep the paragraph/card crossing the top edge in place as translations reflow.
	for (const [key, rect] of anchors) {
		if (rect.top <= 80 && rect.bottom > 80 && (!anchor || rect.top > anchorTop)) {
			anchor = key
			anchorTop = rect.top
		}
	}
	root.classList.add('locale-motion')
	let stopped = false
	const transition = document.startViewTransition(async () => {
		await update()
		restoreStyles()
		if (stopped)
			return
		collect()
		if (anchor && anchors.has(anchor))
			window.scrollBy({ top: anchors.get(anchor)!.top - anchorTop, behavior: 'instant' })
	})
	const stop = () => {
		if (stopped)
			return
		stopped = true
		transition.skipTransition()
		restoreStyles()
		root.classList.remove('locale-motion')
		if (stopPrevious === stop)
			stopPrevious = undefined
	}
	stopPrevious = stop
	// ready rejects when a resize, another navigation or the browser skips motion.
	void transition.ready.catch(() => {})
	void transition.finished.catch(() => {}).finally(stop)
	await transition.updateCallbackDone
}

/** Older browsers still get the short, module-specific entrance. */
async function animateFallback() {
	const groups: [string, number, number][] = [
		['.sidebar-nav .nav-text', 2, 120],
		['.widget-header, .blog-stats dt, .blog-stats dd, .filter-text', 0, 120],
		['.post-title, .travels-header > h1', 4, 220],
		['#main-content > .article > :not(pre):not(figure):not(:has(img)), .md-excerpt .dynamic, .travels-desc', 3, 220],
		['.article-card > article, .travel-card > article, .article-item .article-title', 6, 220],
	]
	const animations: Animation[] = []
	for (const [selector, distance, duration] of groups) {
		document.querySelectorAll<HTMLElement>(selector).forEach((el, index) => {
			const rect = el.getBoundingClientRect()
			if (rect.bottom < 0 || rect.top > window.innerHeight)
				return
			animations.push(el.animate([
				{ opacity: 0, transform: `translateY(${distance}px)` },
				{ opacity: 1, transform: 'translateY(0)' },
			], { duration, delay: distance === 6 ? Math.min(index, 2) * 18 : 0, fill: 'backwards' }))
		})
	}
	const stop = () => animations.forEach(animation => animation.cancel())
	stopPrevious = stop
	await Promise.allSettled(animations.map(animation => animation.finished))
	if (stopPrevious === stop)
		stopPrevious = undefined
}
