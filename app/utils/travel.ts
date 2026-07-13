/**
 * 游记各处封面 / 缩略图的尺寸档位。
 *
 * **别随手加新档** —— Cloudflare 按「唯一变换」计费，一档 = 图片 × 参数组合，
 * 每多一档就多几十次。免费额度 5000/月，眼下这几档合计几百次，宽裕得很，
 * 但没必要按容器像素去随手生成。
 *
 * 数值取的是 CSS 尺寸的 2 倍左右，直接按 2x 发给所有屏幕：1x 屏多下的那点字节
 * （缩略图档只有 44 KB）远不值得再引一套 srcset。
 */
export const TravelImgWidth = {
	/** 日子屏的缩略图格子，CSS 约 208px */
	thumb: 416,
	/** 地图 popup，CSS 约 240px */
	popup: 480,
	/** 列表页的侧边封面，CSS 约 390px */
	cover: 800,
	/** 看图器的大图 */
	viewer: 1600,
	/** 详情页封面屏的整屏背景 */
	hero: 1920,
} as const

/** 见 getCfImgUrl —— 游记的图和正文的图在同一个图床，走同一套变换 */
export const getTravelImg = (src: string, width: number) => getCfImgUrl(src, width)
