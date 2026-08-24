<script setup lang="ts">
import type { Comment, CommentTree } from '~/utils/comment'
import { CommentError } from '~/composables/useCommentApi'

/**
 * 一条评论及其整棵子树（递归组件）。
 *
 * 导轨的几何、折叠钮、弯头都在 assets/css/comment.scss 里；
 * 这里只管状态：收起、超长正文折叠、客户端收纳回复、回复/编辑/删除。
 */
const props = defineProps<{
	node: CommentTree
	pageKey: string
	title?: string
	pageSubscribed?: boolean
	/** 邮件深链要高亮的那条 */
	focusId?: number
	index?: number
}>()

const emit = defineEmits<{
	/** 有增删改，让 Section 决定是重取还是就地打补丁 */
	changed: []
	inserted: [comment: Comment]
	patched: [comment: Comment]
	removed: [id: number]
	/** 删除没成，把原样那条放回去 */
	restored: [comment: Comment]
}>()

const api = useCommentApi()
const session = useCommentSession()
const { user, login, epoch: sessionEpoch } = session
const sessionScope = useCommentSessionScope(sessionEpoch)

const collapsed = ref(false)
const replying = ref(false)
const editing = ref(false)
const confirmingDelete = ref(false)
/** 客户端收纳：直接回复超过 5 条时先铺 3 条 */
const expandedReplies = ref(false)
const clipped = ref(false)
const unclipped = ref(false)

const proseEl = useTemplateRef('prose')

const node = computed(() => props.node)
const owner = computed(() => node.value.user?.is_owner)
const isFocused = computed(() => props.focusId === node.value.id)
let confirmationTimer: ReturnType<typeof setTimeout> | undefined
onScopeDispose(() => clearTimeout(confirmationTimer))

/** 收起时那行「已收起 N 条」数的是整棵子树 */
function countDescendants(n: CommentTree): number {
	return n.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0)
}
const descendants = computed(() => countDescendants(node.value))

const folded = computed(() =>
	!expandedReplies.value && node.value.children.length > FOLD_OVER
		? node.value.children.length - FOLD_KEEP
		: 0)

const visibleChildren = computed(() =>
	folded.value ? node.value.children.slice(0, FOLD_KEEP) : node.value.children)

/**
 * 超长正文折叠。真实评论里大量读者直接粘贴代码却不加围栏，
 * 渲染出来是 <br> 堆叠的正文，一条能占两屏半。
 * 阈值取 22em，和 CSS 里的 max-height 一致。
 */
function measure() {
	const el = proseEl.value
	if (!el)
		return
	const max = Number.parseFloat(getComputedStyle(el).fontSize) * 22
	// 已经展开过就不再收回去，否则读者一滚动就被折叠打断
	clipped.value = !unclipped.value && el.scrollHeight > max + 8
}
onMounted(() => nextTick(measure))
watch(() => node.value.body_html, () => nextTick(measure))

async function remove() {
	if (!confirmingDelete.value) {
		confirmingDelete.value = true
		clearTimeout(confirmationTimer)
		confirmationTimer = setTimeout(() => (confirmingDelete.value = false), 4000)
		return
	}
	confirmingDelete.value = false
	// DELETE 必须等明确结果；abort 响应无法证明服务端没有完成软删除。
	const request = sessionScope.start(sessionScope.capture(), false)

	// 先按删掉渲染：服务端是软删除，这里留的墓碑和它一致。
	// 锚点要在 emit 之前取 —— 那之后这条就只剩一行「已删除」，prose 连同 id 都没了
	const snapshot: Comment = { ...node.value }
	const back = returnToNearest(proseEl.value)
	emit('removed', snapshot.id)
	bumpCommentCount(props.pageKey, -1)

	try {
		await api.request(`/api/comments/${snapshot.id}`, {
			method: 'DELETE',
			signal: request.controller.signal,
		})
		if (!sessionScope.current(request))
			session.invalidateData()
	}
	catch (err) {
		// 公开计数不带会话，失败时始终要收回乐观更新。
		bumpCommentCount(props.pageKey, 1)
		if (!sessionScope.current(request)) {
			session.invalidateData()
			return
		}
		// 原样放回去。那条重新出现本身就是「没删掉」的反馈
		emit('restored', snapshot)
		if (CommentError.from(err).code === 'unauthorized')
			login(back)
	}
	finally {
		sessionScope.finish(request)
	}
}

function onReplied(comment: Comment) {
	if (!sessionScope.current(sessionScope.capture()))
		return
	replying.value = false
	emit('inserted', comment)
}

function onEdited(comment: Comment) {
	if (!sessionScope.current(sessionScope.capture()))
		return
	editing.value = false
	emit('patched', comment)
}

function onReaction(payload: { reactions: Record<string, number>, viewer_reactions: string[] }) {
	if (!sessionScope.current(sessionScope.capture()))
		return
	// 就地改，不为一次表态重取整条线程
	node.value.reactions = payload.reactions
	node.value.viewer_reactions = payload.viewer_reactions
}
</script>

