<script setup lang="ts">
import blogConfig from '~~/blog.config'
import { manifest } from '#build/i18n-manifest'
import { stripLocale } from '~/utils/locale'

const route = useRoute()
const switchLocalePath = useSwitchLocalePath()
const { persist } = useLocalePreference()

const LOCALES = blogConfig.locales.map(l => l.code)

/**
 * 当前语言由 URL 决定，服务端与客户端看到同一个值，
 * 因此不需要 ThemeToggle 那个 mounted 守卫 —— 那边的偏好存在
 * localStorage，服务端不可知，才会 hydration mismatch。
 */
const current = computed(() => stripLocale(route.path, LOCALES, 'zh').locale)

/** 清单里查不到的路径是应用页面，i18n 为每个语言都生成了 */
const available = computed(() => {
	const { basePath } = stripLocale(route.path, LOCALES, 'zh')
	return manifest[basePath] ?? LOCALES
})

function choose(code: string) {
	// aria-disabled 不像原生 disabled 那样拦截点击，得自己挡
	if (!available.value.includes(code))
		return
	persist(code)
	const path = switchLocalePath(code)
	// 路由无法在目标语言解析时（例如 404 页）返回空串，此时只记偏好不跳转
	if (path)
		return navigateTo(path)
}
</script>

<template>
<div class="lang-toggle">
	<button
		v-for="locale in blogConfig.locales"
		:key="locale.code"
		v-tip="available.includes(locale.code) ? locale.label : $t('lang.unavailable')"
		:aria-disabled="!available.includes(locale.code)"
		:aria-label="locale.label"
		:class="{ active: current === locale.code }"
		:lang="locale.code"
		@click="choose(locale.code)"
	>
		{{ locale.name }}
	</button>
</div>
</template>

<style lang="scss" scoped>
.lang-toggle {
	@include segmented-pill;

	margin-bottom: 0.5rem;
}
</style>
