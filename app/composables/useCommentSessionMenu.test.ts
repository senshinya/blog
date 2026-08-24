import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Vitest is not a project dependency; use Node's built-in runner.
import test from 'node:test'

test('toggles and closes the comment session menu', async () => {
	const { default: useCommentSessionMenu } = await import('./useCommentSessionMenu.ts')
	const menu = useCommentSessionMenu()

	menu.toggle()
	assert.equal(menu.open.value, true)
	menu.close()
	assert.equal(menu.open.value, false)
})

test('Escape closes the menu and restores trigger focus', async () => {
	const { default: useCommentSessionMenu } = await import('./useCommentSessionMenu.ts')
	let focused = false
	let prevented = false
	const menu = useCommentSessionMenu(() => {
		focused = true
	})

	menu.toggle()
	menu.onKeydown({
		key: 'Escape',
		preventDefault() {
			prevented = true
		},
	})

	assert.equal(menu.open.value, false)
	assert.equal(prevented, true)
	assert.equal(focused, true)
})

test('focus leaving the disclosure closes the menu', async () => {
	const { default: useCommentSessionMenu } = await import('./useCommentSessionMenu.ts')
	const inside = {}
	const container = {
		contains(target: unknown) {
			return target === inside
		},
	}
	const menu = useCommentSessionMenu()

	menu.toggle()
	menu.onFocusout({
		currentTarget: container,
		relatedTarget: inside,
	} as unknown as Pick<FocusEvent, 'currentTarget' | 'relatedTarget'>)
	assert.equal(menu.open.value, true)

	menu.onFocusout({
		currentTarget: container,
		relatedTarget: {},
	} as unknown as Pick<FocusEvent, 'currentTarget' | 'relatedTarget'>)
	assert.equal(menu.open.value, false)
})
