import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
// eslint-disable-next-line test/no-import-node-test -- Use the project's built-in Node test runner.
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { computed, nextTick, ref, shallowRef } from 'vue'

function createMemoHarness(fetcher?: (url: string, options: { signal?: AbortSignal, query: { pageToken?: string } }) => Promise<unknown>) {
	const source = readFileSync(new URL('./index.vue', import.meta.url), 'utf8').split('<script setup lang="ts">')[1]!.split('</script>')[0]!
	const code = stripTypeScriptTypes(source.replace(/^import .*\n/gm, ''))
	const cache = new Map()
	const payload: Record<string, unknown> = {}
	const localeSwitch = ref(false)
	const pending: Promise<unknown>[] = []
	let requests = 0
	const context = {
		AbortController,
		computed,
		ref,
		nextTick,
		useTemplateRef: () => ref(null),
		onBeforeUnmount: () => {},
		useEventListener: () => {},
		watch: () => {},
		ENTRANCE_SKIP_KEY: 'entrance:skip',
		useState: () => localeSwitch,
		useNuxtData: (key: string) => ({ data: computed(() => cache.get(key)?.data.value ?? payload[key]) }),
		useAppConfig: () => ({ title: 'Blog' }),
		useI18n: () => ({ t: (key: string) => key }),
		useEntranceDelay: () => () => ({}),
		useSeoMeta: () => {},
		parseMemo: (memo: { name: string }) => ({ id: memo.name }),
		usePageViewerReactions: () => ({}),
		$fetch: fetcher ?? (async () => ({ memos: [{ name: `memo-${++requests}` }], nextPageToken: `page-${requests + 1}` })),
		useLazyAsyncData: (key: string, handler: () => Promise<unknown>, options: { getCachedData: (key: string, app: unknown, context: { cause: string }) => unknown }) => {
			const cached = options.getCachedData(key, { payload: { data: payload } }, { cause: 'initial' })
			if (cache.has(key) && cached !== undefined)
				cache.get(key).data.value = cached
			if (!cache.has(key) || cached === undefined) {
				const data = shallowRef()
				const status = ref('pending')
				cache.set(key, { data, status, error: ref() })
				pending.push(handler().then((value) => {
					data.value = value
					payload[key] = value
					status.value = 'success'
				}))
			}
			return {
				...cache.get(key),
				// Nuxt resolves the current entry on every write, even after remount.
				data: computed({
					get: () => cache.get(key).data.value,
					set: value => cache.get(key).data.value = value,
				}),
			}
		},
	}
	const mount = () => {
		const cleanups: (() => void)[] = []
		const page = runInNewContext(`${code}\n;({ memos, nextPageToken, loading, loadMore })`, {
			...context,
			onBeforeUnmount: (cleanup: () => void) => cleanups.push(cleanup),
		})
		return { ...page, unmount: () => cleanups.forEach(cleanup => cleanup()) }
	}
	return { mount, pending, localeSwitch, requests: () => requests }
}

test('locale remount retains fetched memos and the pagination cursor, including appended pages', async () => {
	const { mount, pending, localeSwitch, requests } = createMemoHarness()
	const first = mount()
	await Promise.all(pending)
	assert.equal(first.memos.value.length, 1)
	await first.loadMore()
	assert.equal(first.memos.value.length, 2)
	localeSwitch.value = true
	const translated = mount()
	assert.equal(translated.loading.value, false)
	assert.equal(translated.memos.value.length, 2, 'cached success must include the actual memo list')
	assert.equal(translated.nextPageToken.value, 'page-3')
	assert.equal(requests(), 2, 'switching languages must reuse the memo data')
	await translated.loadMore()
	assert.equal(translated.memos.value.length, 3)
	assert.equal(translated.nextPageToken.value, 'page-4')
})

test('an unmounted pagination request cannot append into a remounted feed', async () => {
	let finishOld!: (value: unknown) => void
	let oldSignal: AbortSignal | undefined
	let paginationRequests = 0
	const { mount, pending } = createMemoHarness(async (_url, { query, signal }) => {
		if (!query.pageToken)
			return { memos: [{ name: 'first' }], nextPageToken: 'page-2' }
		if (++paginationRequests === 1) {
			oldSignal = signal
			// Resolve even after abort to model a response that has already arrived.
			return new Promise(resolve => finishOld = resolve)
		}
		return { memos: [{ name: `batch-${paginationRequests}` }], nextPageToken: `page-${paginationRequests + 1}` }
	})
	const first = mount()
	await Promise.all(pending)
	const oldLoad = first.loadMore()
	first.unmount()
	const current = mount()
	await Promise.all(pending)
	await current.loadMore()
	await current.loadMore()
	finishOld({ memos: [{ name: 'second' }], nextPageToken: 'page-3' })
	await oldLoad
	assert.equal(current.memos.value.length, 3, 'late response must not replace or duplicate the current pages')
	assert.equal(current.nextPageToken.value, 'page-4')
	assert.equal(oldSignal?.aborted, true, 'unmount also cancels network work')
})

const pagePath = new URL('./index.vue', import.meta.url)
const cardPath = new URL('../../components/memo/Card.vue', import.meta.url)

test('hydrates memo cards with the signed-in viewer reaction projection', async () => {
	const page = await readFile(pagePath, 'utf8')

	assert.match(page, /const pageKeys = computed\(\(\) => parsedMemos\.value\.map\(memo => `\/memos\/\$\{memo\.id\}`\)\)/)
	assert.match(page, /const viewerReactions = usePageViewerReactions\(pageKeys\)/)
	assert.match(page, /:viewer-reactions="viewerReactions\[`\/memos\/\$\{memo\.id\}`\]"/)
})

test('memo card prefers the freshest personal reaction state', async () => {
	const card = await readFile(cardPath, 'utf8')

	assert.match(card, /defineProps<ParsedMemo & \{ viewerReactions\?: string\[\] \}>\(\)/)
	assert.match(card, /reacted\.value\?\.viewer_reactions \?\? page\.value\?\.viewer_reactions \?\? props\.viewerReactions/)
	assert.doesNotMatch(card, /<MemoBody v-bind="props"/)
})

test('keeps the reaction border clear of the animated tail clip', async () => {
	const card = await readFile(cardPath, 'utf8')

	assert.match(card, /\.tail-in\s*\{[^}]*padding-bottom:\s*1px;/)
})
