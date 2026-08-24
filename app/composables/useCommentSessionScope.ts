import type { Ref } from 'vue'
import { onScopeDispose, watch } from 'vue'

export interface CommentSessionRequest {
	epoch: number
	controller: AbortController
}

/**
 * 把会话相关请求绑到当前组件和登录代次。
 *
 * 只读请求默认会在登出或组件卸载时中止；写请求须以 abortOnInvalidate=false 启动，
 * 等服务端给出明确结果。两者都可用 current() 拒绝旧会话 UI 回写。
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

	function start(started = capture(), abortOnInvalidate = true): CommentSessionRequest {
		const controller = new AbortController()
		if (active && started === epoch.value && abortOnInvalidate)
			requests.add(controller)
		else if ((!active || started !== epoch.value) && abortOnInvalidate)
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
