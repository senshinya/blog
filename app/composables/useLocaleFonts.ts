import { localeFontLinks } from '~/utils/contentResources'

/** The shell needs its display font; article serif and code fonts have separate owners. */
export function useLocaleFonts() {
	const { locale } = useI18n()
	useHead(() => ({ link: localeFontLinks(locale.value) }))
}
