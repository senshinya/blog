/**
 * 自建评论服务 blog-comment 的类型与纯函数。
 *
 * 接口文档：https://github.com/senshinya/blog-comment/blob/main/docs/api.md
 * 取数与鉴权在 composables/useCommentApi、useCommentSession 里。
 */

/** 服务端支持的 reaction 枚举 → 展示字符。数组顺序即 chip 的排列顺序 */
export const REACTIONS = [
	['+1', '👍'],
	['heart', '❤️'],
	['hooray', '🎉'],
	['rocket', '🚀'],
	['laugh', '😄'],
	['eyes', '👀'],
	['confused', '😕'],
	['-1', '👎'],
] as const

export type ReactionKey = typeof REACTIONS[number][0]

const EMOJI = new Map<string, string>(REACTIONS as readonly (readonly [string, string])[])

/** 正文长度上限，与服务端的 1–10000 Unicode 字符一致 */
export const BODY_MAX = 10000
/** 逼近上限才显示字数：写到两三百字时那个数字不携带信息 */
export const BODY_WARN = 9000
/** 服务端限速：1 条 / 15 秒 */
export const POST_COOLDOWN = 15

/** 同一父节点下超过这个数量的直接回复就收纳，只铺 KEEP 条 */
export const FOLD_OVER = 5
export const FOLD_KEEP = 3

export interface CommentUser {
	id: number
	login: string
	name: string
	avatar_url: string
	is_owner: boolean
}

export interface Comment {
	id: number
	parent_id: number | null
	depth: number
	deleted: boolean
	/** 已删除的条目只回 id / parent_id / depth / deleted，其余字段整个缺席 */
	user?: CommentUser
	body_html?: string
	body_md?: string
	created_at?: string
	edited_at?: string | null
	reactions?: Record<string, number>
	viewer_reactions?: string[]
	can_edit?: boolean
	can_delete?: boolean
}

export interface ThreadPage {
	id: number
	key: string
	title: string
	reactions: Record<string, number>
	viewer_reactions: string[]
	viewer_subscribed: boolean
}

export interface Thread {
	page: ThreadPage | null
	comments: Comment[]
	next_cursor: string | null
	total_comments: number
}

export interface Me {
	user: {
		id: number
		login: string
		name: string
		avatar_url: string
		email: string | null
	} | null
	is_owner?: boolean
	notify_replies?: boolean
	banned?: boolean
	ban_reason?: string | null
}

export function commentSessionIdentity(user: NonNullable<Me['user']>) {
	return {
		name: user.name || user.login,
		profile: `https://github.com/${user.login}`,
	}
}

/** 树形渲染用：把扁平数组按 parent_id 接起来 */
export interface CommentTree extends Comment {
	children: CommentTree[]
}

export interface ReactionChip {
	key: string
	emoji: string
	count: number
	/** 当前访客点过 */
	on: boolean
}

/**
 * reaction 从 map 摊成有序数组。
 *
 * 必须按固定顺序而不是对象自身的键序：服务端每次回来的键序不保证一致，
 * 跟着它排会让 chip 在两次请求之间左右横跳。
 */
export function toReactionChips(
	reactions: Record<string, number> | undefined,
	viewer: string[] | undefined,
): ReactionChip[] {
	if (!reactions)
		return []
	const mine = new Set(viewer ?? [])
	return REACTIONS
		.map(([key, emoji]) => ({ key, emoji, count: reactions[key] ?? 0, on: mine.has(key) }))
		.filter(chip => chip.count > 0)
}

export function reactionEmoji(key: string) {
	return EMOJI.get(key) ?? key
}

/**
 * 路径 → page key。
 *
 * 服务端的校验是：必须以 / 开头、512 字节内、不带 query/hash、不含连续 //、
 * 不以 / 结尾、不含 .. 和空白。Nuxt 的 route.path 已经满足绝大部分，
 * 只有根路径和可能的尾斜杠要处理 —— 根路径本身就是 "/"，不能再削。
 */
