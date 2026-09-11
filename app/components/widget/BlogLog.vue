<script setup lang="ts">
const { timeEstablished } = useAppConfig()
const { t } = useI18n()

const blogLog = computed(() => [
	{ label: '2026-09-11', value: t('widget.blogLog.aiDisclosure') },
	{ label: '2026-09-10', value: t('widget.blogLog.multilingual') },
	{ label: '2026-08-23', value: t('widget.blogLog.commentMigration') },
	{ label: '2026-07-13', value: t('widget.blogLog.contentMigration') },
	{ label: '2026-05-10', value: t('widget.blogLog.stackRewrite') },
	{ label: timeEstablished, value: t('widget.blogLog.firstPost') },
])
</script>

<template>
<BlogWidget card :title="$t('widget.blogLog.title')">
	<ZDlGroup size="large" :items="blogLog" />
</BlogWidget>
</template>
