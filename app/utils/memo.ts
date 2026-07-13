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
