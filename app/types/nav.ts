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

interface NavGroupBase {
	items: NavItem[]
}

/** title 与 titleKey 互斥，同 NavItem 的 text/textKey。无分组标题时用空字符串字面量。 */
export type NavGroup = NavGroupBase & (
	| { title: string, titleKey?: never }
	| { titleKey: string, title?: never }
)

export type Nav = NavGroup[]
