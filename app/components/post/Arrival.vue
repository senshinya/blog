<script setup lang="ts">
const { arrival } = useArticleArrival()
const post = computed(() => arrival.value?.moving ? arrival.value.post : arrival.value?.resolved ?? arrival.value?.post)
</script>

<template>
<div v-if="arrival?.visible && !(arrival.failed && !arrival.moving && !arrival.loading)" class="article-arrival">
	<PostHeader v-if="post" v-bind="post" :preview-image="arrival.cover" :hold-cover="arrival.moving" />
	<PostExcerpt v-if="post?.description" :excerpt="post.description" />
	<div v-if="arrival.loading || arrival.moving" class="article-arrival-loading" role="status" :aria-label="$t('post.loading')">
		<span class="arrival-status">{{ $t('post.loading') }}</span>
		<div class="arrival-heading" />
		<div class="arrival-lines">
			<i /><i /><i /><i />
		</div>
		<div class="arrival-lines">
			<i /><i /><i />
		</div>
	</div>
</div>
</template>

<style scoped>
.article-arrival-loading {
	min-height: max(28rem, calc(100dvh - 22rem));
	padding: 1.5rem 1rem;
	color: var(--c-text-3);
	animation: content-in 0.2s ease-out;
}
.arrival-status {
	display: block;
	opacity: 0.6;
	margin-bottom: 1.5rem;
	font-size: 0.8rem;
}
.arrival-heading, .arrival-lines i {
	display: block;
	opacity: 0.1;
	border-radius: 0.3rem;
	background: currentColor;
}
.arrival-heading {
	width: 25%;
	height: 1.2rem;
	margin-block: 0.5rem 2rem;
}
.arrival-lines {
	display: grid;
	gap: 1rem;
	margin-bottom: 2rem;
	animation: arrival-breathe 1.6s ease-in-out infinite alternate;
}
.arrival-lines i {
	height: 0.75rem;
	&:last-child { width: 64%; }
}
@keyframes arrival-breathe {
	from { opacity: 0.5; }
	to { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
	.article-arrival-loading, .arrival-lines { animation: none; }
}
</style>
