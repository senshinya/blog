import blogConfig from '~~/blog.config'
import { ENTRANCE_SKIP_KEY } from '~/composables/useEntranceDelay'
import { isLocaleSwitch } from '~/utils/locale'

const LOCALES = blogConfig.locales.map(l => l.code)

/**
 * Run after locale-preference redirects. Same-page language changes keep the
 * reading position and let locale motion replace the normal staggered entrance.
 * Compute on the server too so the initial state agrees during hydration.
 */
export default defineNuxtRouteMiddleware((to, from) => {
	const previous = from.matched.length ? from.path : undefined
	const localeSwitch = isLocaleSwitch(previous, to.path, LOCALES, 'zh')

	useState<boolean>(ENTRANCE_SKIP_KEY, () => false).value = localeSwitch
	to.meta.scrollToTop = !localeSwitch
})
