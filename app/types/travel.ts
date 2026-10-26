export interface TravelPhoto {
	src: string
	alt: string
	caption?: string
	/**
	 * 实况照片的动态部分：H.264、faststart 的 MP4；源文件有音轨时保留为 AAC。
	 * 缩略图悬停时、看图器里默认静音循环播放，可通过声音按钮切换。
	 */
	live?: string
	/**
	 * 独立视频：H.264 + AAC、faststart 的 MP4。保留声音，看图器里带播放控件，不循环。
	 * 与 `live` 二选一，同时填时按视频处理。
	 *
	 * 两种情况下 `src` 都要填，它是封面：缩略图、地图 popup、LQIP 和宽高都取它的。
	 */
	video?: string
	/** 海上、飞行等途中照片可展示当天全部点位的范围。省略时聚焦拍摄位置。 */
	mapView?: 'day'
	/** 照片背景地图相对自动取景的缩放偏移，正数放大；不影响整章或 day 总览。 */
	mapZoomOffset?: number
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
	/** Compact chapter label for the reading navigation. */
	shortTitle?: string
	descriptions: string[]
	photos: TravelPhoto[]
}

export interface TravelTrack {
	/** Chapter array index, independent of the displayed day number. */
	chapter: number
	day: number
	/** Separate recordings remain separate; coordinates are longitude, latitude. */
	segments: [number, number][][]
}

export interface TravelCoverMap {
	/** 封面取景边界：西南、东北两角，坐标顺序为 [经度, 纬度]。 */
	bounds?: [[number, number], [number, number]]
	/** 配置后封面固定显示这些轨迹，不受正文轨迹开关影响。空对象表示全部轨迹。 */
	tracks?: {
		/** 从 1 开始的章节序号；与 days 同时配置时取并集。 */
		chapters?: number[]
		/** 对应 TravelDay.day；同一天的多章全部包含，支持出发前夜 day 0。 */
		days?: number[]
	}
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
	coverCaption?: string
	coverMap?: TravelCoverMap
	ending?: string
	days: TravelDay[]
	/** Loaded from the sibling .tracks.json after draft filtering. */
	tracks?: TravelTrack[]
}
