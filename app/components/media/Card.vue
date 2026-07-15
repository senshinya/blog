<script setup lang="ts">
import type { BgmCollection } from '~/utils/bangumi'
import { withBgmProxy } from '~/utils/bangumi'

/**
 * 一条 Bangumi 收藏卡片：左海报(120×180) + 右信息。
 * 版式参照 blog-v3.kemeow.top/anime 的 bgm-card：定高卡片、单行标题、简介沉底。
 * 「公开评分 / 我的评分 / 我的评价 / 简介」均遵循「有则显示、无则隐藏」。
 */
const props = defineProps<{ item: BgmCollection }>()

const appConfig = useAppConfig()
const subject = computed(() => props.item.subject)
const title = computed(() => subject.value.name_cn || subject.value.name)
// 封面同样走反代（API 回传的仍是 lain.bgm.tv 原址，不会被反代改写）
const cover = computed(() => {
	const raw = subject.value.images?.common || subject.value.images?.large || ''
	return raw ? withBgmProxy(appConfig.bangumi.proxy, raw) : ''
})
const link = computed(() => `https://bgm.tv/subject/${props.item.subject_id}`)

// 0 = 暂无评分 / 未评分，按「无」处理
const score = computed(() => subject.value.score || 0)
const myRate = computed(() => props.item.rate || 0)
const myComment = computed(() => props.item.comment?.trim() || '')
const summary = computed(() => subject.value.short_summary?.trim() || '')
</script>

<template>
<UtilLink :to="link" class="bgm-card">
	<!-- referrerpolicy：lain.bgm.tv 有防盗链，去掉 referer 才能稳定出图 -->
	<img
		v-if="cover"
		class="bgm-cover"
		:src="cover"
		:alt="title"
		loading="lazy"
		referrerpolicy="no-referrer"
	>
	<span v-else class="bgm-cover bgm-cover-empty">
		<Icon name="tabler:photo-off" />
	</span>

	<div class="bgm-info">
		<h3 class="bgm-title text-creative">
			{{ title }}
		</h3>

		<div class="bgm-meta">
			<span v-if="subject.date">
				<Icon name="tabler:calendar" />{{ subject.date }}
			</span>
			<span v-if="score">
				<Icon name="tabler:star" />{{ score }}
			</span>
			<span v-if="myRate" class="bgm-rate">
				<Icon name="tabler:star-filled" />我的 {{ myRate }}
			</span>
		</div>

		<p v-if="myComment" class="bgm-comment">
			{{ myComment }}
		</p>

		<p v-if="summary" class="bgm-summary">
			{{ summary }}
		</p>
	</div>
</UtilLink>
</template>

<style lang="scss" scoped>
.bgm-card {
	display: flex;
	overflow: hidden;
	height: 180px;
	border: 1px solid var(--c-border);
	border-radius: 8px;
	background-color: var(--c-bg-3);
	color: var(--c-text-3);
	transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
	animation: float-in 0.2s var(--delay) backwards;

	&:hover {
		border-color: var(--c-primary);
		box-shadow: var(--box-shadow-2);
		transform: translateY(-2px);
	}
}

.bgm-cover {
	flex-shrink: 0;
	width: 120px;
	height: 100%;
	margin: 0;
	background-color: var(--c-bg-2);
	object-fit: cover;
}

.bgm-cover-empty {
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 1.8em;
	color: var(--c-text-3);
}

.bgm-info {
	display: flex;
	flex-direction: column;
	flex-grow: 1;
	overflow: hidden;
	padding: 12px;
}

.bgm-title {
	overflow: hidden;
	margin: 0 0 8px;
	font-size: 16px;
	white-space: nowrap;
	text-overflow: ellipsis;
	color: var(--c-text);
}

.bgm-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 4px 12px;
	margin: 0 0 8px;
	font-size: 12px;
	color: var(--c-text-2);

	> span {
		display: inline-flex;
		align-items: center;
		gap: 0.3em;
		font-variant-numeric: tabular-nums;
	}
}

// 我的评分：唯一的主题色，从公开评分里跳出来
.bgm-rate {
	color: var(--c-primary);
}

// 我的评价：站主自己的话，语气上突出一点
.bgm-comment {
	display: -webkit-box;
	overflow: hidden;
	margin: 0;
	font-size: 13px;
	-webkit-line-clamp: 2;
	line-clamp: 2;
	line-height: 1.4;
	color: var(--c-text-1);
	-webkit-box-orient: vertical;

	&::before {
		content: "「";
	}

	&::after {
		content: "」";
	}
}

// 简介沉到卡片底部（无评价时贴着标题下方留白撑开）
.bgm-summary {
	display: -webkit-box;
	overflow: hidden;
	margin: 8px 0 0;
	margin-top: auto;
	font-size: 13px;
	-webkit-line-clamp: 2;
	line-clamp: 2;
	line-height: 1.4;
	color: var(--c-text-3);
	-webkit-box-orient: vertical;
}
</style>
