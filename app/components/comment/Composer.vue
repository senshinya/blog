<script setup lang="ts">
import type { Comment } from '~/utils/comment'
import { CommentError } from '~/composables/useCommentApi'

/**
 * 编辑框。几何照着 Reddit 的 composer 量的：圆角等于半高，闲置无底色，
 * 工具条聚焦（或已有草稿）才从 0 高度长出来。样式在 assets/css/comment.scss。
 *
 * 顶层发表、回复、编辑三种用法共用这一个组件，差别只在 parentId / editId。
 */
const props = withDefaults(defineProps<{
	pageKey: string
	/** 首次落库时写入的页面标题，之后服务端不再改 */
	title?: string
	/** 回复谁；顶层发表传 null */
	parentId?: number | null
	/** 编辑模式：传目标评论 id 与原文 */
	editId?: number
	initial?: string
	/** 本页是否已订阅，用来播种「回复时邮件通知我」 */
	subscribed?: boolean
	placeholder?: string
	autofocus?: boolean
}>(), {
	parentId: null,
	placeholder: '说点什么',
})

const emit = defineEmits<{
	submitted: [comment: Comment]
	cancel: []
}>()

const api = useCommentApi()

const box = useTemplateRef('box')
const input = useTemplateRef('input')

const text = ref(props.initial ?? '')
const preview = ref('')
const previewing = ref(false)
const subscribe = ref(props.subscribed ?? true)
const sending = ref(false)
const error = ref<CommentError>()
/** 服务端限速是 1 条 / 15 秒，本地跑一个倒数，免得用户对着一个死掉的按钮点 */
const cooldown = ref(0)

const isEdit = computed(() => props.editId != null)
const length = computed(() => text.value.trim().length)
const canSend = computed(() => length.value > 0 && length.value <= BODY_MAX && !sending.value && !cooldown.value)

/**
 * 自增高。textarea 是 overflow:hidden 的，高度全靠这里写死 ——
 * 保留原生滚动条和右下角那个 resize 手柄会是整页唯一的浏览器原生控件。
 */
function grow() {
	const el = input.value
	if (!el)
		return
	el.style.height = 'auto'
	const max = Number.parseFloat(getComputedStyle(el).maxHeight)
	// 顶到上限之后才交还滚动条，否则长评论就写不动了
	el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden'
	el.style.height = `${Math.min(el.scrollHeight, max)}px`
}

watch(text, () => nextTick(grow))
onMounted(() => {
	grow()
	if (props.autofocus)
		input.value?.focus()
})

let ticking: ReturnType<typeof setInterval> | undefined
function startCooldown(seconds: number) {
	cooldown.value = Math.ceil(seconds)
	clearInterval(ticking)
	ticking = setInterval(() => {
		if (--cooldown.value <= 0)
			clearInterval(ticking)
	}, 1000)
}
onScopeDispose(() => clearInterval(ticking))

/**
 * 预览走服务端。前端自己实现一套 Markdown 渲染等于把 XSS 面扩大一倍，
 * 而且预览和发布必然对不齐 —— /api/comments/preview 用的就是发布那一套渲染器和消毒规则。
 */
async function togglePreview() {
	if (previewing.value) {
		previewing.value = false
		nextTick(() => {
			input.value?.focus()
			grow()
		})
		return
	}
	if (!length.value)
		return
	try {
		const res = await api.request<{ body_html: string }>('/api/comments/preview', {
			method: 'POST',
			body: { body_md: text.value },
		})
		preview.value = res.body_html
		previewing.value = true
	}
	catch (err) {
		error.value = CommentError.from(err)
	}
}

async function submit() {
	if (!canSend.value)
		return
	sending.value = true
	error.value = undefined
	try {
		const comment = isEdit.value
			? await api.request<Comment>(`/api/comments/${props.editId}`, {
					method: 'PATCH',
					body: { body_md: text.value },
				})
			: await api.request<Comment>('/api/comments', {
					method: 'POST',
					body: {
						key: props.pageKey,
						title: props.title ?? '',
						parent_id: props.parentId,
						body_md: text.value,
						subscribe_page: subscribe.value,
					},
				})

		if (!isEdit.value) {
			text.value = ''
			previewing.value = false
			startCooldown(POST_COOLDOWN)
			// 列表页那些卡片上的数字得跟着变
			invalidateCommentCount(props.pageKey)
		}
		emit('submitted', comment)
	}
	catch (err) {
		const e = CommentError.from(err)
		error.value = e
		if (e.code === 'rate_limited')
			startCooldown(e.retryAfter ?? POST_COOLDOWN)
	}
	finally {
		sending.value = false
	}
}

function onKeydown(e: KeyboardEvent) {
	if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
		e.preventDefault()
		submit()
	}
	// 空输入时 Esc 退出回复框
	if (e.key === 'Escape' && !text.value)
		emit('cancel')
}

/** 点框内空白也能聚焦：收起态整条 pill 都该是可点区域 */
function onMousedown(e: MouseEvent) {
	if (e.target === box.value) {
		e.preventDefault()
		input.value?.focus()
	}
}

const shortcut = computed(() => import.meta.client && /mac/i.test(navigator.platform) ? '⌘↵' : 'Ctrl↵')
</script>

<template>
<div ref="box" class="composer" :class="{ 'has-text': text.length }" @mousedown="onMousedown">
	<textarea
		ref="input"
		v-model="text"
		:hidden="previewing"
		:maxlength="BODY_MAX"
		:placeholder
		rows="1"
		@keydown="onKeydown"
	/>
	<!-- eslint-disable-next-line vue/no-v-html -- 服务端渲染并消毒过的 HTML，与发布走同一条路径 -->
	<div v-if="previewing" class="composer-preview prose" v-html="preview" />

	<div v-if="error" class="field-error">
		{{ error.message }}
	</div>

	<div class="composer-foot-wrap">
		<div class="composer-foot">
			<div class="composer-foot-in">
				<button type="button" class="cbtn cbtn-plain" @click="togglePreview">
					{{ previewing ? '继续写' : '预览' }}
				</button>

				<button
					v-if="!isEdit"
					type="button"
					class="cbtn cbtn-plain subscribe"
					:aria-pressed="subscribe"
					@click="subscribe = !subscribe"
				>
					<span class="tick" />
					回复时邮件通知我
				</button>

				<span class="spacer" />

				<span v-if="cooldown" class="ratelimit">
					再等 <span class="sec">{{ cooldown }}</span> 秒
				</span>

				<span v-if="length >= BODY_WARN" class="counter" :class="{ warn: length > BODY_MAX }">
					{{ length }} / {{ BODY_MAX }}
				</span>

				<button
					v-if="parentId != null || isEdit"
					type="button"
					class="cbtn cbtn-secondary"
					@click="emit('cancel')"
				>
					取消
				</button>

				<button
					type="button"
					class="cbtn cbtn-primary"
					:disabled="!canSend"
					:title="`${shortcut} 发送`"
					@click="submit"
				>
					{{ isEdit ? '保存' : '发表' }}
				</button>
			</div>
		</div>
	</div>
</div>
</template>
