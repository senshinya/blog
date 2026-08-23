<script setup lang="ts">
import type { ParsedMemo } from '~/utils/memo'

/**
 * 一条 memo 的正文部分：头像、时间、内容、图片、标签。
 *
 * 列表卡片和详情页渲染的是同一条内容，只有外壳（卡片描边 / 互动控件 / 评论区）不同，
 * 故正文抽在这里，两边共用。
 */
const props = defineProps<ParsedMemo & {
	/**
	 * 详情页模式：不渲染名字底下那个相对时间 —— 既然已经进来了，就不必再链回自己。
	 * 完整时刻由详情页自己摆（在反馈行的右端，见 pages/memos/[id].vue）。
	 */
	detail?: boolean
}>()

const appConfig = useAppConfig()
const openLightbox = useLightbox()
</script>

<template>
<div class="memo-body">
	<div class="memo-meta">
		<NuxtImg
			class="avatar"
			:src="appConfig.author.avatar"
			:alt="appConfig.author.name"
			width="48"
			height="48"
		/>

		<!-- 详情页只剩一行名字，align-items: center 自然就让它对齐头像正中 -->
		<div class="info">
			<div class="nick">
				<span>{{ appConfig.author.name }}</span>
				<Icon v-if="pinned" class="pinned" name="tabler:pin-filled" />
			</div>

			<!-- 时间戳即固定链接，是社交时间线的通行约定，也省得为它单开一个按钮 -->
			<UtilLink v-if="!detail" :to="`/memos/${props.id}`" class="date-link">
				<UtilDate class="date" :date="createTime" />
			</UtilLink>
		</div>
	</div>

	<!-- 正文按块渲染：独占一行的裸链接被切成 link 块换成预览卡，其余照旧走 v-html。
		切块规则见 utils/memo.ts 的 splitMemoLinks -->
	<div v-if="blocks.length" class="memo-content">
		<template v-for="block, index in blocks" :key="index">
			<!-- eslint-disable-next-line vue/no-v-html -->
			<div v-if="block.type === 'html'" class="rich-text" v-html="block.html" />
			<MemoLinkCard v-else :url="block.url" />
		</template>
	</div>

	<div v-if="images.length" class="memo-images">
		<div v-for="src in images" :key="src" class="img-item">
			<img :src loading="lazy" alt="" @click="openLightbox($event.target as HTMLImageElement)">
		</div>
	</div>

	<!-- 标签是内容的元数据，与互动控件分属两类，故不混在一行 -->
	<div v-if="tags?.length" class="memo-tags">
		<span v-for="tag in tags" :key="tag" class="tag">
			<Icon name="tabler:hash" />{{ tag }}
		</span>
	</div>
</div>
</template>

<style lang="scss" scoped>
.memo-body {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
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

// 链接态的时间戳：静止时与普通时间戳一模一样，hover 才显形，
// 免得每张卡片顶上都挂一个显眼的彩色链接
.date-link:hover > .date {
	text-decoration: underline;
	color: var(--c-primary);
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

// 填充的方角 chip = 内容标签，与互动控件那种描边的圆角 chip 刻意区分
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

.memo-content {
	overflow-wrap: break-word;
	line-height: 1.6;
	color: var(--c-text-2);

	// 以下这些是给 marked 渲染出来的正文用的，故一律收在 .rich-text 之下。
	// 摊在 .memo-content 上会连坐 MemoLinkCard —— 它的根就是个 <a>，
	// 会被 :deep(a) 染成主色、hover 时整张卡的文字都加上下划线。
	// 且父组件那条选择器还比卡片自己的样式更specific，在子组件里盖不掉
	:deep(.rich-text) {
		p {
			margin: 0.3em 0;
		}

		a {
			color: var(--c-primary);

			&:hover {
				text-decoration: underline;
			}
		}

		code {
			padding: 0.1em 0.3em;
			border-radius: 0.3em;
			background-color: var(--c-bg-2);
			font-family: var(--font-monospace);
			font-size: 0.9em;
		}

		pre {
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

		blockquote {
			margin: 0.4em 0;
			padding: 0.2em 0.6em;
			border-inline-start: 3px solid var(--c-border);
			color: var(--c-text-2);
		}

		:where(ul, ol) {
			margin: 0.3em 0;
			padding-inline-start: 1.5em;
			list-style: revert;

			> li::marker {
				color: var(--c-primary);
			}
		}
	}
}
</style>
