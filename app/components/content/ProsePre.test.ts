import type { Ref } from 'vue'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
// eslint-disable-next-line test/no-import-node-test -- Use the project's built-in Node test runner.
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { escape } from 'es-toolkit/string'
import { computed, effectScope, onScopeDispose, ref } from 'vue'

function mountCodeblock() {
	const source = readFileSync(new URL('./ProsePre.vue', import.meta.url), 'utf8').split('<script setup lang="ts">')[1]!.split('</script>')[0]!
	const code = stripTypeScriptTypes(source.replace(/^import .*\n/gm, ''))
	const scope = effectScope()
	const mounted: (() => unknown)[] = []
	const requests: { code: string, options: { language: string }, resolve: (html: string) => void, reject: (error: Error) => void }[] = []
	let intersect: (entries: { isIntersecting: boolean }[]) => unknown = () => {}
	let observerOptions: { rootMargin?: string } = {}
	let observerStops = 0
	const plaintext = '<script>alert("safe")</script>\n'
	const component = scope.run(() => runInNewContext(`${code}\n;({ rawHtml, codeblock })`, {
		computed,
		escape,
		ref,
		onScopeDispose,
		TextEncoder,
		defineProps: () => ({ code: plaintext, meta: '', language: 'html' }),
		withDefaults: (props: unknown) => props,
		useAppConfig: () => ({ component: { codeblock: { triggerRows: 10, indent: 4, enableIndentGuide: true } } }),
		useToggle: (value: boolean) => [ref(value), () => {}],
		useTemplateRef: () => ref({}),
		useCopy: () => ({ copy: () => {}, copied: ref(false) }),
		useShiki: () => ({ codeToHtml: (code: string, options: { language: string }) => new Promise<string>((resolve, reject) => requests.push({ code, options, resolve, reject })) }),
		onMounted: (callback: () => unknown) => mounted.push(callback),
		useIntersectionObserver: (_target: unknown, callback: typeof intersect, options: typeof observerOptions) => {
			intersect = callback
			observerOptions = options
			return { stop: () => observerStops++ }
		},
	})) as { rawHtml: Ref<string>, codeblock: Ref<unknown> }
	for (const callback of mounted)
		void callback()
	return {
		component,
		plaintext,
		requests,
		intersect: (visible: boolean) => intersect([{ isIntersecting: visible }]),
		observerOptions: () => observerOptions,
		observerStops: () => observerStops,
		stop: () => scope.stop(),
	}
}

test('offscreen code keeps escaped plaintext without starting highlighting', (t) => {
	const block = mountCodeblock()
	t.after(block.stop)
	block.intersect(false)
	assert.equal(block.requests.length, 0)
	assert.equal(block.component.rawHtml.value, escape(block.plaintext))
})

test('approaching the viewport highlights once, preserving the language and result', async (t) => {
	const block = mountCodeblock()
	t.after(block.stop)
	assert.equal(block.observerOptions().rootMargin, '200px')
	const pending = block.intersect(true)
	block.intersect(true)
	assert.equal(block.requests.length, 1)
	assert.equal(block.observerStops(), 1)
	assert.equal(block.requests[0]!.code, block.plaintext.trimEnd())
	assert.equal(block.requests[0]!.options.language, 'html')
	const highlighted = '<code><span class="line">highlighted</span></code>'
	block.requests[0]!.resolve(highlighted)
	await pending
	assert.equal(block.component.rawHtml.value, highlighted)
	block.intersect(false)
	block.intersect(true)
	assert.equal(block.requests.length, 1)
})

test('resolved highlighting cannot write into a disposed component', async () => {
	const block = mountCodeblock()
	const pending = block.intersect(true)
	block.stop()
	block.requests[0]!.resolve('<code>late result</code>')
	await pending
	// Also flush the old onMounted implementation to expose its stale write.
	await new Promise(setImmediate)
	assert.equal(block.component.rawHtml.value, escape(block.plaintext))
})

test('a queued intersection cannot start highlighting after disposal', () => {
	const block = mountCodeblock()
	block.stop()
	block.intersect(true)
	assert.equal(block.requests.length, 0)
})

for (const disposed of [false, true]) {
	test(`failed highlighting retains plaintext without rejecting${disposed ? ' after disposal' : ''}`, async (t) => {
		const block = mountCodeblock()
		t.after(block.stop)
		const pending = block.intersect(true)
		if (disposed)
			block.stop()
		block.requests[0]!.reject(new Error('Language download failed'))
		await pending
		assert.equal(block.component.rawHtml.value, escape(block.plaintext))
		block.intersect(true)
		assert.equal(block.requests.length, 1)
	})
}
