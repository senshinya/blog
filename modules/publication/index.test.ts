import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { resolve } from 'node:path'
// eslint-disable-next-line test/no-import-node-test -- Use the project's built-in Node test runner.
import test from 'node:test'
import { runInNewContext } from 'node:vm'

interface Page {
	path: string
	file?: string
	children?: Page[]
}

function registeredHooks(isDev: boolean) {
	const hooks = new Map<string, (pages: Page[]) => void>()
	const code = stripTypeScriptTypes(readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
		.replace(/^import .*\n/gm, '')
		.replace('export default defineNuxtModule(', 'const publication = defineNuxtModule('))
	runInNewContext(`${code}\npublication.setup({}, nuxt)`, {
		defineNuxtModule: (module: unknown) => module,
		addTemplate: (template: unknown) => template,
		addTypeTemplate: () => {},
		resolve,
		nuxt: {
			options: { dev: isDev, rootDir: '/fixture', srcDir: '/fixture/app' },
			hook: (name: string, handler: (pages: Page[]) => void) => hooks.set(name, handler),
		},
	})
	return hooks
}

test('production route generation removes preview page imports including localized children', () => {
	const pages: Page[] = [
		{ path: '/', file: '/fixture/app/pages/index.vue' },
		{ path: '/preview', file: '/fixture/app/pages/preview.vue' },
		{ path: '/en/preview', file: '/fixture/app/pages/preview.vue' },
		{ path: '/ja', children: [{ path: 'preview', file: '/fixture/app/pages/preview.vue' }, { path: 'about', file: '/fixture/app/pages/about.vue' }] },
		{ path: '/comments/preview', file: '/fixture/app/pages/comments/preview.vue' },
		{ path: '/:slug(.*)*', file: '/fixture/app/pages/[...slug].vue' },
	]
	registeredHooks(false).get('pages:extend')?.(pages)
	assert.deepEqual(pages.map(page => page.path), ['/', '/ja', '/comments/preview', '/:slug(.*)*'])
	assert.deepEqual(pages[1]!.children!.map(page => page.path), ['about'])
})

test('development keeps the preview page available', () => {
	assert.equal(registeredHooks(true).has('pages:extend'), false)
})
