import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
// eslint-disable-next-line test/no-import-node-test -- Use the repository's Node test runner.
import test from 'node:test'
import vm from 'node:vm'
import { normalizeTravelAppearance, normalizeTravelPalette } from '../utils/travelTheme.ts'

function harness({ cookies = {}, stored = {}, serialized = {}, dark = false, blocked = false }: { cookies?: Record<string, string>, stored?: Record<string, string>, serialized?: Record<string, string>, dark?: boolean, blocked?: boolean } = {}) {
	const cookieRefs = new Map<string, { value: string }>()
	const storage = new Map(Object.entries(stored))
	const states = new Map<string, { value: string }>()
	const mounted: Array<() => void> = []
	const disposers: Array<() => void> = []
	const mediaHandlers = new Set<(event: { matches: boolean }) => void>()
	let storageHandler: (event: { key: string, newValue: string | null }) => void
	const context = {
		normalizeTravelAppearance,
		normalizeTravelPalette,
		ref: (value: unknown) => ({ value }),
		computed: (getter: () => unknown) => ({ get value() { return getter() } }),
		useCookie(key: string, options: { default: () => string }) {
			const value = { value: cookies[key] ?? options.default() }
			cookieRefs.set(key, value)
			return value
		},
		useState(key: string, initial: () => string) {
			const value = { value: serialized[key] ?? initial() }
			states.set(key, value)
			return value
		},
		onMounted: (callback: () => void) => mounted.push(callback),
		onScopeDispose: (callback: () => void) => disposers.push(callback),
		useEventListener(_event: string, callback: typeof storageHandler) { storageHandler = callback },
		window: { matchMedia: () => ({ matches: dark, addEventListener: (_key: string, callback: (event: { matches: boolean }) => void) => mediaHandlers.add(callback), removeEventListener: (_key: string, callback: (event: { matches: boolean }) => void) => mediaHandlers.delete(callback) }) },
		localStorage: { getItem(key: string) {
			if (blocked)
				throw new Error('Blocked')
			return storage.get(key) ?? null
		}, setItem(key: string, value: string) {
			if (blocked)
				throw new Error('Blocked')
			storage.set(key, value)
		} },
	}
	const source = stripTypeScriptTypes(readFileSync(new URL('./useTravelTheme.ts', import.meta.url), 'utf8')).replace(/^import .*$/gm, '').replace('export function useTravelTheme', 'function useTravelTheme')
	const runtime = vm.runInNewContext(`${source}\nuseTravelTheme()`, context) as { palette: { value: string }, appearance: { value: string }, theme: { value: string }, setPalette: (value: string) => void, setAppearance: (value: string) => void }
	return { runtime, mount: () => mounted.forEach(callback => callback()), dispose: () => disposers.forEach(callback => callback()), mediaHandlers, cookieRefs, storage, storageEvent: (key: string, newValue: string | null) => storageHandler({ key, newValue }) }
}

test('prerendered state hydrates consistently before restoring different browser cookies', () => {
	const h = harness({ cookies: { 'travel-palette': 'moss', 'travel-theme': 'dark' }, serialized: { 'travel-palette-value': 'mono', 'travel-theme-value': 'system' } })
	assert.equal(h.runtime.palette.value, 'mono')
	assert.equal(h.runtime.appearance.value, 'system')
	assert.equal(h.runtime.theme.value, 'light')
	h.mount()
	assert.equal(h.runtime.palette.value, 'moss')
	assert.equal(h.runtime.theme.value, 'dark')
})
test('system changes apply only while following system and detach on unmount', () => {
	const h = harness({ dark: true })
	h.mount()
	assert.equal(h.runtime.theme.value, 'dark')
	h.runtime.setAppearance('light')
	h.mediaHandlers.forEach(callback => callback({ matches: true }))
	assert.equal(h.runtime.theme.value, 'light')
	h.runtime.setAppearance('system')
	assert.equal(h.runtime.theme.value, 'dark')
	h.mediaHandlers.forEach(callback => callback({ matches: false }))
	assert.equal(h.runtime.theme.value, 'light')
	h.dispose()
	assert.equal(h.mediaHandlers.size, 0)
})
test('cookie preferences and controls work when local storage is blocked', () => {
	const h = harness({ blocked: true, cookies: { 'travel-theme': 'dark' } })
	h.mount()
	assert.equal(h.runtime.theme.value, 'dark')
	h.runtime.setPalette('rose')
	assert.equal(h.cookieRefs.get('travel-palette')?.value, 'rose')
	assert.equal(h.runtime.palette.value, 'rose')
})
test('cross-tab preference changes update one setting and validate its value', () => {
	const h = harness()
	h.mount()
	h.storageEvent('travel-palette', 'mist')
	h.storageEvent('travel-theme', 'dark')
	assert.equal(h.runtime.palette.value, 'mist')
	assert.equal(h.runtime.theme.value, 'dark')
	h.storageEvent('travel-theme', null)
	assert.equal(h.runtime.appearance.value, 'system')
	assert.equal(h.runtime.palette.value, 'mist')
})
