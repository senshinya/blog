interface NavItemBase {
	icon: string
	url: string
	external?: boolean
}

/**
 * text 与 textKey 互斥：专有名词、人名、邮箱等不进词条表的内容用 text 字面量；
 * 需要按语言切换的界面文案用 textKey，交给 $t() 渲染。textParams 仅在 textKey
 * 对应的词条带插值占位符时才用得上（例如 `主题: {name} {version}`）。
 */
export type NavItem = NavItemBase & (
	| { text: string, textKey?: never, textParams?: never }
	| { textKey: string, text?: never, textParams?: Record<string, string | number> }
)

/**
 * title 与 titleKey 互斥，同 NavItem 的 text/textKey。无分组标题时用空字符串字面量。
 * 单独导出成一个联合类型（而不是内联进 NavGroup），是因为 Pick<NavGroup, 'title' | 'titleKey'>
 * 不会对联合类型分配——它会把两个属性各自摊平，结果变成"两个都能传、两个都能不传"，
 * 刚好丢掉这个联合类型本来要保证的互斥性。resolveNavTitle 只关心这一对字段，
 * 直接引用 NavTitle 就不会有这个坑。
 */
export type NavTitle = (
	| { title: string, titleKey?: never }
	| { titleKey: string, title?: never }
)

interface NavGroupBase {
	items: NavItem[]
}

export type NavGroup = NavGroupBase & NavTitle

export type Nav = NavGroup[]
