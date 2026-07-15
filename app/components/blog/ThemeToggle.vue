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
	display: flex;
	gap: 3px;
	width: fit-content;
	margin: 0 auto;
	padding: 2px;
	border: 1px solid var(--c-border);
	border-radius: 1rem;
	background-color: var(--c-bg-2);

	> button {
		padding: 4px 1rem;
		border-radius: 1rem;
		transition: all 0.1s;

		&:hover {
			background-color: var(--c-bg-soft);
			color: var(--c-text-1);
		}

		&.active {
			box-shadow: var(--box-shadow-2);
			background-color: var(--ld-bg-card);
			color: var(--c-text-1);
			cursor: auto;
		}
	}
}
</style>
