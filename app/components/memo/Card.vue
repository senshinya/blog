<script setup lang="ts">
import type { ParsedMemo } from '~/utils/memo'

/**
 * 列表里的一条 memo：正文（MemoBody）+ 互动控件 + 可折叠的评论区。
 *
 * 详情页（pages/memos/[id]）渲染的是同一条正文，但评论常驻、没有折叠控件。
 */
const props = defineProps<ParsedMemo>()

const appConfig = useAppConfig()
const cardEl = useTemplateRef('card')
const giscusEl = useTemplateRef('giscus')

// 每条 memo 对应一个 Discussion，用 memo 的稳定 ID 做标题。
// 详情页用的是同一个 term，故两处进的是同一条讨论线程
const term = computed(() => `memo/${props.id}`)

// 视口内才去查计数：giscus 无批量接口，一条一个请求，额度有限
const visible = useElementVisibility(cardEl)
const count = useGiscusCount(term, visible)

const expanded = ref(false)

/**
 * reaction 的写入在 giscus 手里（鉴权 + GitHub API 都是它的），
 * 前端拿到的只是读数。所以 chip 的点击不能"就地点赞"，只能把 giscus 拉出来 ——
 * 反应栏就在 giscus 挂载后的顶部，滚过去即可。
 */
async function open() {
	expanded.value = true
	await nextTick()
	unrefElement(giscusEl)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}
</script>

<template>
<!-- id 供侧栏 widget 的 /memos#<id> 深链跳转 -->
<li :id ref="card" class="memo">
	<MemoBody v-bind="props" />

	<footer class="memo-foot">
		<div class="reactions">
			<!-- 描边 = 可点但未激活；点击拉出 giscus 的反应栏 -->
			<button
				v-for="r in count.reactions"
				:key="r.emoji"
				class="chip"
				:aria-label="`${r.emoji} ${r.count}，点击查看`"
				@click="open"
			>
				<span class="emoji">{{ r.emoji }}</span>
				<span class="num">{{ r.count }}</span>
			</button>

			<!-- 零互动是碎语的常态，故这个入口默认隐身，hover / 聚焦才浮现 -->
			<button
				class="chip ghost"
				aria-label="添加反应"
				@click="open"
			>
				<Icon name="tabler:mood-plus" />
			</button>
		</div>

		<!-- 评论数是只读数据，用图标+数字，刻意不做成 chip，以免和上面的控件混淆 -->
		<button
			class="comments"
			:class="{ ghost: !expanded && !count.comments }"
			:aria-label="expanded ? '收起评论' : '展开评论'"
			@click="expanded ? expanded = false : open()"
		>
			<Icon :name="expanded ? 'tabler:chevron-up' : 'tabler:message-circle'" />
			<span>{{ expanded ? '收起' : (count.comments || '评论') }}</span>
		</button>
	</footer>

	<!-- 展开才挂载：一条 memo 一个 giscus iframe，全量内嵌会把页面拖垮 -->
	<UtilGiscus
		v-if="expanded"
		ref="giscus"
		mapping="specific"
		:term="term"
		:category="appConfig.giscus.memoCategory"
		:category-id="appConfig.giscus.memoCategoryId"
	/>
</li>
</template>

<style lang="scss" scoped>
.memo {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	margin-bottom: 1rem;
	padding: 1rem;

	// 1px 描边环，比实心卡片轻，条目多时不至于糊成一片
	border-radius: 8px;
	box-shadow: 0 0 0 1px var(--c-bg-soft);
	animation: float-in 0.3s backwards;
	animation-delay: var(--delay);
}

.memo-foot {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.5em;
	font-size: 0.75rem;
}

.reactions {
	display: flex;
	align-items: center;
	gap: 5px;
}

.chip {
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 2px 8px;

	// 描边而非填充：表达「可交互，但你还没参与」
	border: 1px solid var(--c-border);
	border-radius: 2em;
	background: none;
	color: var(--c-text-3);
	transition: all 0.2s;
	cursor: pointer;

	&:hover, &:focus-visible {
		border-color: var(--c-primary);
		background-color: var(--c-primary-soft);
		color: var(--c-primary);
	}

	&:active {
		transform: scale(0.94);
	}

	> .num {
		font-family: var(--font-monospace);
		font-variant-numeric: tabular-nums;
	}
}

// 零互动是常态，入口平时隐身，避免 20 张卡片各挂一个灰按钮
.ghost {
	opacity: 0;
	transition: opacity 0.2s, transform 0.2s, border-color 0.2s, color 0.2s;
	translate: 0 2px;

	.memo:hover &,
	&:focus-visible {
		opacity: 1;
		translate: 0;
	}
}

// 触屏无 hover，入口再淡也得常驻，否则等于不存在
@media (hover: none) {
	.ghost {
		opacity: 0.45;
		translate: 0;
	}
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
</style>
