<script setup lang="ts">
// 文章评论沿用旧站的 pathname 映射，且新旧站 URL 一致，故历史评论线程不断
</script>

<template>
<section id="comment" class="z-comment">
	<h3 class="text-creative">
		评论区
	</h3>

	<UtilGiscus />
</section>
</template>

<style lang="scss" scoped>
.z-comment {
	margin: 3rem 1rem;

	> h3 {
		margin-top: 3rem;
		font-size: 1.25rem;
	}
}
</style>
