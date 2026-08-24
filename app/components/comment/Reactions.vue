<script setup lang="ts">
import { CommentError } from '~/composables/useCommentApi'

/** 服务端每次都回整份，故本地也一律整份地换，不做增量拼接 */
interface ReactionState {
	reactions: Record<string, number>
	viewer_reactions: string[]
}

/**
 * 一排 reaction chip，页面级和评论级共用。
 *
 * 已参与的是实心 —— giscus 没做好的一件事就是你点没点过看不出来。
 * 「＋」平时隐身（ghost），hover 到这条评论上才浮现：零互动是常态，
 * 二十条评论各挂一个灰按钮太吵。
 */
const props = withDefaults(defineProps<{
	targetType: 'comment' | 'page'
	/** targetType 为 comment 时必填 */
	targetId?: number
	/** targetType 为 page 时必填。comment 也建议带上：登录暂存的意图要靠它认页 */
	pageKey?: string
	title?: string
	reactions?: Record<string, number>
	viewerReactions?: string[]
	/**
	 * 动手之前先把权威状态取回来。
	 *
	 * 碎语卡片收起时手里只有 /api/pages/counts 的数字 —— 那个接口是无会话的
	 * （要能被缓存），不回 viewer_reactions，也就不知道你点没点过。
	 * 不先问一次就切换，会把「取消」做成「添加」。
	 */
	resolve?: () => Promise<void>
	/**
	 * 上游数据是否已到位。只用来卡「登录回来后补发那一下」——
	 * 抢在线程 GET 前面把 PUT 发出去，会被随后回来的旧快照盖掉，
	 * 表现为登录转了一圈回来，reaction 还是没加上。
	 */
	settled?: boolean
}>(), { settled: true })

const emit = defineEmits<{
	update: [payload: ReactionState]
}>()

const api = useCommentApi()
const session = useCommentSession()
const { user, ready, login, epoch: sessionEpoch } = session
const sessionScope = useCommentSessionScope(sessionEpoch)

const root = useTemplateRef('root')
const picking = ref(false)

/**
 * 展开的那一排。收起时给空数组，而不是 v-if 掉整组 —— TransitionGroup 得一直挂着，
 * 才轮得到它给每个 chip 跑进出场。
 */
const tray = computed(() => picking.value ? REACTIONS : [])

/** 在途请求数。样式先行之后，它决定谁有资格把服务端那份权威快照写回来 */
let pending = 0
/** 同一个 target 上的请求排队发：PUT 和 DELETE 撞在一起，服务端按哪个算是不定的 */
let chain: Promise<void> = Promise.resolve()

/**
 * 乐观层：点下去那一刻先写这里，等服务端回话再写回权威值。
 *
 * 不能只靠 emit 出去等 props 回来 —— props 要等父组件重渲染才更新，隔了一拍，
 * 连点两下时第二下会读到第一下之前的状态，把「加」算成「减」。
 */
const local = ref<ReactionState>()

const view = computed<ReactionState>(() => local.value ?? {
	reactions: props.reactions ?? {},
	viewer_reactions: props.viewerReactions ?? [],
})

/**
 * 上游换了数据（线程重取、卡片首次问到权威状态）就以它为准。
 * 有请求在途时不让 —— 那份快照里没有刚点上去的那几个。
 */
watch(() => [props.reactions, props.viewerReactions], () => {
	if (!pending)
		local.value = undefined
})

const chips = computed(() => toReactionChips(view.value.reactions, view.value.viewer_reactions))
const mine = computed(() => new Set(view.value.viewer_reactions))

const body = computed(() => props.targetType === 'comment'
	? { target_type: 'comment', target_id: props.targetId }
	: { target_type: 'page', key: props.pageKey, title: props.title })

/**
 * 翻一个 emoji：加就 +1 并记名，减就 -1 并抹掉。
 * 纯函数，且再翻一次正好复原 —— 失败回滚用的也是它。
 */
function flip(base: ReactionState, key: string): ReactionState {
	const on = base.viewer_reactions.includes(key)
	const reactions = { ...base.reactions }
	const next = (reactions[key] ?? 0) + (on ? -1 : 1)
	if (next > 0)
		reactions[key] = next
	else
		delete reactions[key]
	return {
		reactions,
		viewer_reactions: on
			? base.viewer_reactions.filter(e => e !== key)
			: [...base.viewer_reactions, key],
	}
}

/** 乐观状态先只落本地；publish 只在服务端结算后把权威值抛给宿主。 */
function commit(next: ReactionState, publish = true) {
	local.value = next
	if (publish)
		emit('update', next)
}

/** 未登录 / 会话过期：先把这一下记下来再跳，登录回来接着做完 */
function goLogin(emojiKey: string, started = sessionScope.capture()) {
	if (!sessionScope.current(started))
		return
	stashPendingReaction({
		targetType: props.targetType,
		targetId: props.targetId,
		pageKey: props.pageKey,
		emoji: emojiKey,
	})
	login(returnToNearest(root.value))
}

/**
 * 点下去那一刻就得知道登没登录 —— 等到那时再问，问出「没登录」时样式已经做上了。
 * 全站共用一发（useCommentSession 里是模块级的在途 promise），
 * 一页几十张碎语卡片也只问一次。
 */
