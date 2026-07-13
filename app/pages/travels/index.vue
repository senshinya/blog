<script setup lang="ts">
import travels from '~/travels'

const appConfig = useAppConfig()

useSeoMeta({
	title: '游记',
	description: `${appConfig.title}的旅行记录：走过的地方、拍下的照片，和当时的心情。`,
})

const items = computed(() => travels.map(travel => ({
	...travel,
	photoCount: travel.days.reduce((sum, day) => sum + day.photos.length, 0),
})))
</script>

<template>
<template #aside>
	<TransitionGroup name="aside-widget">
		<WidgetBlogStats key="blog-stats" />
	</TransitionGroup>
</template>

<div class="travels proper-height">
	<header class="travels-header">
		<h1 class="text-creative">
			游记
		</h1>
		<p class="travels-desc">
			走过的地方，和当时拍下的照片。
		</p>
	</header>

	<ol class="travel-list">
		<li v-for="travel in items" :key="travel.slug">
			<NuxtLink class="travel-card" :to="`/travels/${travel.slug}`">
				<img
					class="travel-cover"
					:src="travel.coverImage"
					:alt="travel.title"
					loading="lazy"
				>
				<div class="travel-info">
					<h2 class="travel-title">
						{{ travel.title }}
					</h2>
					<p class="travel-subtitle">
						{{ travel.subtitle }}
					</p>
					<p class="travel-summary">
						{{ travel.description }}
					</p>
					<p class="travel-meta">
						<span><Icon name="tabler:calendar" /> {{ travel.published }}</span>
						<span><Icon name="tabler:route" /> {{ travel.totaldays }} 天</span>
						<span><Icon name="tabler:photo" /> {{ travel.photoCount }} 张</span>
					</p>
				</div>
			</NuxtLink>
		</li>
	</ol>
</div>
</template>

<style lang="scss" scoped>
.travels {
	padding: 1rem;
}

.travels-header {
	margin-bottom: 2rem;

	> h1 {
		font-size: 1.5rem;
	}
}

.travels-desc {
	color: var(--c-text-2);
}

.travel-list {
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
	list-style: none;
}

.travel-card {
	display: block;
	overflow: hidden;
	border: 1px solid var(--c-border);
	border-radius: 1rem;
	box-shadow: var(--box-shadow-1);
	background-color: var(--ld-bg-card);
	transition: box-shadow var(--delay), transform var(--delay);

	&:hover {
		box-shadow: var(--box-shadow-3);
		transform: translateY(-0.2rem);

		.travel-cover {
			scale: 1.03;
		}
	}
}

.travel-cover {
	width: 100%;
	aspect-ratio: 16 / 9;
	transition: scale var(--delay);
	object-fit: cover;
}

.travel-info {
	padding: 1rem 1.2rem 1.2rem;
}

.travel-title {
	font-size: 1.25rem;
}

.travel-subtitle {
	margin-bottom: 0.5rem;
	font-size: 0.9rem;
	color: var(--c-text-2);
}

.travel-summary {
	margin-bottom: 0.8rem;
	white-space: pre-line; // description 里的换行是作者排的分行，保住
	color: var(--c-text-1);
}

.travel-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 1rem;
	font-size: 0.85rem;
	color: var(--c-text-3);

	> span {
		display: flex;
		align-items: center;
		gap: 0.3em;
	}
}
</style>
