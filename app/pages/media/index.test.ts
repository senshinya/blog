import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
// eslint-disable-next-line test/no-import-node-test -- Vitest is not a project dependency; use Node's built-in runner.
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { computed, ref } from 'vue'

const pagePath = new URL('./index.vue', import.meta.url)
const cardPath = new URL('../../components/media/Card.vue', import.meta.url)
const skeletonPath = new URL('../../components/media/CardSkeleton.vue', import.meta.url)

test('renders eight accessible media card placeholders during full-page loading', async () => {
	const page = await readFile(pagePath, 'utf8')

	assert.match(page, /<template v-else-if="loading">/)
	assert.match(page, /v-for="index in 8"/)
	assert.match(page, /<MediaCardSkeleton\s*\/>/)
	assert.match(page, /aria-hidden="true"/)
	assert.match(page, /:aria-busy="loading"/)
	assert.doesNotMatch(page, /\$t\('page\.media\.loading'\)/)
	assert.doesNotMatch(page, /<p v-else-if="loading" class="media-tip">/)
})

test('keeps media skeleton motion optional', async () => {
	const skeleton = await readFile(skeletonPath, 'utf8')

	assert.match(skeleton, /@media \(prefers-reduced-motion: reduce\)/)
	assert.match(skeleton, /animation: none/)
})

test('does not replay the card entrance animation after skeletons resolve', async () => {
	const [page, card] = await Promise.all([
		readFile(pagePath, 'utf8'),
		readFile(cardPath, 'utf8'),
	])

	assert.doesNotMatch(card, /animation:\s*float-in/)
	assert.match(page, /<TransitionGroup[^>]+name="float-in"/)
})

function createMediaHarness() {
	const source = readFileSync(pagePath, 'utf8').split('<script setup lang="ts">')[1]!.split('</script>')[0]!
	const code = stripTypeScriptTypes(source.replace(/^import .*\n/gm, ''))
	const requests: { resolve: (value: unknown) => void, reject: (error: Error) => void }[] = []
	let height = 0
	const page = runInNewContext(`${code}\n;({ reload, loadMore, items, loading, loadingMore, error, getLoadingHeight: () => typeof loadingHeight === 'undefined' ? undefined : loadingHeight.value })`, {
		computed,
		ref,
		URLSearchParams,
		useTemplateRef: () => ref({ getBoundingClientRect: () => ({ height }) }),
		useAppConfig: () => ({ title: 'Blog', bangumi: { uid: 'user', apiProxy: '' } }),
		useI18n: () => ({ t: (key: string) => key }),
		useEntranceDelay: () => () => ({}),
		useSeoMeta: () => {},
		useRoute: () => ({ query: {} }),
		useRouter: () => ({ push: () => {} }),
		BGM_CATEGORIES: [{ key: 'anime', subjectType: 2 }],
		BGM_STATUS_KEYS: ['done', 'doing', 'wish'],
		BGM_STATUS_TYPES: [2, 3, 1],
		withBgmProxy: (_proxy: string, url: string) => url,
		$fetch: () => new Promise((resolve, reject) => requests.push({ resolve, reject })),
		onMounted: () => {},
		watch: () => {},
	})
	return {
		page,
		requests,
		setHeight: (value: number) => {
			height = value
		},
	}
}

test('filter loading hides stale results immediately and reserves their height until the replacement resolves', async () => {
	const { page, requests, setHeight } = createMediaHarness()
	const first = page.reload()
	requests[0]!.resolve({ data: [{ subject_id: 1 }], total: 2 })
	await first
	setHeight(1944)
	const filtering = page.reload()
	assert.equal(page.loading.value, true)
	assert.equal(page.items.value.length, 0)
	assert.equal(page.getLoadingHeight(), 1944)
	await Promise.resolve()
	assert.equal(page.loading.value, true, 'slow requests keep the immediate skeleton feedback')
	requests[1]!.resolve({ data: [{ subject_id: 2 }], total: 1 })
	await filtering
	assert.equal(page.loading.value, false)
	assert.equal(page.items.value[0].subject_id, 2)
	const source = await readFile(pagePath, 'utf8')
	assert.match(source, /ref="results"/)
	assert.match(source, /:aria-busy="loading"/)
	assert.match(source, /height: `\$\{loadingHeight\}px`/)
	assert.match(source, /overflow: hidden/)
})

test('rapid filters preserve the same reserved area and ignore stale successes and errors', async () => {
	const { page, requests, setHeight } = createMediaHarness()
	const first = page.reload()
	requests[0]!.resolve({ data: [{ subject_id: 1 }], total: 1 })
	await first
	setHeight(180)
	const obsoleteSuccess = page.reload()
	setHeight(768)
	const obsoleteError = page.reload()
	const latest = page.reload()
	assert.equal(page.getLoadingHeight(), 180, 'do not capture the intermediate skeleton height')
	requests[1]!.resolve({ data: [{ subject_id: 2 }], total: 1 })
	requests[2]!.reject(new Error('old filter failed'))
	await Promise.all([obsoleteSuccess, obsoleteError])
	assert.equal(page.loading.value, true)
	assert.equal(page.items.value.length, 0)
	assert.equal(page.error.value, undefined)
	requests[3]!.resolve({ data: [], total: 0 })
	await latest
	assert.equal(page.loading.value, false)
	assert.equal(page.items.value.length, 0)
})

test('switching filters releases a pending load-more state and permits pagination on the new results', async () => {
	const { page, requests } = createMediaHarness()
	const first = page.reload()
	requests[0]!.resolve({ data: [{ subject_id: 1 }], total: 2 })
	await first
	const oldMore = page.loadMore()
	assert.equal(page.loadingMore.value, true)
	const filtering = page.reload()
	assert.equal(page.loadingMore.value, false)
	await page.loadMore()
	assert.equal(requests.length, 3, 'pagination must not start during filter loading')
	requests[2]!.resolve({ data: [{ subject_id: 3 }], total: 2 })
	await filtering
	const currentMore = page.loadMore()
	requests[1]!.resolve({ data: [{ subject_id: 2 }], total: 2 })
	await oldMore
	assert.equal(page.loadingMore.value, true, 'obsolete pagination cannot finish the new request')
	requests[3]!.resolve({ data: [{ subject_id: 4 }], total: 2 })
	await currentMore
	assert.equal(page.loadingMore.value, false)
	assert.deepEqual(Array.from(page.items.value, (item: { subject_id: number }) => item.subject_id), [3, 4])
})

test('a failed replacement exits the skeleton and can be retried immediately', async () => {
	const { page, requests } = createMediaHarness()
	const failed = page.reload()
	requests[0]!.reject(new Error('offline'))
	await failed
	assert.equal(page.loading.value, false)
	assert.equal(page.error.value.message, 'offline')
	const retry = page.reload()
	assert.equal(page.loading.value, true)
	assert.equal(page.error.value, undefined)
	requests[1]!.resolve({ data: [], total: 0 })
	await retry
	assert.equal(page.loading.value, false)
})
