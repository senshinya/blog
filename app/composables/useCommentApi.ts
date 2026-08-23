import type { FetchOptions } from 'ofetch'

/**
 * blog-comment 的错误体是统一的：
 * `{ error: { code, message, field?, request_id } }`
 *
 * 把它拆成结构化字段，调用方才能区分「这条要贴在输入框下面」（有 field）、
 * 「这是限速，显示倒数」（rate_limited）和「这是真的挂了」。
 */
export class CommentError extends Error {
	code: string
	status: number
	field?: string
	retryAfter?: number

	constructor(message: string, code: string, status: number, field?: string, retryAfter?: number) {
		super(message)
		this.name = 'CommentError'
		this.code = code
		this.status = status
		this.field = field
		this.retryAfter = retryAfter
	}

	static from(err: any) {
		if (err instanceof CommentError)
			return err
		const status: number = err?.status ?? err?.statusCode ?? 0
		const body = err?.data?.error
		if (body?.code) {
			return new CommentError(
				body.message || '请求失败',
				body.code,
				status,
				body.field,
				Number(body.retry_after) || undefined,
			)
		}
		// 网络层直接断掉时没有响应体，status 为 0
		return new CommentError(
			status ? `服务返回 ${status}` : '连不上评论服务',
			status ? 'internal' : 'network',
			status,
		)
	}
}

/**
 * 评论服务的请求器。
 *
 * 全站是 SSG（见 nuxt.config 的 preset 说明），生产没有服务端可代理，
 * 所有请求都由浏览器直接打到 API 域名上，靠服务端的 CORS 白名单放行。
 * 因此**跨站携带 cookie**：认证端点一律 `credentials: 'include'`，
 * 而 `/api/pages/counts` 与 `/api/comments/recent` 必须 `'omit'` ——
 * 服务端对这两个不回 `Allow-Credentials`，带了 cookie 浏览器会直接丢掉响应，
 * 表现为计数静默变 0 而不报错。
 */
export default function useCommentApi() {
	const { comment } = useAppConfig()
	const base = comment.api.replace(/\/+$/, '')

	async function request<T>(path: string, opts: FetchOptions = {}): Promise<T> {
		try {
			return await $fetch<T>(base + path, {
				credentials: 'include',
				...opts,
			} as FetchOptions) as T
		}
		catch (err) {
			throw CommentError.from(err)
		}
	}

	/** 登录是整页跳转：OAuth 回调会 303 回 return_to，SPA 里拦不住也不必拦 */
	function loginUrl(returnTo?: string) {
		const back = returnTo ?? (import.meta.client ? location.href : comment.api)
		return `${base}/auth/github/login?return_to=${encodeURIComponent(back)}`
	}

	return { base, request, loginUrl }
}
