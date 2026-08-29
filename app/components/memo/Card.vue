<script setup lang="ts">
import type { Thread, ThreadPage } from '~/utils/comment'
import type { ParsedMemo } from '~/utils/memo'

/**
 * 列表里的一条 memo：正文（MemoBody）+ 互动控件 + 可折叠的评论区。
 *
 * 详情页（pages/memos/[id]）渲染的是同一条正文，但评论常驻、没有折叠控件。
 */
const props = defineProps<ParsedMemo & { viewerReactions?: string[] }>()

const api = useCommentApi()
const session = useCommentSession()
const { user, epoch: sessionEpoch } = session
const sessionScope = useCommentSessionScope(sessionEpoch)
const sessionKey = computed(() => `${sessionEpoch.value}:${user.value?.id ?? 'anonymous'}`)
const cardEl = useTemplateRef('card')

/**
 * page key 与详情页、与 /api/pages/counts 用的是同一个值，
 * 所以卡片上的数字、详情页的线程、站长面板里的条目指的都是同一页。
 */
const pageKey = computed(() => `/memos/${props.id}`)

// giscus 时代一条 memo 一个请求，还得靠 useElementVisibility 卡着视口省额度；
// 现在 /api/pages/counts 是批量的，同一帧登记的 key 合并成一发，不必再等滚动
const count = useCommentCounts(pageKey)

/**
 * 首次落库时写进 pages 表的标题。碎语没有标题，用正文首句 ——
 * 站长面板和通知邮件里要靠它认出是哪一条。
 * 服务端只在建页时取一次，之后不再改，故卡片和详情页都得带上，谁先写谁算数。
 */
const summary = computed(() => props.blocks
	.map(b => b.type === 'html' ? b.html.replace(/<[^>]+>/g, ' ') : b.url)
	.join(' ')
	.replace(/\s+/g, ' ')
	.trim()
	.slice(0, 60))

const expanded = ref(false)

/**
 * 线程里的页面态，由 CommentSection 展开取数后抛回来。
 * 有了它，页脚那排 chip 才知道「你点没点过」，才能就地点。
 */
const page = ref<ThreadPage | null>(null)

/**
 * 批量私人投影还没返回时，卡片手里只有 /api/pages/counts 的数字。
 * 真要动手之前先问一次权威状态 —— 否则「取消」会被做成「添加」。
 *
 * 只在第一次点 chip 时打这一发，且只打一次：一屏二十张卡片，谁也不该为了
 * 那排还没人碰的表情各要一次会话态。limit=1 是因为这里只要 page，不要评论。
 */
let resolving: Promise<void> | undefined

/**
 * 手上最新的 reaction 状态。
 *
 * 不直接往 page 上写：这一条可能还没落库（服务端回 page: null），
 * 那时根本没有对象可写，点完的 reaction 就没处存 —— 表现为鼠标一移开页脚又缩回去，
 * 非得刷新一次才常驻。
 */
const reacted = ref<{ reactions: Record<string, number>, viewer_reactions: string[] }>()

function onPage(p: ThreadPage | null) {
	page.value = p
	// 线程带回来的是权威的，本地那份让位
	reacted.value = undefined
	// 展开时线程已经把权威状态带回来了，那一发就不必再打
	resolving ??= Promise.resolve()
}

function resolvePage() {
	if (resolving)
		return resolving
	const request = sessionScope.start()
	resolving = api.request<Thread>('/api/pages/thread', {
		query: { key: pageKey.value, limit: 1 },
		signal: request.controller.signal,
	})
		.then((t) => {
			if (sessionScope.current(request))
				page.value = t.page
		})
		.catch(() => {
			if (sessionScope.current(request))
				resolving = undefined
		})
		.finally(() => sessionScope.finish(request))
	return resolving
}

watch(sessionEpoch, () => {
	page.value = null
	reacted.value = undefined
	resolving = undefined
}, { flush: 'sync' })

// 三处来源，越新越优先：刚点的 > 线程带回的 > 列表批量拿到的私人投影
const reactions = computed(() => reacted.value?.reactions ?? page.value?.reactions ?? count.value.reactions)
const viewerReactions = computed(() => reacted.value?.viewer_reactions ?? page.value?.viewer_reactions ?? props.viewerReactions)

/**
 * 零互动的碎语不留页脚的高度。这类占了列表的绝大多数，留一条空条等于每张卡片
 * 底下白挂一截；鼠标移上来才长出来。
 *
 * 触屏没有 hover，那种设备上只能常驻，否则这些条目等于没有入口
 * （同 .ghost 在 @media (hover: none) 下的处理）。
 */
const hasFoot = computed(() => expanded.value
	|| count.value.comments > 0
	|| Object.keys(reactions.value).length > 0)

const hovered = useElementHover(cardEl)
// 查 (hover: none) 而不是 (hover: hover)：媒体查询在服务端一律为 false，
// 后者会让预渲染的 HTML 里所有页脚都是展开的，水合后再齐刷刷收回去闪一下
const noHover = useMediaQuery('(hover: none)')
const showFoot = computed(() => hasFoot.value || hovered.value || noHover.value)

