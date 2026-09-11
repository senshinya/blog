import blogConfig from '~~/blog.config'
import { stripLocale } from './locale'

const locales = blogConfig.locales.map(locale => locale.code)
let stopPrevious: (() => void) | undefined
let sequence = 0

/**
 * B: snapshots keep asynchronous locale navigation atomic, without cloning live
 * Vue nodes or fading images. Names are paired by content path, never card order.
 */
export async function runLocaleMotion(update: () => Promise<void>) {
	const current = ++sequence
	stopPrevious?.()
	if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
		await update()
		return
	}
	if (!document.startViewTransition || !CSS.supports('view-transition-class', 'locale-copy')) {
		await update()
		if (current === sequence)
			return animateFallback()
		return
	}

	const root = document.documentElement
	const names = new Map<string, string>()
	const styles = new Map<HTMLElement, string>()
	const texts = new Map<string, string>()
	const anchors = new Map<string, { top: number, bottom: number }>()
	let anchor: string | undefined
	let anchorTop = 0

	function collect(restoreAnchor = false) {
		const candidates = new Map<HTMLElement, { el: HTMLElement, key: string, kind: string }>()
		const mark = (el: HTMLElement, key: string, kind: string) => {
			if (!candidates.has(el))
				candidates.set(el, { el, key, kind })
		}
		const select = (selector: string, kind: string, prefix: string) => {
			document.querySelectorAll<HTMLElement>(selector).forEach((el, index) => mark(el, `${prefix}-${index}`, kind))
		}
		select('.sidebar-nav .nav-text, .sidebar-nav h3', 'locale-nav', 'nav')
		select('.widget-header, .filter-text, .post-info, .post-nav .operations, .archive-info, .age-label, .blog-footer hgroup, .blog-footer .nav-text, .header-subtitle, .toc a, .blog-widget:not(.blog-stats) dt', 'locale-label', 'label')
		select('.blog-stats dt, .blog-stats dd', 'locale-metric', 'stat')
		select('.post-title, .travels-header > h1, .feed-title, .travel-cover-title, .travel-day-title', 'locale-heading', 'heading')
		select('.md-excerpt .dynamic, .travels-desc, .travel-cover-subtitle, .travel-cover-desc, .travel-para', 'locale-body', 'intro')
		select('.series-summary', 'locale-label', 'series-summary')
		select('.series-details[open] .series-chapters a', 'locale-body', 'series-chapter')
		select('.series-details[open] .series-overview', 'locale-label', 'series-overview')
		select('.series-neighbors a', 'locale-body', 'series-neighbor')
		document.querySelectorAll<HTMLElement>('#main-content > .article > *').forEach((el, index) => {
			mark(el, `body-${index}`, el.matches('pre') ? 'locale-stable' : 'locale-body')
		})
		select('.post-cover, .travel-photos, .travel-map-col, #main-content > .article img', 'locale-stable', 'media')
		select('.reading-preferences', 'locale-stable', 'preferences')
		document.querySelectorAll<HTMLElement>('.z-comment .comment').forEach((comment) => {
			mark(comment, comment.id, 'locale-stable')
		})

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

		// Translation can move the anchor outside the viewport. Restore its scroll
		// position first so visibility uses the final viewport, including fixed UI.
		if (restoreAnchor && anchor) {
			const target = [...candidates.values()].find(candidate => candidate.key === anchor)
			if (target)
				window.scrollBy({ top: target.el.getBoundingClientRect().top - anchorTop, behavior: 'instant' })
		}
		anchors.clear()
		const snapshots = []
		for (const candidate of candidates.values()) {
			const { el, key } = candidate
			const rect = el.getBoundingClientRect()
			if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= window.innerHeight
				|| rect.right <= 0 || rect.left >= window.innerWidth || getComputedStyle(el).visibility === 'hidden') {
				continue
			}
			if (el.closest('#main-content'))
				anchors.set(key, { top: rect.top, bottom: rect.bottom })
			snapshots.push({ ...candidate, text: el.textContent ?? '', style: el.style.cssText })
		}
		// Finish geometry/computed-style reads before mutating any live styles.
		// Long articles only allocate snapshots for content intersecting the viewport.
		for (const { el, key, kind, text, style } of snapshots) {
			if (!names.has(key))
				names.set(key, `locale-${names.size}`)
			const unchanged = texts.get(key) === text
			texts.set(key, text)
			styles.set(el, style)
			el.style.setProperty('view-transition-name', names.get(key)!)
			el.style.setProperty('view-transition-class', `locale-part ${unchanged ? 'locale-stable' : kind}`)
		}
	}

	function restoreStyles() {
		for (const [el, style] of styles)
			el.style.cssText = style
		styles.clear()
	}

	collect()
	// Discussions have gaps between rows; prefer the first visible comment even
	// when the paragraph anchor line falls in a gap.
	for (const [key, rect] of anchors) {
		if (key.startsWith('comment-') && rect.top >= 0 && rect.top < window.innerHeight) {
			anchor = key
			anchorTop = rect.top
			break
		}
	}
	// Keep the paragraph/card crossing the top edge in place as translations reflow.
	if (!anchor) {
		for (const [key, rect] of anchors) {
			if (rect.top <= 80 && rect.bottom > 80 && (!anchor || rect.top > anchorTop)) {
				anchor = key
				anchorTop = rect.top
			}
		}
	}
	root.classList.add('locale-motion')
	let stopped = false
	const transition = document.startViewTransition(async () => {
		await update()
		restoreStyles()
		if (stopped)
			return
		collect(true)
	})
	const stop = () => {
		if (stopped)
			return
		stopped = true
		transition.skipTransition()
		restoreStyles()
		// Removing --entrance: none must not restart entrances after the snapshot.
		document.querySelectorAll<HTMLElement>('[data-transition-enter]')
			.forEach(element => element.dataset.nativeEntered = '')
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

/** Older browsers use the same short text fade without translating glyphs. */
async function animateFallback() {
	const selectors = [
		'.sidebar-nav .nav-text',
		'.widget-header, .blog-stats dt, .blog-stats dd, .filter-text',
		'.post-title, .travels-header > h1',
		'.series-summary, .series-details[open] .series-chapters a, .series-details[open] .series-overview, .series-neighbors a',
		'#main-content > .article > :not(pre):not(figure):not(:has(img)), .md-excerpt .dynamic, .travels-desc',
		'.article-title, .article-description, .article-info, .travel-title, .travel-subtitle, .travel-summary, .travel-meta',
	]
	const candidates = new Set(selectors.flatMap(selector => [...document.querySelectorAll<HTMLElement>(selector)]))
	const visible = [...candidates].filter((el) => {
		const rect = el.getBoundingClientRect()
		return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight
			&& rect.right > 0 && rect.left < window.innerWidth && getComputedStyle(el).visibility !== 'hidden'
	})
	const animations = visible.map(el => el.animate([
		{ opacity: 0 },
		{ opacity: 1 },
	], { duration: 140, fill: 'backwards' }))
	const stop = () => animations.forEach(animation => animation.cancel())
	stopPrevious = stop
	await Promise.allSettled(animations.map(animation => animation.finished))
	if (stopPrevious === stop)
		stopPrevious = undefined
}
