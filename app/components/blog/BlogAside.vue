<script setup lang="ts">
const layoutStore = useLayoutStore()
</script>

<template>
<BlogMask
	:show="layoutStore.state === 'aside'"
	class="widescreen-only"
	@click="layoutStore.close()"
/>

<!-- 不能用 Transition 实现弹出收起动画，因为宽屏状态始终显示 -->
<!-- 如果为空数组则隐藏 -->
<aside id="blog-aside" :class="{ show: layoutStore.state === 'aside' }">
	<slot />
</aside>
</template>

<style lang="scss" scoped>
#blog-aside {
	display: flex;
	flex-direction: column;
	gap: 1rem;

	overflow: auto;
	padding: 0.5rem;
	z-index: var(--z-index-popover);

	// 离场的 widget 必须脱离文档流：否则它收缩期间仍然占位（flex 的 gap 也还在），
	// 下方 widget 只能等它彻底消失后硬跳上来，TransitionGroup 的 FLIP 位移就白设了。
	//
	// 包含块由布局给的 position: sticky 提供（窄屏下是本组件的 fixed），两者都是定位元素，
	// 不要在此另加 position: relative —— scoped 样式会编译成 #blog-aside[data-v-xxx]，
	// 特异度高于布局里的 #blog-aside，会把 sticky 覆盖掉，侧栏就不吸顶了。
	// 绝对定位以 padding box 为参照，故 inset-inline 要对齐上面的 padding。
	> :deep(.aside-widget-leave-active) {
		position: absolute;
		inset-inline: 0.5rem;
	}

	@media (max-width: $breakpoint-widescreen) {
		position: fixed;
		inset-inline-end: 0;
		top: 0;
		width: 320px;
		height: auto;
		max-width: 100%;
		max-height: 100%;
		transform: var(--transform-end-far);
		transition: transform 0.2s;

		// TODO 留 padding-bottom 避让 BlogPanel

		> :deep(.blog-widget) {
			padding: 0.5rem;
			border-radius: 1rem;
			box-shadow: var(--box-shadow-1), var(--box-shadow-2);
			background-color: var(--ld-bg-blur);
			backdrop-filter: blur(0.5rem);
		}

		&.show {
			transform: none;
		}
	}

	&:empty {
		display: none;
	}
}
</style>
