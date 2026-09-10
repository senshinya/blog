import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
// eslint-disable-next-line test/no-import-node-test -- Use the project's built-in Node test runner.
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { isLocaleSwitch, stripLocale } from './locale.ts'

interface Route {
	path: string
	fullPath: string
	hash: string
	matched: object[]
	meta: Record<string, unknown>
}

function route(path: string): Route {
	return { path, fullPath: path, hash: '', matched: [{}], meta: {} }
}

/** Execute the real navigation guard with browser/Nuxt boundaries replaced. */
function navigation(from: string, to: string, key: string, localeMotion = false) {
	let resolveGuard!: (to: Route, from: Route) => unknown
	let captures = 0
	const noop = () => {}
	const nuxt = { isHydrating: false, hook: () => noop, vueApp: { onUnmount: noop } }
	const router = {
		beforeEach: () => noop,
		beforeResolve: (guard: typeof resolveGuard) => {
			resolveGuard = guard
			return noop
		},
		afterEach: () => noop,
		onError: () => noop,
		currentRoute: { value: route(from) },
	}
	const element = {
		dataset: { transitionKey: key },
		getBoundingClientRect: () => ({ width: 300, height: 100, top: 10, bottom: 110, left: 10, right: 310 }),
	}
	const root = { dataset: {}, classList: { contains: () => localeMotion }, style: { setProperty: noop, removeProperty: noop } }
	const code = stripTypeScriptTypes(readFileSync(new URL('../plugins/article-transition.client.ts', import.meta.url), 'utf8')
		.replace(/^import .*\n/gm, '')
		.replace('export default ', ''))
	runInNewContext(code, {
		defineNuxtPlugin: (plugin: (app: typeof nuxt) => void) => plugin(nuxt),
		blogConfig: { locales: [{ code: 'zh' }, { code: 'en' }, { code: 'ja' }] },
		stripLocale,
		isLocaleSwitch,
		once: (callback: () => void) => callback,
		normalizeContentPath: (path: string) => path.replace(/\/+$/, '') || '/',
		useRouter: () => router,
		usePreferredReducedMotion: () => ({ value: 'no-preference' }),
		useEventBus: () => ({ emit: noop }),
		useEventListener: noop,
		useTimeoutFn: () => ({ stop: noop }),
		nextTick: () => Promise.resolve(),
		getComputedStyle: () => ({ visibility: 'visible' }),
		window: { history: { state: { position: 1 } }, scrollX: 0, scrollY: 0, innerHeight: 900, innerWidth: 1400 },
		document: {
			documentElement: root,
			querySelectorAll: (selector: string) => selector === '[data-transition-key]' ? [element] : [],
			startViewTransition: () => {
				captures++
				return { ready: Promise.resolve(), finished: new Promise(() => {}), skipTransition: noop }
			},
		},
	})
	resolveGuard(route(to), route(from))
	return captures
}

test('same-article language switches never start an article snapshot', () => {
	assert.equal(navigation('/en/daily/foo', '/ja/daily/foo', '/en/daily/foo'), 0)
})

test('localized article routes find unprefixed card and header identities in both directions', () => {
	assert.equal(navigation('/en', '/en/daily/foo/', '/daily/foo'), 1)
	assert.equal(navigation('/ja/daily/foo', '/ja', '/daily/foo'), 1)
})

test('an active locale snapshot cannot be replaced by the article plugin', () => {
	assert.equal(navigation('/', '/daily/foo', '/daily/foo', true), 0)
})
