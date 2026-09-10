// Bangumi(bgm.tv)收藏数据：番剧 / 影视 / 游戏，供 /media 页使用。
// 数据源：https://api.bgm.tv/v0/users/{uid}/collections?subject_type=&type=&limit=&offset=
// 已确认接口带 access-control-allow-origin: *，可浏览器端直接跨域取数。

/**
 * 一个分类：对应 collections API 的 subject_type。标签、计数量词、三个状态的措辞
 * 都是语言相关的文案，不放在这份数据里——它们在 i18n 的 media.* 命名空间下，
 * 以 key 为下标（media.category.<key> / media.status.<key>.<status> / media.total.<key>）。
 */
export interface BgmCategory {
	key: 'anime' | 'real' | 'game'
	/** 筛选器图标（tabler） */
	icon: string
	/** collections API 的 subject_type：番剧 2 / 影视(三次元) 6 / 游戏 4 */
	subjectType: 2 | 4 | 6
}

export const BGM_CATEGORIES: BgmCategory[] = [
	{ key: 'anime', icon: 'tabler:device-tv', subjectType: 2 },
	{ key: 'real', icon: 'tabler:movie', subjectType: 6 },
	{ key: 'game', icon: 'tabler:device-gamepad-2', subjectType: 4 },
]

/** 状态展示顺序：在看 / 看过 / 想看 → collections API 的 type 值 3 / 2 / 1 */
export const BGM_STATUS_TYPES = [3, 2, 1] as const
export type BgmStatusType = typeof BGM_STATUS_TYPES[number]

/** 状态的 URL slug，顺序对齐 BGM_STATUS_TYPES，同时也是 media.status.<category> 下的 i18n key */
export const BGM_STATUS_KEYS = ['doing', 'collect', 'wish'] as const
export type BgmStatusKey = typeof BGM_STATUS_KEYS[number]

/**
 * 给 bgm 资源 URL（API 或 lain.bgm.tv 封面）套上反代前缀，形如
 * `https://api-bgm-tv.shinya.click/https://api.bgm.tv/...`。前缀为空则原样直连。
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
