import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
// eslint-disable-next-line test/no-import-node-test -- Use the repository's Node test runner.
import test from 'node:test'
import vm from 'node:vm'

function harness() {
	const listeners = new Map<string, (event: any) => void>()
	const document = { activeElement: null as Target | null, body: null as Target | null }
	class Target {
		inside: boolean
		constructor(inside = true) { this.inside = inside }
		closest() { return this }
		blur() {
			if (document.activeElement === this)
				document.activeElement = null
		}

		focus() {
			document.activeElement = this
			listeners.get('focusin')?.({ target: this })
		}
	}
	document.body = new Target(false)
	const root = { value: { ownerDocument: document, contains: (target: Target) => target.inside } }
	const source = stripTypeScriptTypes(readFileSync(new URL('./useTravelFocus.ts', import.meta.url), 'utf8')).replace(/^import .*$/gm, '').replace('export function', 'function')
	vm.runInNewContext(`${source}\nuseTravelFocus(root)`, {
		root,
		Element: Target,
		HTMLElement: Target,
		useEventListener(...args: any[]) {
			const offset = typeof args[0] === 'string' ? 0 : 1
			listeners.set(args[offset], args[offset + 1])
		},
	})
	function event(name: string, extra: Record<string, unknown> = {}) {
		const value = {
			target: new Target(),
			button: 0,
			key: '',
			defaultPrevented: false,
			preventDefault() { this.defaultPrevented = true },
			...extra,
		}
		listeners.get(name)?.(value)
		return value
	}
	return { listeners, document, Target, event }
}

test('chapter triggers and photos cannot retain pointer or restored programmatic focus', () => {
	const h = harness()
	assert.equal(h.event('mousedown').defaultPrevented, true)
	for (const control of [new h.Target(), new h.Target()]) {
		control.focus()
		assert.equal(h.document.activeElement, null)
	}
})

test('Tab never focuses a travel control, while reading arrows and Escape pass through', () => {
	const h = harness()
	assert.equal(h.event('keydown', { key: 'Tab', target: h.document.body }).defaultPrevented, true)
	assert.equal(h.event('keydown', { key: 'Tab' }).defaultPrevented, true)
	assert.equal(h.event('keydown', { key: 'Tab', shiftKey: true }).defaultPrevented, true)
	for (const key of ['ArrowUp', 'ArrowDown', 'Escape'])
		assert.equal(h.event('keydown', { key }).defaultPrevented, false)
})

test('focus suppression preserves controls outside the travel and secondary mouse actions', () => {
	const h = harness()
	const outside = new h.Target(false)
	outside.focus()
	assert.equal(h.document.activeElement, outside)
	assert.equal(h.event('mousedown', { target: outside }).defaultPrevented, false)
	assert.equal(h.event('keydown', { key: 'Tab', target: outside }).defaultPrevented, false)
	assert.equal(h.event('mousedown', { button: 2 }).defaultPrevented, false)
	assert.equal(h.event('keydown', { key: 'Tab', ctrlKey: true }).defaultPrevented, false)
})
