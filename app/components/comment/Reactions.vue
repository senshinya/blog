<script setup lang="ts">
import { CommentError } from '~/composables/useCommentApi'

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
	update: [payload: { reactions: Record<string, number>, viewer_reactions: string[] }]
}>()

const api = useCommentApi()
const session = useCommentSession()
const { user, ready, login } = session

const root = useTemplateRef('root')
const picking = ref(false)
const busy = ref(false)

/**
 * 展开的那一排。收起时给空数组，而不是 v-if 掉整组 —— TransitionGroup 得一直挂着，
 * 才轮得到它给每个 chip 跑进出场。
 */
const tray = computed(() => picking.value ? REACTIONS : [])

const chips = computed(() => toReactionChips(props.reactions, props.viewerReactions))
const mine = computed(() => new Set(props.viewerReactions ?? []))

const body = computed(() => props.targetType === 'comment'
	? { target_type: 'comment', target_id: props.targetId }
	: { target_type: 'page', key: props.pageKey, title: props.title })

/** 未登录 / 会话过期：先把这一下记下来再跳，登录回来接着做完 */
function goLogin(emojiKey: string) {
	stashPendingReaction({
		targetType: props.targetType,
		targetId: props.targetId,
		pageKey: props.pageKey,
		emoji: emojiKey,
	})
	login(returnToNearest(root.value))
}

async function toggle(emojiKey: string) {
	if (busy.value)
		return
	busy.value = true
	try {
		// /api/me 可能还在路上：那一刻 user 是 null，但这不等于「没登录」。
		// load() 会把在途的那一发 await 出来，问出结果之后再判空
		await session.load()
		if (!user.value) {
			goLogin(emojiKey)
			return
		}
		// 先问清楚这一下是加还是减；nextTick 是等 props 把新状态刷进 mine
		if (props.resolve && !props.viewerReactions) {
			await props.resolve()
			await nextTick()
		}
		const res = await api.request<{ reactions: Record<string, number>, viewer_reactions: string[] }>(
			'/api/reactions',
			{ method: mine.value.has(emojiKey) ? 'DELETE' : 'PUT', body: { ...body.value, emoji: emojiKey } },
		)
		emit('update', res)
		if (props.targetType === 'page' && props.pageKey)
			invalidateCommentCount(props.pageKey)
	}
	catch (err) {
		// reaction 失败无需打断阅读，静默即可 —— 数字没变本身就是反馈
		if (CommentError.from(err).code === 'unauthorized')
			goLogin(emojiKey)
	}
	finally {
		busy.value = false
		picking.value = false
	}
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
