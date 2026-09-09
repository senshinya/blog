import type { NavGroup, NavItem } from '~/types/nav'

type Translate = (key: string, named?: Record<string, string | number>) => string

/**
 * NavItem 的 text/textKey 互斥（定义见 ~/types/nav）：text 是不进词条表的
 * 字面量，textKey 要交给 $t() 处理。BlogSidebar、BlogFooter、IconNavList
 * 三处都要做同一个判断，抽成一个函数以免各写一份、后续改判断逻辑要改三处。
 */
export function resolveNavText(item: NavItem, t: Translate): string {
	return item.textKey ? t(item.textKey, item.textParams) : item.text
}

/** 同 resolveNavText，用于 NavGroup 的 title/titleKey。 */
export function resolveNavTitle(group: Pick<NavGroup, 'title' | 'titleKey'>, t: Translate): string {
	return group.titleKey ? t(group.titleKey) : group.title
}
