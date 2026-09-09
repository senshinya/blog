<script setup lang="ts">
import { UtilDate } from '#components'

const appConfig = useAppConfig()
const runtimeConfig = useRuntimeConfig()
const { t } = useI18n()

// 响应头不正确时，stats.value 可能会是字符串，首次属性访问可能为 undefined
const { data: stats } = useFetch('/api/stats')

const yearlyTip = computed(() => Object
	.entries(stats.value?.annual || {})
	.reverse()
	.map(([year, item]) => t('widget.blogStats.yearlyLine', { year, posts: item.posts, words: formatNumber(item.words) }, item.posts))
	.join('\n') || t('widget.blogStats.fetchError'),
)

const blogStats = computed(() => [{
	label: t('widget.blogStats.duration'),
	value: timeElapse(appConfig.timeEstablished),
	tip: t('widget.blogStats.launchedTip', { date: appConfig.timeEstablished }),
}, {
	label: t('widget.blogStats.lastUpdate'),
	value: () => h(UtilDate, {
		date: runtimeConfig.public.buildTime,
		relative: true,
	}),
}, {
	label: appConfig.stats.includePaths.length ? t('widget.blogStats.wordCountFiltered') : t('widget.blogStats.wordCountTotal'),
	value: computed(() => formatNumber(stats.value?.total?.words) || '--'),
	tip: yearlyTip,
}])
</script>

<template>
<BlogWidget card :title="$t('widget.blogStats.title')">
	<ZDlGroup :items="blogStats" size="small" />
</BlogWidget>
</template>
