<script setup lang="ts">
import blogConfig from '~~/blog.config'
import { localePageKey } from '~/utils/locale'

const { locale } = useI18n()
const locales = blogConfig.locales.map(language => language.code)

// key 与 useLocaleAlternates() 发的 hreflang alternate link 区分开 —— 两者都是
// rel="alternate"，若不给 key，Unhead 可能把它们当同一条互相去重
useHead({
	link: [{
		key: 'atom-feed',
		rel: 'alternate',
		type: 'application/atom+xml',
		href: () => locale.value === 'zh' ? '/atom.xml' : `/${locale.value}/atom.xml`,
	}],
})

// 放在 app.vue 而非 layouts/default.vue：app/pages/travels/[slug].vue 设了
// layout: false 不走默认布局，而游记恰是唯一真正有多语言差异版本的内容
// （app/travels/<locale>/*.yaml），是清单驱动 hreflang 最要紧的场景。
// app.vue 不管走不走布局都会渲染，能覆盖到这一页。
useLocaleAlternates()

// 同样放在 app.vue：/travels/[slug] 设了 layout: false，放在 layouts/default.vue
// 里会漏掉这一页的日文字体
useLocaleFonts()
</script>

<template>
<NuxtLayout>
	<!-- 缓存固定的入口 VNode，避免内联 pageKey 的引用变化重启加载条；路由仍由 NuxtPage 内部更新。 -->
	<NuxtPage v-once :page-key="route => localePageKey(route.path, locales, 'zh')" />
</NuxtLayout>
</template>
