<script setup lang="ts">
import type { Comment, Thread, ThreadPage } from '~/utils/comment'

/**
 * 评论区。文章页和碎语详情页共用，差别只在要不要标题和页面级 reaction。
 *
 * 全站是 SSG，这里的一切都只在客户端跑：预渲染时留一个骨架，
 * 免得把某一刻的评论烤进 HTML（那样新评论要等下次部署才出现）。
 */
const props = withDefaults(defineProps<{
	/** 不传则取当前路由。碎语详情页传 /memos/<id>，与列表卡片的计数同一个 key */
	pageKey?: string
	/** 首次落库时写入的页面标题 */
	title?: string
	/** 显示「评论区」标题 */
	heading?: boolean
	/** 显示页面级 reaction 那一行 */
	reactions?: boolean
	/** reaction 行左边那句归属说明。碎语和文章不是一回事，故可覆写 */
	reactionLabel?: string
}>(), {
	heading: false,
	reactions: false,
	reactionLabel: '读完了？给这篇文章一个反馈',
})

/**
 * 把页面态抛给宿主。碎语卡片自己有一排 reaction，展开后要复用那一排而不是
 * 在评论区里再画一行，故需要拿到权威的 reactions / viewer_reactions。
 */
const emit = defineEmits<{ page: [page: ThreadPage | null] }>()

const route = useRoute()
const api = useCommentApi()
const session = useCommentSession()
const { user, ready: sessionReady } = session
const identity = computed(() => user.value ? commentSessionIdentity(user.value) : null)
const sessionKey = computed(() => user.value ? `user:${user.value.id}` : 'anonymous')
const { pending: loggingOut, failed: logoutFailed, logout } = useCommentLogout(session.logout)

const key = computed(() => props.pageKey ?? commentPageKey(route.path))

/**
 * 文章页和碎语详情页各只有一个评论区，用固定的 #comment 供目录和邮件链接落点。
 * 碎语列表里一屏可以同时展开好几个，那时不能都叫 comment —— 重复 id 会让锚点
 * 一律跳到第一个展开的那张卡片上。（卡片自己的 <li :id> 才是那里的落点。）
 */
const anchorId = computed(() => key.value === commentPageKey(route.path) ? 'comment' : undefined)

const root = useTemplateRef('root')
const listEl = useTemplateRef('list')

const thread = ref<Thread>()
const status = ref<'idle' | 'pending' | 'ready' | 'error'>('idle')
const loadingMore = ref(false)
const order = ref<'asc' | 'desc'>('asc')
/** 邮件深链：只渲染目标那一棵子树，直到用户主动要全部 */
const focusId = ref<number>()
const focusMode = ref(false)
/** 只让最后一次线程请求落地；登出时旧的鉴权响应不能重新写回页面。 */
let threadRequestVersion = 0

const tree = computed(() => buildCommentTree(thread.value?.comments ?? []))
const total = computed(() => thread.value?.total_comments ?? 0)
const pageSubscribed = computed(() => thread.value?.page?.viewer_subscribed ?? true)

async function loadThread() {
	const version = ++threadRequestVersion
	status.value = 'pending'
	try {
		const next = await api.request<Thread>('/api/pages/thread', {
			query: { key: key.value, order: order.value, limit: 50 },
		})
		if (version !== threadRequestVersion)
			return
		thread.value = next
		focusMode.value = false
		status.value = 'ready'
		emit('page', thread.value.page)
	}
	catch {
		if (version !== threadRequestVersion)
			return
		status.value = 'error'
	}
}

/** 邮件里的地址是 /posts/xxx#comment-43 */
async function loadFocus(id: number) {
	const version = ++threadRequestVersion
	status.value = 'pending'
	try {
		const next = await api.request<Thread>('/api/pages/thread/focus', {
			query: { key: key.value, comment_id: id },
		})
		if (version !== threadRequestVersion)
			return
		thread.value = next
		focusMode.value = true
		status.value = 'ready'
		emit('page', thread.value.page)
		await nextTick()
		if (version !== threadRequestVersion)
			return
		document.getElementById(`comment-${id}`)?.scrollIntoView({ block: 'center' })
	}
	catch {
		if (version !== threadRequestVersion)
			return
		// 那条被删了或不在本页，退回普通视图，别让链接变成死路
		await loadThread()
	}
}

