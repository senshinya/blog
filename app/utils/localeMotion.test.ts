import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
// eslint-disable-next-line test/no-import-node-test -- Use the project's built-in Node test runner.
import test from 'node:test'
import { runInNewContext } from 'node:vm'

for (const skipped of [false, true]) {
	test(`locale cleanup prevents native entrance replay (${skipped ? 'skipped' : 'finished'} snapshot)`, async () => {
		let finish!: () => void
		let reject!: (reason: Error) => void
		const finished = new Promise<void>((resolve, fail) => {
			finish = resolve
			reject = fail
		})
		const oldWidget = { dataset: {} as Record<string, string> }
		const newWidget = { dataset: {} as Record<string, string> }
		let elements = [oldWidget]
		let enteredAtCleanup: boolean[] = []
		const classes = new Set<string>()
		const code = stripTypeScriptTypes(readFileSync(new URL('./localeMotion.ts', import.meta.url), 'utf8')
			.replace(/^import .*\n/gm, '')
			.replace('export async function', 'async function'))
		const context = {
			blogConfig: { locales: [{ code: 'zh' }, { code: 'en' }] },
			matchMedia: () => ({ matches: false }),
			CSS: { supports: () => true },
			document: {
				documentElement: { classList: {
					add: (name: string) => classes.add(name),
					remove: (name: string) => {
						enteredAtCleanup = elements.map(el => el.dataset.nativeEntered === '')
						classes.delete(name)
					},
				} },
				querySelectorAll: (selector: string) => selector === '[data-transition-enter]' ? elements : [],
				startViewTransition: (update: () => Promise<void>) => ({
					ready: Promise.resolve(),
					finished,
					updateCallbackDone: update(),
					skipTransition: () => {},
				}),
			},
		}
		const run = runInNewContext(`${code}\nrunLocaleMotion`, context) as (update: () => Promise<void>) => Promise<void>
		await run(async () => {
			elements = [oldWidget, newWidget]
		})
		assert.equal(classes.has('locale-motion'), true)
		if (skipped)
			reject(new Error('Browser skipped transition'))
		else
			finish()
		await new Promise(resolve => setImmediate(resolve))
		assert.equal(classes.has('locale-motion'), false)
		assert.deepEqual(enteredAtCleanup, [true, true], 'reused and newly rendered widgets must not restart entrance when suppression is removed')
	})
}
