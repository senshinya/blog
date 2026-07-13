<script setup lang="ts">
const { timeEstablished } = useAppConfig()

const blogLog = [
	{ label: '2026-07-13', value: '迁移到 Nuxt 4 + Nuxt Content v3，内容回归 Markdown' },
	{ label: '2026-05-10', value: '重构为 SvelteKit + PocketBase，自建后台 CMS' },
	{ label: timeEstablished, value: '发布第一篇文章' },
]
</script>

<template>
<BlogWidget card title="更新日志">
	<ZDlGroup size="large" :items="blogLog" />
</BlogWidget>
</template>
