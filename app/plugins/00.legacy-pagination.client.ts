import { stripLocale } from '~/utils/locale'
import { paginationPath, parsePageNumber } from '~/utils/pagination'

/** Capture old shared URLs before Nuxt hydrates a static home-page payload. */
export default defineNuxtPlugin({
	name: 'legacy-pagination',
	enforce: 'pre',
	setup() {
		const url = new URL(window.location.href)
		const { basePath, locale } = stripLocale(url.pathname, ['zh', 'en', 'ja'], 'zh')
		if (basePath !== '/' || !url.searchParams.has('page'))
			return
		const page = parsePageNumber(url.searchParams.get('page'))
		if (!page)
			return
		url.searchParams.delete('page')
		const query = url.searchParams.toString()
		return navigateTo(`${paginationPath(page, locale)}${query ? `?${query}` : ''}${url.hash}`, { external: true, replace: true })
	},
})