async function loadMore() {
	const cursor = thread.value?.next_cursor
	if (!cursor || loadingMore.value)
		return
	const version = threadRequestVersion
	loadingMore.value = true
	try {
		const next = await api.request<Thread>('/api/pages/thread', {
			query: { key: key.value, order: order.value, limit: 50, cursor },
		})
		if (version !== threadRequestVersion)
			return
		thread.value = {
			...next,
			page: next.page ?? thread.value?.page ?? null,
			// focus 响应里没有 cursor，它和普通分页是两条数据，必须按 id 去重合并
			comments: mergeComments(thread.value!.comments, next.comments),
		}
	}
	finally {
		loadingMore.value = false
	}
}

function setOrder(next: 'asc' | 'desc') {
	if (order.value === next)
		return
	order.value = next
	loadThread()
}

// ── 导轨几何 ──────────────────────────────────────────────────
// 只剩折叠钮要量：它得和动作行同心，而动作行的 y 随正文高度变。CSS 里读 --collapse-y。
//
// 导线在哪儿收口不在这儿算了 —— 那要跨两个元素取矩形（父级底边、最后一条回复顶边），
// 而每条评论各有一段带延迟的 float-in，getBoundingClientRect 把 transform 的位移一起
// 算进去，动画期间量出来的距离必然偏小，线就探出弯头一截。现在交给 CSS：导线画到底，
// 最后一条回复拿一块底色补丁擦掉盖住自己的那段（.branchline）。
const REM = 16

function layout() {
	root.value?.querySelectorAll<HTMLElement>('.comment.has-replies').forEach((c) => {
		const foot = c.querySelector<HTMLElement>(':scope > .comment-body > .comment-foot')
		if (foot && !c.classList.contains('collapsed')) {
			// 两个矩形同在一条评论里，float-in 的位移是共同的，相减正好抵掉
			const box = c.getBoundingClientRect()
			const f = foot.getBoundingClientRect()
			c.style.setProperty('--collapse-y', `${Math.round(f.top - box.top + (f.height - REM) / 2)}px`)
		}
		else {
			c.style.removeProperty('--collapse-y')
		}
	})
}

// ── 本地增改删：不为一条评论重取整棵线程 ────────────────────────
function onInserted(comment: Comment) {
	if (!thread.value)
		return
	thread.value.comments = [...thread.value.comments, comment]
	thread.value.total_comments += 1
	nextTick(() => {
		layout()
		document.getElementById(`comment-${comment.id}`)?.scrollIntoView({ block: 'nearest' })
	})
}

function onPatched(comment: Comment) {
	if (!thread.value)
		return
	thread.value.comments = thread.value.comments.map(c => c.id === comment.id ? comment : c)
	nextTick(layout)
}

function onRemoved(id: number) {
	if (!thread.value)
		return
	// 服务端是软删除，线程的形状要留着，否则下面的回复会变成孤儿
	thread.value.comments = thread.value.comments.map(c => c.id === id
		? { id: c.id, parent_id: c.parent_id, depth: c.depth, deleted: true }
		: c)
	thread.value.total_comments = Math.max(0, thread.value.total_comments - 1)
	nextTick(layout)
}

/** 删除请求失败：把墓碑换回原样那条，计数也补回来 */
function onRestored(comment: Comment) {
	if (!thread.value)
		return
	thread.value.comments = thread.value.comments.map(c => c.id === comment.id ? comment : c)
	thread.value.total_comments += 1
	nextTick(layout)
}

function onPageReaction(payload: { reactions: Record<string, number>, viewer_reactions: string[] }) {
	if (thread.value?.page) {
		thread.value.page.reactions = payload.reactions
		thread.value.page.viewer_reactions = payload.viewer_reactions
		emit('page', thread.value.page)
	}
}

onMounted(() => {
	session.load()
	const id = parseCommentHash(location.hash)
	focusId.value = id
	if (id)
		loadFocus(id)
	else
		loadThread()

	// 正文高度随图片、字体到位而变，量一次不够
	const ro = new ResizeObserver(layout)
	watch(listEl, (el) => {
		ro.disconnect()
		if (el)
			ro.observe(el)
	}, { immediate: true })
	onScopeDispose(() => ro.disconnect())

	useEventListener('resize', layout)
	document.fonts?.ready.then(layout)
})

watch(tree, () => nextTick(layout))

watch(user, (next, previous) => {
	if (previous && !next) {
		// 先抹掉带 can_edit / viewer_reactions 的旧投影，再以匿名会话重取。
		// sessionKey 同时会重建子组件，丢弃尚未落地的本地编辑与 reaction 状态。
		thread.value = undefined
		focusMode.value = false
		emit('page', null)
		void loadThread()
	}
})
</script>

