import { marked } from 'marked'

/** Memos 服务 /api/v1/memos 返回的单条数据（只列用得上的字段） */
export interface Memo {
	/** 形如 memos/QZbUFrYf8w3ac85s6g9LH7 */
	name: string
	content: string
	createTime: string
	pinned: boolean
	tags?: string[]
}

/** 正文已渲染成 HTML、图片已摘出的 memo，列表卡片与详情页共用 */
export interface ParsedMemo {
	id: string
	html: string
	images: string[]
	createTime: string
	pinned: boolean
	tags?: string[]
}

marked.use({ breaks: true, gfm: true })

// 两种写法：markdown 的 ![alt](src "title") 和裸 <img src="...">
// src 后面用 (?:\s[^)]*)? 匹配可选的 title，与 src 之间以空白划清界限，
// 避免两个量词争抢同一批字符（会导致多项式回溯）
const IMAGE_RE = /!\[[^\]]*\]\(\s*([^)\s]+)(?:\s[^)]*)?\)|<img\s[^>]*?src=["']([^"']+)["'][^>]*>/g

/** [文字](链接) → 文字 */
const LINK_RE = /\[([^\]]*)\]\([^)]*\)/g
/** 行首的 #、>、-、* 等标记 */
const MARKER_RE = /^\s*(?:#{1,6}|[>\-*+]|\d+\.)\s+/gm

/**
 * 把图片从正文里摘出来。
 *
 * 碎语多是手机截图，内联渲染时一张竖构图就能撑满整屏；摘出来单独走方格网格后
 * 每条的高度才可控。
 */
export function splitMemoImages(content: string) {
	const images: string[] = []
	const text = content.replace(IMAGE_RE, (_, mdSrc, htmlSrc) => {
		images.push(mdSrc || htmlSrc)
		return ''
	})
	return { text: text.trim(), images }
}

/**
 * 压成一行纯文本，供侧栏这类没有排版空间的地方使用。
 *
 * 不做字数截断 —— 中英混排下按字数截断很难看，交给 CSS 的 line-clamp 处理。
 */
export function toMemoPlainText(content: string) {
	return splitMemoImages(content).text.replace(LINK_RE, '$1').replace(MARKER_RE, '').replace(/[*`~]/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * 接口返回的 memo → 可直接渲染的 memo。
 *
 * memo 是自建 Memos 服务里自己写的内容，与文章正文同等信任，故不做净化。
 */
export function parseMemo(memo: Memo): ParsedMemo {
	const { text, images } = splitMemoImages(memo.content)
	return {
		// name 是 memos/<uid>，uid 才是稳定标识：详情页路由和 giscus 的 term 都用它
		id: memo.name.split('/').pop() ?? memo.name,
		html: marked.parse(text) as string,
		images,
		createTime: memo.createTime,
		pinned: memo.pinned,
		tags: memo.tags,
	}
}
