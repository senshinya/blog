<script setup lang="ts">
import blogConfig from '~~/blog.config'
import { UtilDate } from '#components'

const appConfig = useAppConfig()
const runtimeConfig = useRuntimeConfig()
const { t, locale } = useI18n()
const currentLanguage = computed(() =>
	blogConfig.locales.find(l => l.code === locale.value)?.language ?? blogConfig.language)

const shortUnits: Record<string, string> = {
	'time.units.century': 'c',
	'time.units.year': 'y',
	'time.units.month': 'mo',
	'time.units.day': 'd',
	'time.units.hour': 'h',
	'time.units.minute': 'min',
	'time.units.second': 's',
}
const duration = computed(() => timeElapse(appConfig.timeEstablished, (key, named, plural) =>
	locale.value === 'en' && named?.n !== undefined && shortUnits[key]
		? `${named.n}${shortUnits[key]}`
		: t(key, named ?? {}, plural ?? 1), currentLanguage.value))

// 响应头不正确时，stats.value 可能会是字符串，首次属性访问可能为 undefined
const { data: stats } = useFetch('/api/stats')

const yearlyTip = computed(() => Object
	.entries(stats.value?.annual || {})
	.reverse()
	.map(([year, item]) => t('widget.blogStats.yearlyLine', { year, posts: item.posts, words: formatNumber(item.words, currentLanguage.value) }, item.posts))
	.join('\n') || t('widget.blogStats.fetchError'),
)

const blogStats = computed(() => [{
	label: t('widget.blogStats.duration'),
	value: duration,
	tip: t('widget.blogStats.launchedTip', { date: appConfig.timeEstablished }),
}, {
	label: t('widget.blogStats.lastUpdate'),
	value: () => h(UtilDate, {
		date: runtimeConfig.public.buildTime,
		relative: true,
		relativeStyle: locale.value === 'en' ? 'narrow' : 'long',
	}),
}, {
	label: appConfig.stats.includePaths.length ? t('widget.blogStats.wordCountFiltered') : t('widget.blogStats.wordCountTotal'),
	value: computed(() => formatNumber(stats.value?.total?.words, currentLanguage.value) || '--'),
	tip: yearlyTip,
}])
</script>

<template>
<BlogWidget class="blog-stats" card :title="$t('widget.blogStats.title')">
	<ZDlGroup :items="blogStats" size="small" />
</BlogWidget>
</template>

<style scoped>
/* Keep the three statistics side by side. Shared rows align values even when */
/* translated labels wrap; each text snapshot remains clipped to its own column. */
.blog-stats :deep(.dl-group.small) {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 0 1em;

	> div {
		display: grid;
		grid-row: span 2;
		grid-template-rows: subgrid;
		min-width: 0;
		white-space: normal;

		> dt,
		> dd {
			overflow: clip;
			overflow-wrap: anywhere;
			min-width: 0;
		}
	}
}
</style>
