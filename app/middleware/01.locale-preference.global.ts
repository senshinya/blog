import blogConfig from '~~/blog.config'
import { manifest } from '#build/i18n-manifest'
import { suggestLocale } from '~/utils/locale'

const LOCALES = blogConfig.locales.map(l => l.code)

/** Language URLs are authoritative. Detection only offers an explicit choice. */
export default defineNuxtRouteMiddleware((to) => {
	if (import.meta.server)
		return

	const { stored } = useLocalePreference()
	const suggestion = useState<string | undefined>('locale-suggestion')
	suggestion.value = stored.value
		? undefined
		: suggestLocale({
				path: to.path,
				browser: navigator.languages ?? [navigator.language].filter(Boolean),
				manifest,
				locales: LOCALES,
				defaultLocale: 'zh',
			})
})