<template>
<li
	:id="`comment-${node.id}`"
	class="comment"
	:class="{
		'has-replies': node.children.length > 0 && !collapsed,
		'collapsed': collapsed,
		'deleted': node.deleted,
		'focused': isFocused,
		'replying': replying,
	}"
	:style="{ '--delay': `${Math.min(index ?? 0, 8) * 0.04}s` }"
>
	<!--
		导线收口。父导线是一路画到底的，靠最后一条回复拿一块底色把压在自己身上的
		那段擦掉，线就断在弯头起点上。只有 :last-child 会显示（见 comment.scss），
		所以这里无条件挂着，不必让子组件知道自己排第几。
	-->
	<span class="branchline" aria-hidden="true" />

	<!-- 已删除只剩一行占位：线程的形状要留着，否则下面的回复会变成孤儿 -->
	<template v-if="node.deleted">
		<div class="comment-body">
			这条评论已删除
		</div>
	</template>

	<template v-else>
		<div class="avatar">
			<img
				:src="node.user?.avatar_url"
				:alt="`${node.user?.name || node.user?.login} 的头像`"
				width="32"
				height="32"
				loading="lazy"
			>
		</div>

		<button
			v-if="node.children.length"
			type="button"
			class="collapse"
			:aria-label="collapsed ? '展开这条讨论' : '收起这条讨论'"
			:aria-expanded="!collapsed"
			@click="collapsed = !collapsed"
		/>

		<div class="comment-body">
			<div class="byline" :data-n="descendants">
				<UtilLink :to="`https://github.com/${node.user?.login}`" class="name">
					{{ node.user?.name || node.user?.login }}
				</UtilLink>
				<span v-if="owner" class="tag-owner">站长</span>
				<UtilDate v-if="node.created_at" class="date" :date="node.created_at" />
				<span v-if="node.edited_at" class="edited">已编辑</span>
			</div>

			<template v-if="editing">
				<CommentComposer
					:page-key="pageKey"
					:edit-id="node.id"
					:initial="node.body_md"
					autofocus
					@submitted="onEdited"
					@cancel="editing = false"
				/>
			</template>

			<template v-else>
				<div class="clip" :class="{ on: clipped }">
					<!-- eslint-disable-next-line vue/no-v-html -- 服务端渲染并消毒过的 HTML -->
					<div ref="prose" class="prose" v-html="node.body_html" />
				</div>
				<button
					v-if="clipped"
					type="button"
					class="more"
					@click="clipped = false; unclipped = true"
				>
					展开全文
				</button>

				<div class="comment-foot">
					<CommentReactions
						target-type="comment"
						:target-id="node.id"
						:page-key
						:reactions="node.reactions"
						:viewer-reactions="node.viewer_reactions"
						@update="onReaction"
					/>
					<button type="button" class="act ghost" @click="user ? (replying = !replying) : login(returnToNearest(proseEl))">
						回复
					</button>
					<button v-if="node.can_edit" type="button" class="act ghost" @click="editing = true">
						编辑
					</button>
					<button v-if="node.can_delete" type="button" class="act danger ghost" @click="remove">
						{{ confirmingDelete ? '确认删除' : '删除' }}
					</button>
				</div>

				<!-- 外层跑 0fr → 1fr 的高度，内层负责裁切与位移，和工具条长出来那一下同一套 -->
				<Transition name="composer">
					<div v-if="replying" class="composer-slot">
						<div class="composer-slot-in">
							<CommentComposer
								:page-key="pageKey"
								:title
								:parent-id="node.id"
								:subscribed="pageSubscribed"
								:placeholder="`回复 ${node.user?.name || node.user?.login}`"
								autofocus
								@submitted="onReplied"
								@cancel="replying = false"
							/>
						</div>
					</div>
				</Transition>
			</template>
		</div>
	</template>

	<ol v-if="node.children.length && !collapsed" class="replies">
		<CommentItem
			v-for="(child, i) in visibleChildren"
			:key="child.id"
			:node="child"
			:page-key
			:title
			:page-subscribed
			:focus-id="focusId"
			:index="i"
			@inserted="emit('inserted', $event)"
			@patched="emit('patched', $event)"
			@removed="emit('removed', $event)"
			@restored="emit('restored', $event)"
			@changed="emit('changed')"
		/>

		<!--
			「另外 N 条回复」纯粹是渲染侧的决定：/api/pages/thread 会把每个顶层评论的
			完整回复子树一次性返回，数据本来就在手里，展开不发请求。
			（Reddit 那个同名控件语义不同 —— 它是「服务端还没给」。）
		-->
		<li v-if="folded" class="comment more-item">
			<span class="branchline" aria-hidden="true" />
			<span class="plus" aria-hidden="true" />
			<button type="button" class="more-replies" @click="expandedReplies = true">
				另外 {{ folded }} 条回复
			</button>
		</li>
	</ol>
</li>
</template>
