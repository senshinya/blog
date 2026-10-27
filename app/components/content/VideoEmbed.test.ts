import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
// eslint-disable-next-line test/no-import-node-test -- Use the project's built-in Node test runner.
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { computed, ref } from 'vue'

test('server-rendered video embeds do not retain global transition listeners', () => {
	const source = readFileSync(new URL('./VideoEmbed.vue', import.meta.url), 'utf8')
		.split('<script setup lang="ts">')[1]!
		.split('</script>')[0]!
	const code = stripTypeScriptTypes(source.replaceAll('import.meta.client', 'false'))
	let subscriptions = 0
	const noop = () => {}
	for (let request = 0; request < 3; request++) {
		runInNewContext(code, {
			computed,
			ref,
			defineProps: () => ({ type: 'youtube', id: 'test' }),
			withDefaults: (props: unknown) => props,
			useTemplateRef: () => ref(),
			useIntersectionObserver: noop,
			useResizeObserver: noop,
			onMounted: noop,
			watch: noop,
			useEventBus: () => ({ on: () => subscriptions++ }),
		})
	}
	assert.equal(subscriptions, 0, 'SSR scopes cannot dispose listeners held by the shared client event bus')
})
