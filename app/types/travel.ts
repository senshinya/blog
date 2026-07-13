export interface TravelPhoto {
	src: string
	alt: string
	caption?: string
	lat?: number
	lng?: number
}

/**
 * 行程中的一个小节。
 *
 * `day` 是第几天（从 0 起，0 是出发前夜），不是数组下标 —— 同一天可以拆成
 * 多个小节（关西那篇里 day 1 和 day 2 各有两节），故 day 会重复出现。
 */
export interface TravelDay {
	day: number
	title: string
	descriptions: string[]
	photos: TravelPhoto[]
}

export interface Travel {
	/** 与文件名、URL 一致：app/travels/<slug>.yaml → /travels/<slug> */
	slug: string
	title: string
	subtitle: string
	/** 用于 <title> 与列表页的完整标题 */
	posttitle: string
	description: string
	/** YYYY-MM-DD */
	published: string
	totaldays: number
	coverImage: string
	days: TravelDay[]
}
