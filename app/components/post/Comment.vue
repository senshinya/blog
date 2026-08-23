<script setup lang="ts">
/**
 * 文章页的评论区。
 *
 * page key 取当前路由路径 —— 与 giscus 时代的 pathname 映射同一个值，
 * 且新旧站 URL 一致，历史评论由服务端的 import 任务按同一套 key 落库，线程不断。
 */
withDefaults(defineProps<{
	/** 首次落库时写进 pages 表，仅用于站长面板和通知邮件的标题 */
	title?: string
	/** 页面级 reaction 那一行。友链页没有「读完了」这回事，故可关掉 */
	reactions?: boolean
}>(), { reactions: true })
</script>

<template>
<CommentSection heading :reactions :title />
</template>

<style lang="scss" scoped>
.z-comment {
	margin: 3rem 1rem;
}
</style>
