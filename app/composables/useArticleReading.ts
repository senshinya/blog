import type { ReadingHeading } from '~/utils/readingProgress'
import { activeReadingHeading, flattenReadingHeadings, readingPercent } from '~/utils/readingProgress'

/** One observer/listener set shared by the desktop widget and mobile controls. */
export const useArticleReading = createSharedComposable(() => {
	const { toc, dataKey } = useArticle()
	const desktop = useMediaQuery('(min-width: 1025px)')
	const reducedMotion = usePreferredReducedMotion()
	const headings = shallowRef<ReadingHeading[]>(flattenReadingHeadings(toc.value?.links ?? []))
	const percent = ref(0)
	const scrollPosition = ref(0)
	const activeId = ref('')
	const visibleRoots = shallowRef<string[]>([])
	const visibleIds = shallowRef<string[]>([])
	const reading = ref(false)
	const readingArea = ref(false)
	const scrollingDown = ref(false)
	const atEnd = ref(false)
	const ready = ref(false)
	const visibleMeters = shallowReactive(new Set<symbol>())
	const desktopMeterVisible = computed(() => visibleMeters.size > 0)
	const paused = ref(true)
	const activeRoot = computed(() => {
		const current = headings.value.find(heading => heading.id === activeId.value)
		return headings.value.find(heading => heading.id === current?.rootId)
	})
	let article: HTMLElement | null = null
	let geometry = { top: 0, height: 0, left: 0, right: 0 }
	let frame = 0
	let needsMeasure = true
	let previousScroll = 0
	let pointer: { x: number, y: number } | undefined
	let disposed = false
	let observer: ResizeObserver | undefined
	let rootObserver: MutationObserver | undefined

	function update() {
		frame = 0
		if (paused.value || disposed)
			return
		if (needsMeasure) {
			needsMeasure = false
			const nextArticle = document.querySelector<HTMLElement>('#main-content .article')
			if (nextArticle !== article) {
				if (article)
					observer?.unobserve(article)
				article = nextArticle
				if (article)
					observer?.observe(article)
			}
			if (!article?.getClientRects().length) {
				ready.value = false
				return
			}
			const bounds = article.getBoundingClientRect()
			geometry = { top: bounds.top + window.scrollY, height: bounds.height, left: bounds.left, right: bounds.right }
			headings.value = flattenReadingHeadings(toc.value?.links ?? []).flatMap((heading) => {
				const element = document.getElementById(heading.id)
				if (!element || !article?.contains(element))
					return []
				const headingBounds = element.getBoundingClientRect()
				const top = headingBounds.top + window.scrollY
				return [{ ...heading, top, height: headingBounds.height, ratio: Math.max(0, Math.min(1, (top - geometry.top) / Math.max(1, geometry.height))) }]
			})
			ready.value = true
		}
		const y = Math.max(0, window.scrollY)
		scrollPosition.value = y
		percent.value = readingPercent(y, geometry.top, geometry.height, window.innerHeight)
		updateReading(y)
		activeId.value = activeReadingHeading(headings.value, y, window.innerHeight)?.id ?? ''
		const visible = headings.value.filter(heading => heading.top + heading.height > y + 100 && heading.top < y + window.innerHeight - 100)
		const ids = visible.map(heading => heading.id)
		if (ids.join('\0') !== visibleIds.value.join('\0'))
			visibleIds.value = ids
		const roots = [...new Set(visible.map(heading => heading.rootId))]
		const current = headings.value.find(heading => heading.id === activeId.value)
		if (current && !roots.includes(current.rootId))
			roots.push(current.rootId)
		if (roots.join('\0') !== visibleRoots.value.join('\0'))
			visibleRoots.value = roots
		atEnd.value = y + window.innerHeight >= geometry.top + geometry.height - 1
		// The reference responds to each scroll direction change without a distance threshold.
		if (y !== previousScroll)
			scrollingDown.value = y > previousScroll
		previousScroll = y
	}

	function schedule(measure = false) {
		needsMeasure ||= measure
		if (!frame && !paused.value && !disposed)
			frame = requestAnimationFrame(update)
	}

	function updatePaused() {
		paused.value = document.hidden || document.documentElement.hasAttribute('data-article-transition')
			|| document.documentElement.classList.contains('locale-motion')
		if (paused.value) {
			cancelAnimationFrame(frame)
			frame = 0
		}
		else {
			schedule(true)
		}
	}

	function updateReading(scroll: number) {
		if (paused.value || disposed)
			return
		// The reference focuses on pointer entry. Our shorter header places the body
		// under the arrival pointer sooner; keep the directory until reading begins.
		readingArea.value = ready.value && desktop.value && scroll > 0 && geometry.top - scroll <= 100
		reading.value = readingArea.value && !!pointer
			&& pointer.x >= geometry.left && pointer.x <= geometry.right
			&& pointer.y + scroll >= geometry.top && pointer.y + scroll <= geometry.top + geometry.height
	}

	const pointerMove = useThrottleFn((event: MouseEvent) => {
		if (disposed || paused.value || !desktop.value || !ready.value)
			return
		pointer = { x: event.clientX, y: event.clientY }
		updateReading(window.scrollY)
	}, 300)

	function navigate(event: MouseEvent, id: string) {
		if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
			return
		const heading = document.getElementById(id)
		if (!heading)
			return
		event.preventDefault()
		// Keep the router's history state intact for animated back navigation.
		window.history.replaceState(window.history.state, '', `#${encodeURIComponent(id)}`)
		window.scrollTo({ top: heading.getBoundingClientRect().top + window.scrollY - 100, behavior: reducedMotion.value === 'reduce' ? 'instant' : 'smooth' })
		activeId.value = id
	}

	function backToTop() {
		window.scrollTo({ top: 0, behavior: reducedMotion.value === 'reduce' ? 'instant' : 'smooth' })
	}

	function setMeterVisible(owner: symbol, visible: boolean) {
		if (visible)
			visibleMeters.add(owner)
		else
			visibleMeters.delete(owner)
	}

	watch([toc, dataKey], () => {
		reading.value = false
		readingArea.value = false
		pointer = undefined
		scrollingDown.value = false
		ready.value = false
		needsMeasure = true
		if (import.meta.client)
			void nextTick(() => schedule(true))
	}, { flush: 'post' })

	onMounted(() => {
		previousScroll = window.scrollY
		observer = new ResizeObserver(() => schedule(true))
		const main = document.getElementById('main-content')
		if (main)
			observer.observe(main)
		rootObserver = new MutationObserver(updatePaused)
		rootObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-article-transition'] })
		updatePaused()
		void document.fonts.ready.then(() => schedule(true))
	})
	useEventListener('scroll', () => schedule(), { passive: true })
	useEventListener('resize', () => schedule(true), { passive: true })
	useEventListener('mousemove', pointerMove, { passive: true })
	if (import.meta.client) {
		useEventListener(document, 'visibilitychange', updatePaused)
		useEventListener(document, 'load', () => schedule(true), { capture: true, passive: true })
	}
	onScopeDispose(() => {
		disposed = true
		if (import.meta.client)
			cancelAnimationFrame(frame)
		observer?.disconnect()
		rootObserver?.disconnect()
	})

	return { headings, percent, scrollPosition, activeId, activeRoot, visibleRoots, visibleIds, reading, readingArea, scrollingDown, atEnd, ready, desktopMeterVisible, paused, desktop, reducedMotion, navigate, backToTop, setMeterVisible }
})
