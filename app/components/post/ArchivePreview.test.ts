import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
// eslint-disable-next-line test/no-import-node-test -- Use the project's built-in Node test runner.
import test from 'node:test'
import vm from 'node:vm'

function preview() {
	const frames = new Map<number, () => void>()
	let sequence = 0
	const card = { value: { style: { translate: '' } } }
	const script = readFileSync(new URL('./ArchivePreview.vue', import.meta.url), 'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)![1]!
	const runtime = vm.runInNewContext(`${stripTypeScriptTypes(script)}\n;({ onPointerMove, hide })`, {
		ref: (value: unknown) => ({ value }),
		useTemplateRef: () => card,
		usePreferredReducedMotion: () => ({ value: 'no-preference' }),
		onMounted: (callback: () => void) => callback(),
		onBeforeUnmount() {},
		window: { innerWidth: 1440, innerHeight: 1000, matchMedia: () => ({ matches: true }) },
		requestAnimationFrame(callback: () => void) {
			frames.set(++sequence, callback)
			return sequence
		},
		cancelAnimationFrame(id: number) { frames.delete(id) },
	})
	function move(x: number) {
		runtime.onPointerMove({ clientX: x, clientY: 100, target: { closest: () => ({ dataset: { cover: '/cover.jpg' } }) } })
	}
	function tick() {
		const callbacks = [...frames.values()]
		frames.clear()
		callbacks.forEach(callback => callback())
	}
	return { frames, card, move, tick, hide: runtime.hide }
}

test('archive cover stops requesting frames when still and resumes following a new pointer position', () => {
	const p = preview()
	p.move(100)
	for (let i = 0; i < 120; i++) p.tick()
	assert.equal(p.frames.size, 0, 'a stationary pointer must not keep a permanent animation loop alive')
	p.move(600)
	assert.equal(p.frames.size, 1, 'moving the pointer restarts the spring')
	for (let i = 0; i < 120; i++) p.tick()
	assert.equal(p.frames.size, 0)
	assert.equal(p.card.value.style.translate, '624px 118px')
	p.move(400)
	p.hide()
	assert.equal(p.frames.size, 0, 'leaving the archive cancels pending work')
})
