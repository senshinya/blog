import type { Travel } from '~/types/travel'
import { getVisibleTravels } from './draft'

/**
 * 游记注册表。放一个 <slug>.yaml 进 app/travels/<locale>/ 即生效，
 * 不需要手工登记 —— 预渲染路由由 modules/i18n-manifest 扫描同一批文件产出，
 * 两处不会再各自维护一份事实。
 *
 * unplugin-yaml 把 *.yaml 声明为 Record<string, unknown>，故需断言。
 */
const modules = import.meta.glob<Record<string, unknown>>('./*/*.yaml', { eager: true, import: 'default' })

const byLocale = new Map<string, Travel[]>()

for (const [path, data] of Object.entries(modules)) {
	const locale = path.split('/')[1]!
	const list = byLocale.get(locale) ?? []
	list.push(data as unknown as Travel)
	byLocale.set(locale, list)
}

export function getTravels(locale: string) {
	const visible = getVisibleTravels(byLocale.get(locale) ?? [], import.meta.dev)
	return visible.toSorted((a, b) => b.published.localeCompare(a.published))
}

export function getTravelBySlug(locale: string, slug: string) {
	return getTravels(locale).find(travel => travel.slug === slug)
}