onMounted(() => session.load())

async function toggle(emojiKey: string) {
	const started = sessionScope.capture()
	// 已经问出结果、确实没登录：直接跳。先把样式做上再跳走，看起来像点坏了
	if (ready.value && !user.value) {
		goLogin(emojiKey, started)
		return
	}

	// 收起的碎语卡片手里只有 /api/pages/counts 那份数字，没有 viewer_reactions，
	// 不知道这一下是加还是减，先斩后奏就可能把「取消」画成「添加」。
	// 但一个 reaction 都没有的页面不必问 —— 那必然是加，而这是绝大多数碎语的情形
	if (props.resolve && !props.viewerReactions && Object.keys(view.value.reactions).length) {
		await props.resolve()
		await nextTick()
		if (!sessionScope.current(started))
			return
	}

	// 样式立刻就上，请求随后再发
	const adding = !view.value.viewer_reactions.includes(emojiKey)
	commit(flip(view.value, emojiKey), false)
	picking.value = false

	pending++
	chain = chain.then(async () => {
		// PUT/DELETE 即使页面离开也要等明确结果；abort 不能证明服务端没有落库。
		const request = sessionScope.start(started, false)
		try {
			if (!sessionScope.current(request)) {
				if (props.pageKey)
					session.invalidateData(props.pageKey)
				return
			}
			const res = await api.request<ReactionState>('/api/reactions', {
				method: adding ? 'PUT' : 'DELETE',
				body: { ...body.value, emoji: emojiKey },
				signal: request.controller.signal,
			})
			// 共享缓存只接收服务端权威值，不写乐观状态；即使会话已变，这份公开计数仍有效。
			if (props.targetType === 'page' && props.pageKey)
				patchCommentReactions(props.pageKey, res.reactions)
			if (!sessionScope.current(request)) {
				if (props.pageKey)
					session.invalidateData(props.pageKey)
				return
			}
			// 只剩自己在途时才写回：这份快照里没有别的请求刚乐观加上去的那几个
			if (pending === 1)
				commit(res)
		}
		catch (err) {
			if (!sessionScope.current(request)) {
				if (props.pageKey)
					session.invalidateData(props.pageKey)
				return
			}
			// 撤回刚才那一下。按当前状态再翻一次，而不是整片盖回旧快照 ——
			// 这中间可能还点了别的 emoji，盖回去会把它们一起抹掉。
			// 失败本身不弹东西打断阅读：数字自己缩回去就是反馈
			commit(flip(view.value, emojiKey), pending === 1)
			if (CommentError.from(err).code === 'unauthorized')
				goLogin(emojiKey, started)
		}
		finally {
			sessionScope.finish(request)
			pending--
		}
	})
}

/**
 * 补发登录前的那一下。
 *
 * 三个条件齐了才动手：会话问出了结果、确实登上了、上游数据到位。
 * 少一个都可能把 reaction 发反方向，或者被随后回来的快照盖掉。
 */
watch([ready, user, () => props.settled], () => {
	if (!ready.value || !user.value || !props.settled)
		return
	const p = takePendingReaction(m => m.targetType === props.targetType && (
		props.targetType === 'comment'
			? m.targetId === props.targetId
			: m.pageKey === props.pageKey
	))
	if (p)
		toggle(p.emoji)
}, { immediate: true })
</script>

<template>
<div ref="root" class="reactions c-reactions">
	<button
		v-for="chip in chips"
		:key="chip.key"
		type="button"
		class="chip"
		:class="{ on: chip.on }"
		:aria-label="`${chip.emoji} ${chip.count}`"
		:aria-pressed="chip.on"
		@click="toggle(chip.key)"
	>
		<span class="emoji">{{ chip.emoji }}</span>
		<span class="num">{{ chip.count }}</span>
	</button>

	<!--
		评论里的 ＋ 隐身、hover 才浮现：一屏二十条，各挂一个灰按钮太吵。
		页面级那一行不同 —— 整行只有这一个控件，隐身就等于没有入口，故常显。

		排在八连之前：这样收起时的 ＋ 和展开时的 ✕ 落在同一个位置，
		那八个是从它右边展开的，来回点不会让按钮自己跑。
	-->
	<button
		type="button"
		class="chip"
		:class="{ ghost: targetType === 'comment' }"
		:aria-label="picking ? '收起反应' : '添加反应'"
		:aria-expanded="picking"
		@click="picking = !picking"
	>
		<Icon :name="picking ? 'tabler:x' : 'tabler:mood-plus'" />
	</button>

	<!-- 展开后铺满 8 种，收起时只留一个入口。--i 用来错开进出场 -->
	<TransitionGroup name="pick">
		<button
			v-for="([key, emoji], i) in tray"
			:key="key"
			type="button"
			class="chip"
			:class="{ on: mine.has(key) }"
			:style="{ '--i': i }"
			:aria-label="emoji"
			@click="toggle(key)"
		>
			<span class="emoji">{{ emoji }}</span>
		</button>
	</TransitionGroup>
</div>
</template>
