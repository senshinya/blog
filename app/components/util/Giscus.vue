<script setup lang="ts">
/**
 * giscus 挂载点。
 *
 * 文章用 pathname 映射（与旧站一致，故历史评论线程不断）；
 * 碎语用 specific 映射 + term 指定，一条 memo 一个 Discussion。
 */
const props = defineProps<{
	/** mapping 为 specific 时的 Discussion 标题 */
	term?: string
	mapping?: string
	category?: string
	categoryId?: string
}>()

const appConfig = useAppConfig()
const colorMode = useColorMode()
const el = useTemplateRef('giscus')

const giscusTheme = computed(() => colorMode.value === 'dark' ? 'dark' : 'light')

/**
 * giscus 的主题 <link> 是在它自己的 iframe（origin: giscus.app）里创建的，
 * 相对路径会拼到 giscus.app 上，故必须给绝对 URL。
 * 用 location.origin 而非硬编码域名：prod / preview / 自定义域名各自加载本部署下的
 * /giscus/*.css（CORS 头见 netlify.toml 与 nuxt.config vercel.config.routes）。
 * 只在客户端调用（onMounted / watch 回调），SSR 阶段不碰 window。
 */
function themeUrl(theme: string) {
	return `${location.origin}/giscus/${theme}.css`
}

onMounted(() => {
	const { giscus } = appConfig
	if (!giscus || !el.value)
		return

	const script = document.createElement('script')
	script.src = 'https://giscus.app/client.js'
	script.async = true
	script.crossOrigin = 'anonymous'

	Object.assign(script.dataset, {
		repo: giscus.repo,
		repoId: giscus.repoId,
		category: props.category ?? giscus.category,
		categoryId: props.categoryId ?? giscus.categoryId,
		mapping: props.mapping ?? giscus.mapping,
		...(props.term && { term: props.term }),
		strict: giscus.strict,
		reactionsEnabled: giscus.reactionsEnabled,
		emitMetadata: giscus.emitMetadata,
		inputPosition: giscus.inputPosition,
		lang: giscus.lang,
		theme: themeUrl(giscusTheme.value),
		loading: 'lazy',
	})

	el.value.append(script)
})

// giscus 渲染在 iframe 内，只能通过 postMessage 通知它换肤
watch(giscusTheme, (theme) => {
	document.querySelectorAll<HTMLIFrameElement>('iframe.giscus-frame')
		.forEach(frame => frame.contentWindow?.postMessage(
			{ giscus: { setConfig: { theme: themeUrl(theme) } } },
			'https://giscus.app',
		))
})
</script>

<template>
<div ref="giscus" class="giscus">
	<p class="loading">
		评论加载中...
	</p>
</div>
</template>

<style lang="scss" scoped>
.giscus {
	margin: 1em 0;
}

.loading {
	font-size: 0.9em;
	color: var(--c-text-3);
}
</style>
