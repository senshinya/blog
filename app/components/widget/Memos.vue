<script setup lang="ts">
interface Memo {
	name: string
	content: string
	createTime: string
}

const LIMIT = 5

// server: false —— 碎语更新频繁，若在构建时取数就会一直停留在上次部署的快照
// 用 lazy 版而非顶层 await：await 会让本组件变成异步组件，要等 fetch 回来才实体化，
// 而那时侧栏的 TransitionGroup 早已挂载完毕，凭空多出的子节点会被当成「新增」白播一次进场动画
const { data: memos, status } = useLazyAsyncData('widget:memos', async () => {
	const res = await $fetch<{ memos?: Memo[] }>('https://memos.shinya.click/api/v1/memos', {
		query: { pageSize: LIMIT },
	})
	return (res.memos ?? []).map(m => ({
		id: m.name.split('/').pop() ?? m.name,
		createTime: m.createTime,
		text: toMemoPlainText(m.content),
	}))
}, { server: false, default: () => [] })

// server: false 时服务端压根不取数，status 停在 idle 而非 pending。
// 漏掉 idle 会让预渲染的 HTML 直接落到空列表分支，写上「还没有碎语」
const loading = computed(() => status.value === 'idle' || status.value === 'pending')

// 内容从「加载中」一行变成 5 条列表，高度要跳一大截。量出内容真实高度再过渡，
// 而不是猜一个 max-height —— 猜小了截断，猜大了缓动会提前跑完、动画尾巴发木。
// 服务端与首帧测量前 height 为 0，此时不落 style，保持 auto，故预渲染的 HTML 不会被压扁。
const contentEl = useTemplateRef('content')
const { height: contentHeight } = useElementSize(contentEl)
</script>

<template>
<BlogWidget card title="碎碎念">
	<template #action>
		<UtilLink to="/memos" class="more">
			全部<Icon name="tabler:chevron-right" />
		</UtilLink>
	</template>

	<div class="expander" :style="contentHeight ? { height: `${contentHeight}px` } : undefined">
		<div ref="content">
			<p v-if="loading" class="tip">
				加载中...
			</p>

			<p v-else-if="!memos.length" class="tip">
				还没有碎语
			</p>

			<ol v-else class="feed">
				<li v-for="memo in memos" :key="memo.id">
					<UtilLink :to="`/memos#${memo.id}`" class="item">
						<!-- monthDay 是定宽的，日期列才能对齐成左轨 -->
						<UtilDate class="date" :date="memo.createTime" format="monthDay" />

						<!-- 纯图碎语没有文字，给个占位免得只剩一个孤零零的日期 -->
						<p class="text">
							{{ memo.text || '[图片]' }}
						</p>
					</UtilLink>
				</li>
			</ol>
		</div>
	</div>
</BlogWidget>
</template>

<style lang="scss" scoped>
.expander {
	// 负外边距 + 等量内边距：抵消后排版宽度不变，但给下面 .item 的负外边距
	// 留出一圈不被 overflow 裁掉的余地，否则 hover 的填充块会被削掉两侧
	overflow: hidden;
	margin-inline: -0.4em;
	padding-inline: 0.4em;
	transition: height 0.3s;
}

.feed {
	display: flex;
	flex-direction: column;
	gap: 0.1em;
}

// 竖向节奏由定宽的日期左轨建立，不靠分隔线；
// 负外边距让 hover 的填充块比文字宽出一圈，读起来才像可点的靶区
.item {
	display: grid;
	grid-template-columns: auto 1fr;

	// 日期字号比正文小，行盒里的基线位置也不同，靠调 line-height 去凑永远凑不准；
	// baseline 对齐让浏览器按首行基线摆，日期才真正坐在第一行文字的那条线上
	align-items: baseline;
	gap: 0.6em;
	margin-inline: -0.4em;
	padding: 0.4em;
	border-radius: 6px;
	transition: background-color 0.2s;

	&:hover {
		background-color: var(--c-bg-2);

		> .date {
			color: var(--c-primary);
		}
	}
}

.date {
	// tabular-nums 保证 07/09 和 11/28 等宽，左轨才不会抖
	font-family: var(--font-monospace);
	font-size: 0.75em;
	font-variant-numeric: tabular-nums;
	color: var(--c-text-3);
	transition: color 0.2s;
}

.text {
	// 中英混排按字数截断很难看，交给浏览器按行截
	display: -webkit-box;
	overflow: hidden;
	-webkit-line-clamp: 2;
	line-clamp: 2;
	line-height: 1.5;
	color: var(--c-text-2);
	-webkit-box-orient: vertical;
}

.tip {
	padding: 0.5em 0;
	font-size: 0.9em;
	color: var(--c-text-3);
}

.more {
	display: flex;
	align-items: center;
	font-size: 0.85em;
	color: var(--c-text-3);

	&:hover {
		color: var(--c-primary);
	}
}
</style>
