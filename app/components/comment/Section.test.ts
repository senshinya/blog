import type { Ref } from 'vue'
import type { Comment, CommentTree, Thread } from '../../utils/comment.ts'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
// eslint-disable-next-line test/no-import-node-test -- Use the project's built-in Node test runner.
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { computed, effectScope, nextTick, onScopeDispose, reactive, ref, watch } from 'vue'
import useCommentSessionScope from '../../composables/useCommentSessionScope.ts'
import * as commentUtils from '../../utils/comment.ts'

interface SectionState {
	thread: Ref<Thread>
	tree: Ref<CommentTree[]>
	status: Ref<string>
	loadThread: (preserveReading: boolean) => Promise<void>
	loadFocus: (id: number, preserveReading: boolean) => Promise<void>
	onPatched: (comment: Comment) => void
	onRemoved: (id: number) => void
	onInserted: (comment: Comment) => void
	onPageReaction: (payload: { reactions: Record<string, number>, viewer_reactions: string[] }) => void
}

function snapshot(): Thread {
	return {
		page: { id: 1, key: '/memos/one', title: 'Memo', reactions: {}, viewer_reactions: [], viewer_subscribed: true },
		comments: [{ id: 1, parent_id: null, depth: 0, deleted: false, body_html: 'Original', reactions: {}, viewer_reactions: [] }],
		total_comments: 1,
		next_cursor: null,
	}
}

function mountSection() {
	const source = readFileSync(new URL('./Section.vue', import.meta.url), 'utf8').split('<script setup lang="ts">')[1]!.split('</script>')[0]!
	const code = stripTypeScriptTypes(source.replace(/^import .*\n/gm, ''))
	const requests: { path: string, resolve: (thread: Thread) => void }[] = []
	const epoch = ref(0)
	const scope = effectScope()
	const section = scope.run(() => runInNewContext(`${code}\n;({ thread, tree, status, loadThread, loadFocus, onPatched, onRemoved, onInserted, onPageReaction })`, {
		...commentUtils,
		computed,
		nextTick,
		onScopeDispose,
		reactive,
		ref,
		watch,
		useCommentSessionScope,
		blogConfig: { locales: [{ code: 'zh' }, { code: 'en' }] },
		defineProps: () => ({ pageKey: '/memos/one' }),
		withDefaults: (props: unknown) => props,
		defineEmits: () => () => {},
		useI18n: () => ({ t: (key: string) => key, locale: ref('en') }),
		useRoute: () => ({ path: '/en/memos/one', hash: '' }),
		useCommentApi: () => ({ request: (path: string) => new Promise<Thread>(resolve => requests.push({ path, resolve })) }),
		useCommentSession: () => ({ user: ref(null), ready: ref(true), epoch, dataRevisions: ref({}) }),
		useCommentLogout: () => ({}),
		useCommentSessionMenu: () => ({ close: () => {} }),
		useTemplateRef: () => ref(null),
		useId: () => 'session-menu',
		onClickOutside: () => {},
		onMounted: () => {},
		captureCommentText: () => new Map(),
		animateCommentTranslation: () => () => {},
		document: { getElementById: () => null },
	})) as SectionState
	section.thread.value = snapshot()
	return { section, requests, epoch, stop: () => scope.stop() }
}

const mutations: Record<string, (section: SectionState) => void> = {
	'edit': section => section.onPatched({ ...section.thread.value.comments[0]!, body_html: 'Edited' }),
	'delete': section => section.onRemoved(1),
	'reply': section => section.onInserted({ id: 2, parent_id: 1, depth: 1, deleted: false, body_html: 'Reply' }),
	'comment reaction': (section) => {
		// Item.onReaction mutates the rendered tree node, not the flat API comment.
		section.tree.value[0]!.reactions = { heart: 1 }
		section.tree.value[0]!.viewer_reactions = ['heart']
	},
	'page reaction': section => section.onPageReaction({ reactions: { heart: 1 }, viewer_reactions: ['heart'] }),
}

for (const mode of ['thread', 'focus'] as const) {
	for (const [name, mutate] of Object.entries(mutations)) {
		test(`${mode} refresh rejects a delayed snapshot after a local ${name}`, async (t) => {
			const { section, requests, stop } = mountSection()
			t.after(stop)
			const refresh = mode === 'thread' ? section.loadThread(true) : section.loadFocus(1, true)
			mutate(section)
			const localThread = section.thread.value
			const localTree = section.tree.value
			requests[0]!.resolve(snapshot())
			await new Promise(setImmediate)
			assert.equal(section.thread.value, localThread, 'the stale response must not replace locally updated data')
			assert.equal(section.tree.value, localTree, 'the retained discussion must survive the retry')
			assert.equal(requests.length, 2, 'request a fresh authoritative snapshot after the mutation')
			assert.equal(requests[1]!.path, requests[0]!.path, 'focused discussions must stay focused')
			const fresh: Thread = JSON.parse(JSON.stringify(localThread))
			fresh.comments[0]!.reactions = localTree[0]!.reactions
			fresh.comments[0]!.viewer_reactions = localTree[0]!.viewer_reactions
			requests[1]!.resolve(fresh)
			await refresh
			assert.equal(section.status.value, 'ready')
			assert.equal(JSON.stringify(section.thread.value), JSON.stringify(fresh))
		})
	}
}

test('a disposed section never retries a stale read after a local mutation', async () => {
	const { section, requests, stop } = mountSection()
	const refresh = section.loadThread(true)
	mutations.edit!(section)
	stop()
	requests[0]!.resolve(snapshot())
	await refresh
	assert.equal(requests.length, 1)
	assert.equal(section.thread.value.comments[0]!.body_html, 'Edited')
})

test('a replaced session cannot retry its stale snapshot over the new session', async (t) => {
	const { section, requests, epoch, stop } = mountSection()
	t.after(stop)
	const refresh = section.loadThread(true)
	mutations.edit!(section)
	epoch.value++
	assert.equal(requests.length, 2, 'the session change starts its own authoritative read')
	requests[0]!.resolve(snapshot())
	await refresh
	assert.equal(requests.length, 2, 'the obsolete session must not start a mutation retry')
	assert.equal(section.thread.value, undefined, 'old personal projections stay cleared')
	requests[1]!.resolve(snapshot())
	await new Promise(setImmediate)
	assert.equal(section.status.value, 'ready')
})

test('a refresh without concurrent writes commits once without a retry', async (t) => {
	const { section, requests, stop } = mountSection()
	t.after(stop)
	const refresh = section.loadThread(true)
	const fresh = snapshot()
	fresh.comments[0]!.body_html = 'Translated'
	requests[0]!.resolve(fresh)
	await refresh
	assert.equal(requests.length, 1)
	assert.equal(section.status.value, 'ready')
	assert.equal(section.thread.value.comments[0]!.body_html, 'Translated')
})
