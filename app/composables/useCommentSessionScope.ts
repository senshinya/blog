import type { Ref } from 'vue'
import { onScopeDispose, watch } from 'vue'

export interface CommentSessionRequest {
	epoch: number
	controller: AbortController
}

/**
 * 把会话相关请求绑到当前组件和登录代次。
 *
 * 登出或组件卸载会立即中止还在途的请求；即便底层请求来不及取消，调用方也能用
 * current() 拒绝旧响应，避免把上一位访客的权限投影重新写回页面。
 */
export default function useCommentSessionScope(epoch: Readonly<Ref<number>>) {
	let active = true
	const requests = new Set<AbortController>()

	function abortAll() {
		for (const controller of requests)
			controller.abort()
		requests.clear()
	}

	watch(epoch, abortAll, { flush: 'sync' })
	onScopeDispose(() => {
		active = false
		abortAll()
	})

	function capture() {
		return epoch.value
	}

	function start(started = capture()): CommentSessionRequest {
		const controller = new AbortController()
		if (active && started === epoch.value)
			requests.add(controller)
		else
			controller.abort()
		return { epoch: started, controller }
	}

	function current(started: number | CommentSessionRequest) {
		const value = typeof started === 'number' ? started : started.epoch
		const aborted = typeof started === 'number' ? false : started.controller.signal.aborted
		return active && !aborted && value === epoch.value
	}

	function finish(request: CommentSessionRequest) {
		requests.delete(request.controller)
	}

	return { capture, start, current, finish }
}
