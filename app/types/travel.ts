export interface TravelPhoto {
	src: string
	alt: string
	caption?: string
	/**
	 * 实况照片的动态部分：H.264 编码、去掉音轨、faststart 的 MP4。
	 * 缩略图悬停时、看图器里静音循环播放，像一张会动的照片。
	 */
	live?: string
	/**
	 * 独立视频：H.264 + AAC、faststart 的 MP4。保留声音，看图器里带播放控件，不循环。
	 * 与 `live` 二选一，同时填时按视频处理。
	 *
	 * 两种情况下 `src` 都要填，它是封面：缩略图、地图 popup、LQIP 和宽高都取它的。
	 */
	video?: string
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
	/** 开发环境可见；生产环境从列表、详情与预渲染中排除 */
	draft?: boolean
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
