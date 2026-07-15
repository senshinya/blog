// Bangumi(bgm.tv)收藏数据：番剧 / 影视 / 游戏，供 /media 页使用。
// 数据源：https://api.bgm.tv/v0/users/{uid}/collections?subject_type=&type=&limit=&offset=
// 已确认接口带 access-control-allow-origin: *，可浏览器端直接跨域取数。

/** 一个分类：对应 collections API 的 subject_type，并附带该分类下三个状态的中文标签。 */
export interface BgmCategory {
	key: 'anime' | 'real' | 'game'
	label: string
	/** 筛选器图标（tabler） */
	icon: string
	/** 计数单位：部 / 款 */
	unit: string
	/** collections API 的 subject_type：番剧 2 / 影视(三次元) 6 / 游戏 4 */
	subjectType: 2 | 4 | 6
	/** 三个状态在该分类下的措辞（番剧/影视用「看」，游戏用「玩」），顺序对齐 BGM_STATUS_TYPES */
	statusLabels: [doing: string, collect: string, wish: string]
}

export const BGM_CATEGORIES: BgmCategory[] = [
	{ key: 'anime', label: '番剧', icon: 'tabler:device-tv', unit: '部', subjectType: 2, statusLabels: ['在看', '看过', '想看'] },
	{ key: 'real', label: '影视', icon: 'tabler:movie', unit: '部', subjectType: 6, statusLabels: ['在看', '看过', '想看'] },
	{ key: 'game', label: '游戏', icon: 'tabler:device-gamepad-2', unit: '款', subjectType: 4, statusLabels: ['在玩', '玩过', '想玩'] },
]

/** 状态展示顺序：在看 / 看过 / 想看 → collections API 的 type 值 3 / 2 / 1 */
export const BGM_STATUS_TYPES = [3, 2, 1] as const
export type BgmStatusType = typeof BGM_STATUS_TYPES[number]

/**
 * 给 bgm 资源 URL（API 或 lain.bgm.tv 封面）套上反代前缀，形如
 * `https://forward.shinya.click/https://api.bgm.tv/...`。前缀为空则原样直连。
 */
export function withBgmProxy(proxy: string, url: string): string {
	return proxy ? proxy + url : url
}

// ---- API 响应结构（只声明用得到的字段）----

export interface BgmSubject {
	id: number
	name: string
	name_cn: string
	/** 播出/发行日期，如 "2013-04-06" */
	date?: string
	/** 全站公开评分，未评分为 0 */
	score?: number
	short_summary?: string
	images?: {
		small?: string
		grid?: string
		large?: string
		medium?: string
		/** 400 宽，卡片封面用这个尺寸 */
		common?: string
	}
}

export interface BgmCollection {
	subject_id: number
	updated_at: string
	/** 我的评分，1–10；0 表示未评分 */
	rate: number
	/** 我的短评，可能为 null 或空串 */
	comment: string | null
	subject: BgmSubject
}

export interface BgmCollectionPage {
	data: BgmCollection[]
	total: number
	limit: number
	offset: number
}
