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

/**
 * 正文切成的一块。
 *
 * 正文整体是一串 HTML，本可以一次 v-html 了事；但「独占一行的裸链接」要换成
 * 预览卡这个 Vue 组件，而 v-html 出来的东西里挂不上组件。故先在文本层切块，
 * 由 MemoBody 逐块渲染：html 块照旧 v-html，link 块交给 MemoLinkCard。
 */
export type MemoBlock
	= | { type: 'html', html: string }
		| { type: 'link', url: string }

/** 切块的中间产物。链接块此时已定，文字块尚未过 marked */
export type MemoSegment
	= | { type: 'text', text: string }
		| { type: 'link', url: string }

/** 正文已切块、图片已摘出的 memo，列表卡片与详情页共用 */
export interface ParsedMemo {
	id: string
	blocks: MemoBlock[]
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
 * 整行恰好是一个裸链接。
 *
 * 卡死首尾（^$ 而非部分匹配）是刻意的：这条规则同时是作者的开关 ——
 * 想要卡片就让链接独占一行，想让它留在句子里就别换行。行尾多个句号即退回行内，
 * 规则一眼可辨，不必再记别的语法。
 */
const BARE_LINK_RE = /^https?:\/\/\S+$/
/**
 * 行尾的句读。见到它们就认定作者是在写句子，这一行退回行内，交给 marked 自动链接
 * （它同样会把这些字符排除在链接之外，两边判断一致）。
 *
 * 刻意不管括号引号：`…/Foo_(bar)` 这类地址本身就以右括号收尾，
 * 要分清得做括号配对，代价大于收益，而误伤一个维基链接比漏掉一个句号难受得多。
 */
const TRAILING_PUNCTUATION_RE = /[。，、；：！？…,;:!?.]$/
/** ``` 或 ~~~ 围栏。贴代码片段时，里头的 URL 不该被抓去做卡片 */
const FENCE_RE = /^\s*(?:```|~~~)/
/**
 * 缩进四格（或一个 tab）在 markdown 里就是代码块，与围栏同等对待。
 *
 * 判据跟着 marked 走而不是自立一套：作者脑子里的规则是 markdown，
 * 同一行文字在预览卡和正文里的归属该是一致的。
 */
const INDENTED_CODE_RE = /^(?: {4}|\t)/

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
 * 把独占一行的裸链接切出来，供 MemoLinkCard 渲染成预览卡。
 *
 * 在 markdown 文本层切而不是解析渲染后的 HTML：按行扫一遍就够，而 marked 的
 * 输出还要考虑 gfm 自动链接、段落包裹等一堆形态，判断反而更绕。这也与
 * splitMemoImages 是同一个路子 —— 先在文本层把东西摘出来，再渲染剩下的。
 */
export function splitMemoLinks(text: string) {
	const segments: MemoSegment[] = []
	let buffer: string[] = []
	let inFence = false

	function flush() {
		const text = buffer.join('\n').trim()
		if (text)
			segments.push({ type: 'text', text })
		buffer = []
	}

	for (const line of text.split('\n')) {
		if (FENCE_RE.test(line))
			inFence = !inFence

		const trimmed = line.trim()
		const isBareLink = BARE_LINK_RE.test(trimmed) && !TRAILING_PUNCTUATION_RE.test(trimmed)
		if (!inFence && !INDENTED_CODE_RE.test(line) && isBareLink) {
			flush()
			segments.push({ type: 'link', url: trimmed })
			continue
		}

		buffer.push(line)
	}
	// 围栏未闭合时，剩下的整段照常按文字处理，交给 marked 收拾
	flush()

	return segments
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
		blocks: splitMemoLinks(text).map(segment => segment.type === 'link'
			? segment
			: { type: 'html' as const, html: marked.parse(segment.text) as string }),
		images,
		createTime: memo.createTime,
		pinned: memo.pinned,
		tags: memo.tags,
	}
}
