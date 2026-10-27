import type { RouteLocationNormalized } from 'vue-router'
import type { ArticleArrival } from '~/composables/useArticleArrival'
import { renderDOMHead } from '@unhead/vue/client'
import { once } from 'es-toolkit/function'
import blogConfig from '~~/blog.config'
import { injectHead } from '#imports'
import { isLocaleSwitch, stripLocale } from '~/utils/locale'

/** 卡片与文章页头使用共享快照；栏目切换保留布局和 widget 的原生动画。 */
export default defineNuxtPlugin((nuxtApp) => {
	const router = useRouter()
	const { arrival } = useArticleArrival()
	const head = injectHead()
	const reducedMotion = usePreferredReducedMotion()
	const { emit } = useEventBus<'capture' | 'finish'>('page-transition')
	const root = document.documentElement
	const locales = blogConfig.locales.map(locale => locale.code)
	const positions = new Map<number, { left: number, top: number }>()
	const origins = new Map<number, string>()
	let restoreScrollBehavior = () => {}
	let restoreScrollAnchoring = () => {}
	// Nuxt replaces its initial scroll handler during app:created. Wrap the final
	// handler after mount, preserving the viewport from before the shell scrolls.
	const unhookScroll = nuxtApp.hook('app:mounted', () => {
		const scrollBehavior = router.options.scrollBehavior
		if (!scrollBehavior)
			return
		router.options.scrollBehavior = async (to, from, saved) => {
			restoreScrollAnchoring()
			const position = saved && positions.get(window.history.state?.position)
			if (!position)
				return scrollBehavior(to, from, saved)
			const previous = root.style.overflowAnchor
			root.style.overflowAnchor = 'none'
			const restore = once(() => root.style.overflowAnchor = previous)
			restoreScrollAnchoring = restore
			try {
				return await scrollBehavior(to, from, position)
			}
			finally {
				// A restored card's hover/entrance must not shift the browser's anchor.
				requestAnimationFrame(() => requestAnimationFrame(restore))
			}
		}
		restoreScrollBehavior = () => router.options.scrollBehavior = scrollBehavior
	})
	let position = window.history.state?.position as number
	let uaTransition = false
	let active: { to: string, cancel: () => void } | undefined

	useEventListener(window, 'popstate', (event) => {
		uaTransition = event.hasUAVisualTransition
	})

	function isVisible(element: HTMLElement) {
		const rect = element.getBoundingClientRect()
		return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight
			&& rect.right > 0 && rect.left < window.innerWidth && getComputedStyle(element).visibility !== 'hidden'
	}

	function findShared(path: string, preferred?: string) {
		const contentPath = (value: string) => normalizeContentPath(stripLocale(value, locales, 'zh').basePath)
		const candidates = Array.from(document.querySelectorAll<HTMLElement>('[data-transition-key]'))
			.filter(element => contentPath(element.dataset.transitionKey!) === contentPath(path) && isVisible(element))
		return candidates.find(element => element.dataset.articleTrigger !== undefined)
			?? (preferred ? candidates.find(element => element.matches(preferred)) : undefined)
			?? candidates[0]
	}

	function markHero(element: HTMLElement | undefined) {
		if (!element)
			return
		element.dataset.articleSource = ''
		const title = element.querySelector<HTMLElement>('.post-title, .article-title, .stable-info')
		if (title)
			title.dataset.articleTitle = ''
		return element.getBoundingClientRect()
	}

	function moveSnapshot(name: 'hero' | 'panel', from: DOMRect, to: DOMRect) {
		if (!from.width || !from.height || !to.width || !to.height)
			return
		// 固定快照尺寸，仅在合成层插值几何；不逐帧修改尺寸或裁剪。
		root.style.setProperty(`--article-${name}-from`, `translate(${from.left}px, ${from.top}px) scale(${from.width / to.width}, ${from.height / to.height})`)
		root.style.setProperty(`--article-${name}-to`, `translate(${to.left}px, ${to.top}px)`)
	}

	function clipBodySnapshot() {
		const main = document.getElementById('main-content')
		if (!main)
			return
		const { top, left, right } = main.getBoundingClientRect()
		// 正文可能有数万像素高；快照只栅格化视口，不改变真实布局与锚点坐标。
		// 横向也以视口为界，保留正文列外的 fixed 阅读进度与阴影。
		root.style.setProperty('--article-body-clip', `inset(${-top}px ${right - window.innerWidth}px calc(100% - ${window.innerHeight - top}px) ${-left}px)`)
	}

	async function prepareHead(cancelled: Promise<void>) {
		// Nuxt 延后更新 head；先应用文章字体样式，避免快照移动时才加载、重绘。
		const existing = new Set(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
		renderDOMHead(head)
		const unlisten: (() => void)[] = []
		try {
			const styles = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
				.filter(link => !existing.has(link) && !link.sheet)
			await Promise.race([
				Promise.all(styles.map(link => new Promise<void>((resolve) => {
					const done = () => resolve()
					link.addEventListener('load', done, { once: true })
					link.addEventListener('error', done, { once: true })
					unlisten.push(() => {
						link.removeEventListener('load', done)
						link.removeEventListener('error', done)
					})
				}))),
				cancelled,
			])
			await Promise.race([document.fonts.ready, cancelled])
		}
		finally {
			unlisten.forEach(stop => stop())
		}
	}

	function startTransition(to: RouteLocationNormalized, from: RouteLocationNormalized, entering?: ArticleArrival) {
		const nextPosition = window.history.state?.position as number
		positions.set(position, { left: window.scrollX, top: window.scrollY })
		const scroll = nextPosition !== position ? positions.get(nextPosition) : undefined
		const origin = nextPosition !== position ? origins.get(nextPosition) : undefined
		const hasOverlay = Array.from(document.querySelectorAll<HTMLElement>('.bg-mask, .bikariya-overlay, dialog[open]')).some(isVisible)
		if (!document.startViewTransition || nuxtApp.isHydrating || uaTransition || hasOverlay || !to.matched.length
			|| root.classList.contains('locale-motion')
			|| isLocaleSwitch(from.path, to.path, locales, 'zh')
			|| reducedMotion.value === 'reduce'
			|| normalizeContentPath(to.path) === normalizeContentPath(from.path)) {
			return
		}

		const source = !to.hash && !from.hash ? findShared(to.path) ?? findShared(from.path) : undefined
		if (!source)
			return
		origins.set(position, source.matches('.slide-item') ? '.slide-item' : '.article-card')
		const scrollToTop = typeof to.meta.scrollToTop === 'function' ? to.meta.scrollToTop(to, from) : to.meta.scrollToTop
		let resume!: () => void
		let finish!: () => void
		let abortPreparation!: () => void
		let transition: ViewTransition | undefined
		let played = false
		let stopPreparationTimeout = () => {}
		const navigationReady = new Promise<void>((resolve) => {
			resume = resolve
		})
		const pageReady = new Promise<void>((resolve) => {
			finish = resolve
		})
		const cancelled = new Promise<void>((resolve) => {
			abortPreparation = resolve
		})
		// loading:end 也可能由仍在挂载中的页面触发；finish 才表示 Suspense 已完成。
		const unhookPage = nuxtApp.hook('page:finish', () => {
			if (router.currentRoute.value.fullPath === to.fullPath)
				finish()
		})
		const state = { to: to.fullPath, cancel }
		// 首次异步挂载与字体/图片分别计时，避免冷加载耗尽资源准备的预算。
		// 两阶段等待预算合计 3.5 秒；失败时释放快照，并保留普通入场动画。
		const { stop: stopNavigationTimeout } = useTimeoutFn(cancel, 2500)

		const cleanup = once(() => {
			stopNavigationTimeout()
			stopPreparationTimeout()
			unhookPage()
			if (active !== state)
				return
			// 只有真正开始过快照动画，才抑制普通入场；准备失败时仍可淡入。
			if (played) {
				Array.from(document.querySelectorAll<HTMLElement>('[data-transition-enter]'))
					.filter(isVisible)
					.forEach(element => element.dataset.nativeEntered = '')
			}
			document.querySelectorAll<HTMLElement>('[data-article-source]').forEach(element => delete element.dataset.articleSource)
			document.querySelectorAll<HTMLElement>('[data-article-title]').forEach(element => delete element.dataset.articleTitle)
			document.querySelectorAll<HTMLElement>('[data-article-trigger]').forEach(element => delete element.dataset.articleTrigger)
			emit('finish')
			delete root.dataset.articleTransition
			for (const name of ['hero', 'panel']) {
				root.style.removeProperty(`--article-${name}-from`)
				root.style.removeProperty(`--article-${name}-to`)
			}
			root.style.removeProperty('--article-panel-motion')
			root.style.removeProperty('--article-body-clip')
			active = undefined
			if (entering && arrival.value === entering)
				entering.moving = false
		})

		function cancel() {
			transition?.skipTransition()
			resume()
			finish()
			abortPreparation()
			cleanup()
		}

		active = state
		if (entering)
			entering.moving = true
		root.dataset.articleTransition = 'old'
		const fromHero = markHero(source)!
		const fromPanel = document.getElementById('blog-panel')?.getBoundingClientRect()
		clipBodySnapshot()
		try {
			emit('capture')
			transition = document.startViewTransition(async () => {
				if (entering) {
					entering.visible = true
					// 先定位即时页头；正文完成时不再把用户滚回顶部。
					to.meta.scrollToTop = false
				}
				else if (arrival.value?.path !== normalizeContentPath(to.path)) {
					arrival.value = null
				}
				resume()
				if (!entering)
					await pageReady
				await nextTick()
				if (active !== state)
					return
				stopNavigationTimeout()
				unhookPage()
				if (!entering) {
					stopPreparationTimeout = useTimeoutFn(cancel, 1000).stop
					await prepareHead(cancelled)
				}
				if (active !== state)
					return
				delete source.dataset.articleSource
				source.querySelectorAll<HTMLElement>('[data-article-title]').forEach(element => delete element.dataset.articleTitle)
				root.dataset.articleTransition = 'new'
				// 快照捕获期间暂停 rAF，先完成定位；Nuxt 随后恢复相同的滚动位置。
				if (scrollToTop !== false) {
					if (scroll)
						window.scrollTo({ ...scroll, behavior: 'instant' })
					else if (to.hash)
						document.getElementById(safelyDecodeUriComponent(to.hash.slice(1)))?.scrollIntoView({ behavior: 'instant' })
					else
						window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
				}
				const target = findShared(to.path, origin) ?? findShared(from.path, origin)
				// 先解码可见头图，避免高清图片在移动中途解码、上传并替换画面。
				const images = entering ? [] : Array.from(target?.querySelectorAll('img') ?? [])
				const lazyImages = images.filter(image => image.loading === 'lazy')
				// 捕获会暂停 rAF，lazy 图片不能等下一帧才开始请求。
				lazyImages.forEach(image => image.loading = 'eager')
				try {
					await Promise.race([
						Promise.all(images.map(image => image.decode().catch(() => {}))),
						cancelled,
					])
				}
				finally {
					lazyImages.forEach(image => image.loading = 'lazy')
				}
				if (active !== state)
					return
				const toHero = markHero(target)
				if (toHero)
					moveSnapshot('hero', fromHero, toHero)
				const toPanel = document.getElementById('blog-panel')?.getBoundingClientRect()
				if (fromPanel && toPanel && (['left', 'top', 'width', 'height'] as const).some(key => Math.abs(fromPanel[key] - toPanel[key]) >= 0.1)) {
					moveSnapshot('panel', fromPanel, toPanel)
					root.style.setProperty('--article-panel-motion', 'article-panel-move')
				}
				clipBodySnapshot()
				emit('capture')
				await nextTick()
				stopPreparationTimeout()
			})
			transition.ready.then(() => played = true, cancel)
			transition.finished.catch(() => {}).finally(cleanup)
		}
		catch {
			cancel()
		}
		return navigationReady
	}

	// Card metadata is ready before route components load; capture only the lightweight shell.
	const unhookBefore = router.beforeEach((to, from) => {
		active?.cancel()
		const entering = arrival.value
		if (!entering || entering.visible || entering.path !== normalizeContentPath(to.path) || nuxtApp.isHydrating)
			return
		const motion = startTransition(to, from, entering)
		if (motion)
			return motion
		positions.set(position, { left: window.scrollX, top: window.scrollY })
		entering.visible = true
		entering.moving = false
		to.meta.scrollToTop = false
		window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
	})
	const unhookResolve = router.beforeResolve((to, from) => {
		if (arrival.value?.visible && arrival.value.path === normalizeContentPath(to.path))
			return
		const motion = startTransition(to, from)
		if (!motion && arrival.value?.path !== normalizeContentPath(to.path))
			arrival.value = null
		return motion
	})
	const unhookAfter = router.afterEach((to, _from, failure) => {
		if (failure && active?.to === to.fullPath)
			active.cancel()
		if (failure && arrival.value?.path === normalizeContentPath(to.path))
			arrival.value = null
		position = window.history.state?.position as number
		uaTransition = false
	})
	function cancelArrival() {
		active?.cancel()
		arrival.value = null
	}
	const unhookError = router.onError(cancelArrival)
	const unhookAppError = nuxtApp.hook('app:error', cancelArrival)

	nuxtApp.vueApp.onUnmount(() => {
		cancelArrival()
		unhookScroll()
		restoreScrollBehavior()
		restoreScrollAnchoring()
		unhookBefore()
		unhookResolve()
		unhookAfter()
		unhookError()
		unhookAppError()
	})
})
