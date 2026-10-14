/** The travel reader uses page shortcuts instead of control focus. */
export function useTravelFocus(root: Ref<HTMLElement | null>) {
	useEventListener(root, 'mousedown', (event: MouseEvent) => {
		const control = event.target instanceof Element ? event.target.closest('a[href],button,input,select,textarea,summary') : null
		if (event.button === 0 && control && root.value?.contains(control))
			event.preventDefault()
	}, { capture: true })
	useEventListener(root, 'focusin', (event: FocusEvent) => {
		if (event.target instanceof HTMLElement && root.value?.contains(event.target))
			event.target.blur()
	}, { capture: true })
	useEventListener('keydown', (event: KeyboardEvent) => {
		const inReader = event.target instanceof Element && (root.value?.contains(event.target) || event.target === root.value?.ownerDocument.body)
		if (inReader && event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey)
			event.preventDefault()
	}, { capture: true })
}
