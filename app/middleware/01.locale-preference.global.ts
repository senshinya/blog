import blogConfig from '~~/blog.config'
import { manifest } from '#build/i18n-manifest'
import { decideLocale, localeRedirectPath, resolvePreferred } from '~/utils/locale'

const LOCALES = blogConfig.locales.map(l => l.code)

/**
 * 文件名的 01. 前缀：Nuxt 按字母序执行全局中间件，需排在 @nuxtjs/i18n
 * 注入的那些之后。
 *
 * 整个中间件体以 import.meta.server 提前 return 守卫，因此不参与服务端
 * 与预渲染输出。但「不参与 SSR」不等于「不会引发 hydration mismatch」：
 * 首屏那一次重定向恰恰会，见下方 isHydrating 分支。
 */
export default defineNuxtRouteMiddleware((to) => {
	if (import.meta.server)
		return

	const { stored, persist } = useLocalePreference()
	const browser = navigator.languages ?? [navigator.language].filter(Boolean)

	/**
	 * 固化与跳转是两件事，必须分开算。
	 *
	 * 缺译文时不跳转，但偏好照样要写进 cookie（spec 要求）——
	 * 否则日语读者每次进站都重新检测，且因为落地页恰好没有日文版，
	 * 永远进不了日语版。
	 */
	const preferred = resolvePreferred(stored.value ?? undefined, browser, LOCALES)
	if (preferred && !stored.value)
		persist(preferred)

	const target = decideLocale({
		path: to.path,
		stored: stored.value ?? undefined,
		browser,
		manifest,
		locales: LOCALES,
		defaultLocale: 'zh',
	})

	if (target && target !== to.path) {
		const destination = localeRedirectPath(target, to.fullPath, window.location.origin)
		if (!destination)
			return
		/**
		 * 首屏（水合中）必须走整页跳转，不能走客户端路由。
		 *
		 * Nuxt 在 app:created 里 await router.replace(初始路由)，全局中间件在这一步
		 * 执行，而 app:created 排在 vueApp.mount() 之前（见 nuxt/dist/pages/runtime/
		 * plugins/router.js）。此时用普通 navigateTo 换路由，Vue 随后就会拿新语言的
		 * 渲染结果去水合服务端发来的旧语言 HTML —— 文本会被纠正，attribute 在生产
		 * 构建下是 check-only 不纠正，于是页面文案是目标语言、导航 href 却整片停留在
		 * 原语言：中文首页上六条导航全指向 /en，日语读者点哪一条都被弹回中文。
		 *
		 * external: true 让 navigateTo 走 location.replace 重新请求文档，且它在
		 * isHydrating 时返回一个永不 resolve 的 Promise（见 nuxt/dist/app/composables/
		 * router.js），应用根本不会挂载，也就无所谓水合。replace 避免在历史里多留一格。
		 *
		 * 非首屏（站内导航时再次命中）仍走客户端跳转：那时早已挂载完毕，没有水合，
		 * 整页刷新只会白白丢掉已加载的状态。
		 */
		if (useNuxtApp().isHydrating)
			return navigateTo(destination, { external: true, replace: true })

		return navigateTo(destination)
	}
})