export function commentPageKey(path: string) {
	const clean = path.split(/[?#]/)[0]!.replace(/\/{2,}/g, '/')
	return clean.length > 1 ? clean.replace(/\/+$/, '') : '/'
}

/**
 * 扁平数组建树。
 *
 * /api/pages/thread 返回的是拍平的列表（带 parent_id 与 depth），
 * 顶层的顺序由服务端的 order 决定，回复一律按时间正序 —— 一段对话倒着读没有意义。
 */
export function buildCommentTree(comments: Comment[]): CommentTree[] {
	const nodes = new Map<number, CommentTree>()
	for (const c of comments)
		nodes.set(c.id, { ...c, children: [] })

	const roots: CommentTree[] = []
	for (const c of comments) {
		const node = nodes.get(c.id)!
		const parent = c.parent_id == null ? undefined : nodes.get(c.parent_id)
		// 父节点不在本次响应里（focus 视图会出现）时，就地当作顶层渲染
		if (parent)
			parent.children.push(node)
		else
			roots.push(node)
	}
	return roots
}

/** 去重合并两次响应：focus 与普通分页是两条数据，不能直接首尾相接 */
export function mergeComments(a: Comment[], b: Comment[]): Comment[] {
	const seen = new Set(a.map(c => c.id))
	return [...a, ...b.filter(c => !seen.has(c.id))]
}

/** 从 #comment-43 里取出 43 */
export function parseCommentHash(hash: string): number | undefined {
	const id = Number(/^#comment-(\d+)$/.exec(hash)?.[1])
	return Number.isInteger(id) ? id : undefined
}

// ── 登录前的那一次点击 ────────────────────────────────────────────
/**
 * reaction 是未登录访客最容易点到的东西，而登录是整页跳去 GitHub。
 * 不把意图存下来，跳一趟回来那个 👍 就白点了 —— 人还得自己找回原位再点一次。
 */
export interface PendingReaction {
	targetType: 'comment' | 'page'
	targetId?: number
	/** 两种 target 都带上：碎语卡片靠它认出「这一条是我的」，好把自己重新展开 */
	pageKey?: string
	emoji: string
	at: number
}

const PENDING_KEY = 'comment:pending-reaction'
/**
 * 跳一趟 OAuth 的合理耗时上限，超过就丢弃。
 * 中途放弃授权、按返回键回来的人，不该在十分钟后从别的入口登录时，
 * 被补发一个自己早就忘了的 reaction。
 */
const PENDING_TTL = 10 * 60 * 1000

function readPending(): PendingReaction | undefined {
	if (!import.meta.client)
		return
	try {
		const raw = sessionStorage.getItem(PENDING_KEY)
		if (!raw)
			return
		const p = JSON.parse(raw) as PendingReaction
		if (Date.now() - p.at > PENDING_TTL) {
			sessionStorage.removeItem(PENDING_KEY)
			return
		}
		return p
	}
	catch {
		// 无痕模式下 sessionStorage 会直接抛，当作没存过
	}
}

export function stashPendingReaction(p: Omit<PendingReaction, 'at'>) {
	if (!import.meta.client)
		return
	try {
		sessionStorage.setItem(PENDING_KEY, JSON.stringify({ ...p, at: Date.now() }))
	}
	catch {
		// 同上：存不下就退回老行为 —— 登录回来什么也不补，不影响别的
	}
}

/**
 * 取走匹配的那一条。
 *
 * 先清再返回：一个页面上可能有几十个 CommentReactions 同时满足条件，
 * 只让第一个对上的补发，否则同一个 emoji 会被来回 PUT / DELETE 好几遍。
 */
export function takePendingReaction(match: (p: PendingReaction) => boolean): PendingReaction | undefined {
	const p = readPending()
	if (!p || !match(p))
		return
	try {
		sessionStorage.removeItem(PENDING_KEY)
	}
	catch {
		// 读得到就删得掉，这里只是不让异常漏出去
	}
	return p
}

/**
 * 登录跳转的 return_to：就近找一个带 id 的祖先，回来才落在刚才点的那个位置，
 * 而不是页面顶部。文章页是 <section id="comment">，碎语卡片是 <li :id>，
 * 单条评论是 <li id="comment-43">。
 */
export function returnToNearest(el: Element | null | undefined) {
	const base = `${location.origin}${location.pathname}${location.search}`
	const anchor = el?.closest('[id]')?.id
	return anchor ? `${base}#${anchor}` : base
}
