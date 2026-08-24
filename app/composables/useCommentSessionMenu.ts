import { readonly, ref } from 'vue'

export default function useCommentSessionMenu(focusTrigger: () => void = () => {}) {
	const open = ref(false)

	function toggle() {
		open.value = !open.value
	}

	function close() {
		open.value = false
	}

	function onKeydown(event: Pick<KeyboardEvent, 'key' | 'preventDefault'>) {
		if (event.key !== 'Escape' || !open.value)
			return
		event.preventDefault()
		close()
		focusTrigger()
	}

	function onFocusout(event: Pick<FocusEvent, 'currentTarget' | 'relatedTarget'>) {
		const container = event.currentTarget as Node | null
		const next = event.relatedTarget as Node | null
		if (container?.contains(next))
			return
		close()
	}

	return {
		open: readonly(open),
		toggle,
		close,
		onKeydown,
		onFocusout,
	}
}
