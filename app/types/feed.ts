export interface FeedEntry {
	/** 博客作者，使用作者明确的自称 */
	author: string
	/** 友链卡片的作者名后缀；作者自称明确且较短时，可填简短站名，避免重复作者名 */
	sitenick?: string
	/** 悬浮卡片与订阅源使用的完整站点标题；与作者名相同时省略，默认使用 sitenick 或 author */
	title?: string
	/** 个人简介/博客描述 */
	desc?: string
	/** 博客地址 */
	link: string
	/** 订阅源 */
	feed?: string
	/** 站点小图标 */
	icon: string
	/** 个人头像 */
	avatar: string
	/** 博客技术架构 */
	archs?: Arch[]
	/** 订阅日期，未知则不展示 */
	date?: string
	/** 博主备注 */
	comment?: string
	/** 错误信息 */
	error?: string
}

interface FeedGroupBase {
	/** 描述 */
	desc?: string
	/** 友链列表 */
	entries: FeedEntry[]
}

/**
 * name 与 nameKey 互斥，同 NavItem 的 text/textKey（定义见 ~/types/nav）：分组名若是
 * 不进词条表的字面量（比如未来按人名分组）用 name；需要按语言切换的界面文案
 * （比如当前唯一一组的通用标题「友链」）用 nameKey，交给 $t() 渲染。feeds.ts 被
 * 友链检测 CLI 用相对路径直接导入，运行在 Nuxt/i18n 上下文之外，nameKey 在那里
 * 只是个惰性字符串，真正的翻译发生在渲染它的 FeedGroup.vue 里。
 */
export type FeedGroupName = (
	| { name: string, nameKey?: never }
	| { nameKey: string, name?: never }
)

export type FeedGroup = FeedGroupBase & FeedGroupName
