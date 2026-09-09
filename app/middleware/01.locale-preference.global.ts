import blogConfig from '~~/blog.config'
import { manifest } from '#build/i18n-manifest'
import { decideLocale, resolvePreferred } from '~/utils/locale'

const LOCALES = blogConfig.locales.map(l => l.code)

/**
 * 文件名的 01. 前缀：Nuxt 按字母序执行全局中间件，需排在 @nuxtjs/i18n
 * 注入的那些之后。
 *
 * 整个中间件体以 import.meta.server 提前 return 守卫，因此不参与服务端
 * 与预渲染输出 —— 服务端与首次水合渲染的是同一份 HTML，本路径不产生
 * hydration mismatch。重定向切换的是路由而非当前路由的渲染结果，新路由
 * 整页重渲。
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

	if (target && target !== to.path)
		return navigateTo(target)
})
