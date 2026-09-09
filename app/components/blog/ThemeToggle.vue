<script setup lang="ts">
const appConfig = useAppConfig()
const colorMode = useColorMode()

/**
 * colorMode.preference 只有客户端才知道（存在 localStorage）。SSR 只能拿到配置默认值
 * 'system'，于是「跟随系统」按钮总被服务端渲染成 active；客户端持久化偏好不同就会
 * hydration class mismatch，而生产环境 Vue 不修正 class mismatch，残留的 active 会一直
 * 挂在「跟随系统」按钮上（表现为两个按钮同时高亮）。
 * 挂载后再点亮：SSR 与首次 hydration 都不点亮 → 一致、不再 mismatch。
 */
const mounted = ref(false)
onMounted(() => mounted.value = true)
</script>

<template>
<div class="theme-toggle">
	<button
		v-for="(themeData, themeName) in appConfig.themes"
		:key="themeName"
		v-tip="themeData.tip"
		:aria-label="themeData.tip"
		:class="{ active: mounted && colorMode.preference === themeName }"
		@click="colorMode.preference = themeName"
	>
		<Icon :name="themeData.icon" />
	</button>
</div>
</template>

<style lang="scss" scoped>
.theme-toggle {
	@include segmented-pill;
}
</style>
