<script setup lang="ts">
const { locale } = useI18n()

// key 与后续任务加的 hreflang alternate link 区分开 —— 两者都是
// rel="alternate"，若不给 key，Unhead 可能把它们当同一条互相去重
useHead({
	link: [{
		key: 'atom-feed',
		rel: 'alternate',
		type: 'application/atom+xml',
		href: () => locale.value === 'zh' ? '/atom.xml' : `/${locale.value}/atom.xml`,
	}],
})
</script>

<template>
<NuxtLayout>
	<NuxtPage />
</NuxtLayout>
</template>
