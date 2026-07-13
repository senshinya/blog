<script setup lang="ts">
export interface ParsedMemo {
	id: string
	html: string
	images: string[]
	createTime: string
	pinned: boolean
	tags?: string[]
}

const props = defineProps<ParsedMemo>()

const appConfig = useAppConfig()
const cardEl = useTemplateRef('card')
const giscusEl = useTemplateRef('giscus')

// 每条 memo 对应一个 Discussion，用 memo 的稳定 ID 做标题
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

const openLightbox = useLightbox()
</script>

<template>
<!-- id 供侧栏 widget 的 /memos#<id> 深链跳转 -->
<li :id ref="card" class="memo">
	<div class="memo-meta">
		<NuxtImg
			class="avatar"
			:src="appConfig.author.avatar"
			:alt="appConfig.author.name"
			width="48"
			height="48"
		/>

		<div class="info">
			<div class="nick">
				<span>{{ appConfig.author.name }}</span>
				<Icon v-if="pinned" class="pinned" name="tabler:pin-filled" />
			</div>
			<UtilDate class="date" :date="createTime" />
		</div>
	</div>

	<!-- eslint-disable-next-line vue/no-v-html -->
	<div v-if="html" class="memo-content" v-html="html" />

	<div v-if="images.length" class="memo-images">
		<div v-for="src in images" :key="src" class="img-item">
			<img :src loading="lazy" alt="" @click="openLightbox($event.target as HTMLImageElement)">
		</div>
	</div>

	<!-- 标签是内容的元数据，与下方的互动控件分属两类，故不混在一行 -->
	<div v-if="tags?.length" class="memo-tags">
		<span v-for="tag in tags" :key="tag" class="tag">
			<Icon name="tabler:hash" />{{ tag }}
		</span>
	</div>

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

.memo-meta {
	display: flex;
	align-items: center;
	gap: 10px;

	> .avatar {
		width: 3em;
		height: 3em;
		border-radius: 2em;
		box-shadow: 2px 4px 1rem var(--ld-shadow);
	}

	.nick {
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.pinned {
		color: #F76;
		transform: rotate(45deg);
	}

	.date {
		font-family: var(--font-monospace);
		font-size: 0.8rem;
		color: var(--c-text-3);
	}
}

.memo-images {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 8px;

	> .img-item {
		// padding-bottom 撑出正方形，图片绝对定位填满并裁切，
		// 这样任意比例的截图都不会把某一行拉高
		position: relative;
		overflow: hidden;
		padding-bottom: 100%;
		border-radius: 8px;

		> img {
			position: absolute;
			inset: 0;
			width: 100%;
			height: 100%;
			transition: transform 0.3s;
			cursor: zoom-in;
			object-fit: cover;
		}

		&:hover > img {
			transform: scale(1.05);
		}
	}
}

// 填充的方角 chip = 内容标签，与下方描边的圆角 chip（控件）刻意区分
.memo-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
	font-size: 0.7rem;

	> .tag {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 2px 4px;
		border-radius: 4px;
		background-color: var(--c-bg-2);
		color: var(--c-text-3);
	}
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

.memo-content {
	overflow-wrap: break-word;
	line-height: 1.6;
	color: var(--c-text-2);

	:deep(p) {
		margin: 0.3em 0;
	}

	:deep(a) {
		color: var(--c-primary);

		&:hover {
			text-decoration: underline;
		}
	}

	:deep(code) {
		padding: 0.1em 0.3em;
		border-radius: 0.3em;
		background-color: var(--c-bg-2);
		font-family: var(--font-monospace);
		font-size: 0.9em;
	}

	:deep(pre) {
		overflow: auto;
		padding: 0.6em 0.8em;
		border-radius: 0.5em;
		background-color: var(--c-bg-2);
		font-size: 0.85em;

		> code {
			padding: 0;
			background: none;
		}
	}

	:deep(blockquote) {
		margin: 0.4em 0;
		padding: 0.2em 0.6em;
		border-inline-start: 3px solid var(--c-border);
		color: var(--c-text-2);
	}

	:deep(:where(ul, ol)) {
		margin: 0.3em 0;
		padding-inline-start: 1.5em;
		list-style: revert;

		> li::marker {
			color: var(--c-primary);
		}
	}
}
</style>
