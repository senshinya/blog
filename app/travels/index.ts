import { travelsByLocale } from '#build/travel-data'
import { getVisibleTravels } from './draft'

/** modules/publication serializes permitted YAML sources before bundling. */
export function getTravels(locale: string) {
	const visible = getVisibleTravels(travelsByLocale[locale] ?? [], import.meta.dev)
	return visible.toSorted((a, b) => b.published.localeCompare(a.published))
}

export function getTravelBySlug(locale: string, slug: string) {
	return getTravels(locale).find(travel => travel.slug === slug)
}