<template>
<section :id="anchorId" ref="root" class="z-comment">
	<!-- 页面级 reaction 是对文章的，不是对对话的：给它一句归属说明，
		用一条细线跟评论分开，而不是让它裸浮在编辑框上方 -->
	<div v-if="reactions" class="page-react">
		<span class="lb">{{ reactionLabel }}</span>
		<CommentReactions
			:key="sessionKey"
			target-type="page"
			:page-key="key"
			:title
			:reactions="thread?.page?.reactions"
			:viewer-reactions="thread?.page?.viewer_reactions"
			:settled="status === 'ready'"
			@update="onPageReaction"
		/>

		<!-- 宿主往这一行的右端塞东西。碎语详情页放的是完整时刻：
			那是正文的落款，与其单占一行，不如和这排控件挤在同一条基线上 -->
		<span v-if="$slots['react-aside']" class="aside">
			<slot name="react-aside" />
		</span>
	</div>

	<div v-if="heading" class="comment-head">
		<h3 class="text-creative">
			评论区
		</h3>
	</div>

	<!-- 未登录是一条横幅，不是一个大空框：空编辑框对没打算评论的人是纯粹的视觉负担 -->
	<Transition name="comment-session" mode="out-in">
		<div v-if="sessionReady && !user" key="anonymous" class="signin">
			<span>用 GitHub 账号参与讨论</span>
			<span class="grow" />
			<button type="button" class="btn-github" @click="session.login(returnToNearest(root))">
				<Icon name="tabler:brand-github" />
				登录
			</button>
		</div>

		<div v-else-if="user && identity" key="signed-in" class="session-user">
			<div class="session-identity">
				<UtilLink :to="identity.profile" class="session-identity-link">
					<img
						class="session-avatar"
						:src="user.avatar_url"
						alt=""
						width="28"
						height="28"
					>
					<span class="session-name">{{ identity.name }}</span>
				</UtilLink>
				<span v-if="!logoutFailed" class="session-source">已通过 GitHub 登录</span>
				<span v-else class="session-error session-error-desktop" aria-live="polite">退出失败，请重试</span>
				<span class="session-grow" />
				<button type="button" class="session-logout" :disabled="loggingOut" @click="logout">
					{{ loggingOut ? '退出中…' : '退出登录' }}
				</button>
			</div>
			<span v-if="logoutFailed" class="session-error session-error-mobile" aria-live="polite">退出失败，请重试</span>

			<CommentComposer
				:page-key="key"
				:title
				:subscribed="pageSubscribed"
				@submitted="onInserted"
			/>
		</div>
	</Transition>

	<!-- 邮件点进来时只渲染目标那一棵子树 -->
	<div v-if="focusMode" class="focus-bar">
		<span>正在查看单条回复的上下文</span>
		<span class="grow" />
		<button type="button" @click="loadThread()">
			查看全部 {{ total }} 条评论
		</button>
	</div>

	<div v-else-if="total" class="sort-row">
		<div class="sort">
			<button type="button" :aria-pressed="order === 'asc'" @click="setOrder('asc')">
				最早
			</button>
			<span class="sep">/</span>
			<button type="button" :aria-pressed="order === 'desc'" @click="setOrder('desc')">
				最新
			</button>
		</div>
	</div>

	<div v-if="status === 'pending'" class="skeleton">
		<div v-for="i in 2" :key="i" class="sk-row">
			<div class="sk sk-avatar" />
			<div class="sk-lines">
				<div v-for="w in ['30%', '85%', '60%']" :key="w" class="sk" :style="{ width: w }" />
			</div>
		</div>
	</div>

	<div v-else-if="status === 'error'" class="state error">
		<span class="big">评论加载失败</span>
		<span class="small">服务暂时没有响应</span>
		<button type="button" class="btn-github" @click="loadThread()">
			重试
		</button>
	</div>

	<div v-else-if="!tree.length" class="state">
		<span class="big">还没有人说话</span>
		<span class="small">来做第一个</span>
	</div>

	<ol v-else :key="sessionKey" ref="list" class="comment-list">
		<CommentItem
			v-for="(node, i) in tree"
			:key="node.id"
			:node
			:page-key="key"
			:title
			:page-subscribed="pageSubscribed"
			:focus-id="focusId"
			:index="i"
			@inserted="onInserted"
			@patched="onPatched"
			@removed="onRemoved"
			@restored="onRestored"
		/>
	</ol>

	<button
		v-if="thread?.next_cursor && !focusMode"
		type="button"
		class="more"
		:disabled="loadingMore"
		@click="loadMore()"
	>
		{{ loadingMore ? '加载中…' : '加载更早的评论' }}
	</button>
</section>
</template>