/**
 * 高度过渡。卡片会在三个时刻变高矮：计数到位后页脚浮现、展开/收起评论、
 * 线程取数落定。量出内容真实高度再过渡，而不是猜一个 max-height ——
 * 猜小了截断，猜大了缓动会提前跑完、动画尾巴发木。（同 widget/Memos.vue 的做法。）
 *
 * 测量出来之前不落 style，保持 auto：ResizeObserver 的回调挂在渲染流水线上，
 * 后台标签页里根本不跑。写死 height: 0 会让页脚在那种标签页里彻底消失，
 * 而 auto 只是少一次进场动画。
 */
const tailEl = useTemplateRef('tail')
// offsetHeight 是 border-box，把 .tail-in 自己的 padding-top 一起算进去。
// 那段间距不能靠 .memo 的 gap —— gap 在容器高度归零时仍然占位
const tailHeight = ref(0)

function measureTail() {
	tailHeight.value = tailEl.value?.offsetHeight ?? 0
}

// 内容自己长高：线程取数落定、图片到位、字体换上
useResizeObserver(tailEl, measureTail)

/**
 * 展开/收起是我们主动触发的，必须当场量，不能等 ResizeObserver 的回调 ——
 * Vue 挂载评论区是同步的，而 RO 要等到这一帧渲染结束才回调。中间那一拍里
 * .tail 还钉在「只有页脚」的旧高度上，overflow: hidden 会把新挂上的东西整个裁掉。
 */
watch([expanded, showFoot], () => nextTick(measureTail))

const tailStyle = computed(() => {
	if (!showFoot.value)
		return { height: '0px' }
	return tailHeight.value ? { height: `${tailHeight.value}px` } : undefined
})

// 不滚动：评论区就长在刚按下的那个按钮正下方，滚一下反而会把页脚推出视口。
// （giscus 时代要滚，是因为反应栏藏在 iframe 里、离得远。）
function open() {
	expanded.value = true
}

function onReaction(payload: { reactions: Record<string, number>, viewer_reactions: string[] }) {
	reacted.value = payload
	if (page.value) {
		page.value.reactions = payload.reactions
		page.value.viewer_reactions = payload.viewer_reactions
	}
}
</script>

<template>
<!-- id 供侧栏 widget 的 /memos#<id> 深链跳转 -->
<li :id ref="card" class="memo">
	<MemoBody
		:id="props.id"
		:blocks="props.blocks"
		:images="props.images"
		:create-time="props.createTime"
		:pinned="props.pinned"
		:tags="props.tags"
	/>

	<!-- 页脚和评论区一起装在这个高度可变的容器里，任何一处变化都走同一条过渡。
		始终渲染而不是 v-if：要能量到高度，才有得从 0 过渡过去 -->
	<div class="tail" :style="tailStyle">
		<div ref="tail" class="tail-in">
			<footer class="memo-foot">
				<!-- 收起也能点：表情是轻量互动，不该逼人先把整个评论区拉开 -->
				<CommentReactions
					:key="sessionKey"
					target-type="page"
					:page-key
					:title="summary"
					:reactions
					:viewer-reactions="viewerReactions"
					:resolve="resolvePage"
					@update="onReaction"
				/>

				<!-- 评论数是只读数据，用图标+数字，刻意不做成 chip，以免和上面的控件混淆 -->
				<button
					class="comments"
					:aria-label="expanded ? '收起评论' : '展开评论'"
					@click="expanded ? expanded = false : open()"
				>
					<Icon :name="expanded ? 'tabler:chevron-up' : 'tabler:message-circle'" />
					<span>{{ expanded ? '收起' : (count.comments || '评论') }}</span>
				</button>
			</footer>

			<!-- 展开才挂载：一页 20 条碎语，全量拉线程没必要 -->
			<CommentSection
				v-if="expanded"
				class="memo-thread"
				:page-key
				:title="summary"
				@page="onPage"
			/>
		</div>
	</div>
</li>
</template>

<style lang="scss" scoped>
.memo {
	display: flex;
	flex-direction: column;

	// 不用 gap：.tail 高度归零时 gap 仍然占位，零互动的卡片底下就还留着一条缝。
	// 那 0.5rem 挪进 .tail-in 的 padding，跟着一起被裁掉
	gap: 0;
	margin-bottom: 1rem;
	padding: 1rem;

	// 1px 描边环，比实心卡片轻，条目多时不至于糊成一片
	border-radius: 8px;
	box-shadow: 0 0 0 1px var(--c-bg-soft);
	animation: float-in 0.3s backwards;
	animation-delay: var(--delay);
}

.tail {
	overflow: hidden;
	transition: height 0.3s;

	@media (prefers-reduced-motion: reduce) {
		transition: none;
	}
}

.tail-in {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	padding-top: 0.5rem;
}

.memo-foot {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.5em;
	font-size: 0.75rem;
}

// 只读数据：图标 + 数字，无边框无底色，与上面的控件在材质上分开
.comments {
	display: flex;
	align-items: center;
	gap: 3px;
	margin-inline-start: auto;
	padding: 2px;
	background: none;
	color: var(--c-text-3);
	transition: color 0.2s;
	cursor: pointer;

	&:hover, &:focus-visible {
		color: var(--c-primary);
	}

	> span {
		font-variant-numeric: tabular-nums;
	}
}

// 卡片有自己的描边环，评论区落在卡片底色上而不是页面底色上 ——
// 导线、折叠钮、长正文渐隐都要用它，故在这里重新声明一次
.memo-thread {
	--surface: var(--ld-bg-card);

	padding-top: 1rem;
	border-top: 1px solid var(--c-border);
}
</style>
