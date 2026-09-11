import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
// eslint-disable-next-line test/no-import-node-test -- Use the project's built-in Node test runner.
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { ref } from 'vue'

function mountScore() {
	const source = readFileSync(new URL('./MusicScore.vue', import.meta.url), 'utf8').split('<script setup lang="ts">')[1]!.split('</script>')[0]!
	const code = stripTypeScriptTypes(source.replace(/^import .*\n/gm, '').replace('import(\'abcjs\')', 'loadAbc()'))
	let render = async (_active: () => boolean) => {}
	let finish: (module: unknown) => void = () => {}
	let requests = 0
	let renders = 0
	let active = true
	const state = runInNewContext(`${code}; ({ failed, pending })`, {
		ref,
		defineProps: () => ({ abc: 'X:1\nK:C\nCDEF|' }),
		useTemplateRef: () => ref({}),
		useVisibleTask: (_target: unknown, callback: typeof render) => render = callback,
		loadAbc: () => {
			requests++
			return new Promise(resolve => finish = resolve)
		},
		onUnmounted: () => {},
		console: { error: () => {} },
	})
	return {
		state,
		requests: () => requests,
		renders: () => renders,
		visible: () => render(() => active),
		dispose: () => active = false,
		resolve: () => finish({
			renderAbc: () => {
				renders++
				return [{}]
			},
			synth: { supportsAudio: () => false },
		}),
		fail: () => finish({ renderAbc: () => { throw new Error('invalid score') } }),
	}
}

test('music imports only when visible and renders the score without requiring audio', async () => {
	const score = mountScore()
	assert.equal(score.requests(), 0)
	const pending = score.visible()
	assert.equal(score.requests(), 1)
	score.resolve()
	await pending
	assert.equal(score.renders(), 1)
	assert.equal(score.state.pending.value, false)
	assert.equal(score.state.failed.value, false)
})

test('late music import never renders after the owner is disposed', async () => {
	const score = mountScore()
	const pending = score.visible()
	score.dispose()
	score.resolve()
	await pending
	assert.equal(score.renders(), 0)
})

test('music renderer errors produce a readable ABC fallback without rejecting', async () => {
	const score = mountScore()
	const pending = score.visible()
	score.fail()
	await pending
	assert.equal(score.state.failed.value, true)
	assert.equal(score.state.pending.value, false)
})
