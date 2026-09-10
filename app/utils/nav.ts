import type { NavItem, NavTitle } from '~/types/nav'

type Translate = (key: string, named?: Record<string, string | number>) => string

/**
 * NavItem 的 text/textKey 互斥（定义见 ~/types/nav）：text 是不进词条表的
 * 字面量，textKey 要交给 $t() 处理。BlogSidebar、BlogFooter、IconNavList
 * 三处都要做同一个判断，抽成一个函数以免各写一份、后续改判断逻辑要改三处。
 *
 * 用 `item.textKey !== undefined` 而不是 `item.textKey ?` 做判断：后者虽然在
 * truthy 分支里能把 item.textKey 缩到 string，但缩窄不会传导到联合类型里的
 * 兄弟字段 item.text 上，else 分支里 item.text 的类型仍是 string | undefined，
 * 在 strict 模式下过不了这个函数 string 返回值的类型检查（tsc 独立验证过，
 * 详见 task-10-report.md「Fix round 1」）。显式 !== undefined 才能让 tsc
 * 把两个分支都缩窄到位。
 */
export function resolveNavText(item: NavItem, t: Translate): string {
	return item.textKey !== undefined ? t(item.textKey, item.textParams) : item.text
}

/**
 * 同 resolveNavText，BlogSidebar、BlogFooter、IconNavList 三处都要做同一个判断，
 * 抽成一个函数以免各写一份、后续改判断逻辑要改三处。
 *
 * 只有 item.localized 为真的站内路径才加前缀（如 /atom.xml → /en/atom.xml）——
 * 外部链接（GitHub、mailto: 等）和默认语言本身都不需要，也不能被误加前缀。
 */
export function resolveNavUrl(item: NavItem, locale: string, defaultLocale = 'zh'): string {
	return item.localized && locale !== defaultLocale ? `/${locale}${item.url}` : item.url
}

/**
 * 同 resolveNavText，用于 NavGroup 的 title/titleKey。参数类型是 NavTitle
 * （NavGroup 的 title/titleKey 那一半），而不是 Pick<NavGroup, 'title' | 'titleKey'>：
 * Pick 不会对联合类型分配，会把两个属性各自摊平成"都能传、都能不传"，
 * 刚好丢掉互斥性这个类型本来要保证的东西。
 */
export function resolveNavTitle(group: NavTitle, t: Translate): string {
	return group.titleKey !== undefined ? t(group.titleKey) : group.title
}
