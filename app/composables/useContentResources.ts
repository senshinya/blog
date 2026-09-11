import type { MaybeRefOrGetter } from 'vue'
import type { ContentResourceNeeds } from '~/utils/contentResources'
import { contentResourceLinks, contentResourceNeeds } from '~/utils/contentResources'

/** Each mounted consumer owns its head entry; Unhead deduplicates shared font keys. */
export function useResourceFonts(needs: MaybeRefOrGetter<ContentResourceNeeds>) {
	const { locale } = useI18n()
	useHead(() => ({ link: contentResourceLinks(toValue(needs), locale.value) }))
}

/** Available during SSR and reactive during in-place article/locale navigation. */
export function useContentResources(content: MaybeRefOrGetter<Parameters<typeof contentResourceNeeds>[0]>) {
	useResourceFonts(() => contentResourceNeeds(toValue(content)))
}
