<script setup lang="ts">
const props = defineProps<{
	/** 仓库全名，如 `owner/name` */
	repo: string
}>()

interface RepoData {
	description: string | null
	stargazers_count: number
	forks_count: number
	language: string | null
	license: { spdx_id: string | null } | null
	owner: { avatar_url: string }
}

// 在预渲染时取数并烤进 HTML：访客不必再打 GitHub API，
// 既避开了未登录用户 60 次/小时的限流，也没有卡片撑开时的布局抖动。
// 取数失败时 data 为 null，模板降级为只有仓库名的卡片。
const { data } = await useAsyncData(
	`github:${props.repo}`,
	() => $fetch<RepoData>(`https://api.github.com/repos/${props.repo}`),
	{ default: () => null },
)

const compactNum = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const subtitle = computed(() => data.value?.license?.spdx_id ?? data.value?.language ?? null)
</script>

<template>
<UtilLink :to="`https://github.com/${repo}`" class="github-card card" :title="repo">
	<NuxtImg
		v-if="data?.owner.avatar_url"
		class="github-avatar"
		:src="data.owner.avatar_url"
		:alt="repo.split('/')[0]"
		width="48"
		height="48"
	/>
	<Icon v-else class="github-avatar-fallback" name="tabler:brand-github" />

	<div class="github-info">
		<div class="github-repo">
			<Icon name="tabler:brand-github" />
			<span>{{ repo }}</span>
		</div>

		<div class="github-desc">
			{{ data?.description ?? '暂无描述' }}
		</div>

		<div v-if="data" class="github-meta">
			<span><Icon name="tabler:star" /> {{ compactNum.format(data.stargazers_count) }}</span>
			<span><Icon name="tabler:git-fork" /> {{ compactNum.format(data.forks_count) }}</span>
			<span v-if="subtitle">{{ subtitle }}</span>
		</div>
	</div>
</UtilLink>
</template>

<style lang="scss" scoped>
.github-card {
	display: flex;
	align-items: center;
	gap: 0.8rem;
	padding: 0.6em 0.9em;
	font-size: 0.9em;
	line-height: 1.4;

	article & {
		width: 24rem;
		max-width: 90%;
		margin: 2rem auto;
	}
}

.github-avatar {
	flex-shrink: 0;
	width: 3rem;
	height: 3rem;
	border-radius: 0.5rem;
}

.github-avatar-fallback {
	flex-shrink: 0;
	width: 3rem;
	height: 3rem;
	color: var(--c-text-3);
}

.github-info {
	flex-grow: 1;
	overflow: hidden;
}

.github-repo {
	display: flex;
	align-items: center;
	gap: 0.3em;
	overflow: hidden;
	font-family: var(--font-monospace);
	white-space: nowrap;
	text-overflow: ellipsis;
}

.github-desc {
	display: -webkit-box;
	overflow: hidden;
	opacity: 0.5;
	margin-top: 0.2em;
	font-size: 0.9em;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	line-clamp: 2;
}

.github-meta {
	display: flex;
	gap: 0.8em;
	margin-top: 0.3em;
	font-size: 0.8em;
	color: var(--c-text-3);

	> span {
		display: flex;
		align-items: center;
		gap: 0.2em;
	}
}
</style>
