<script setup lang="ts">
const { slots } = inject<any>(Symbol.for('dxup:layout-slots')) || {}

/**
 * has-aside 必须等挂载后再算，否则同步页面会 hydration mismatch。
 *
 * dxup 的 LayoutSlotsForward 在自己的 setup 里往注册表写 slots，而 SSR 是顺序
 * push：编译出来的布局 render 先 ssrRenderSlot(默认插槽)、之后才求值 BlogPanel
 * 的 props。页面组件带顶层 await（index/archive/friends/[...slug] 等）时它被推进
 * promise buffer，求值那一刻注册表还是空的 → 服务端 false；页面是同步组件
 * （travels/index、memos/index）时当场就渲染完了 → 服务端 true。
 * 而客户端 render 时子组件尚未创建，注册表首帧恒空 → 恒 false。
 * 于是那两个同步页面上两端首帧对不上，#blog-panel 的侧栏开关按钮就是那条
 * node mismatch。用 mounted 把两端首帧一律钉成 false，挂载后 slots 这个
 * shallowRef 照常响应式，按钮该出现还是出现。
 */
const mounted = useMounted()
</script>

<template>
<NuxtLoadingIndicator />
<NuxtRouteAnnouncer :style="{ position: 'absolute' }" />
<BlogSkipToContent />
<BlogSidebar />
<div id="content">
	<main id="main-content">
		<slot />
		<BlogFooter />
	</main>
	<BlogAside>
		<slot name="aside" />
	</BlogAside>
</div>
<BlogPanel :has-aside="mounted && !!slots?.aside" />
<BikariyaModals />
</template>

<!-- eslint-disable-next-line vue/enforce-style-attribute -->
<style lang="scss">
#blog-root {
	display: flex;
	justify-content: center;
	gap: 1rem;
	min-width: 0;
}

#blog-sidebar, #blog-aside {
	flex: 0 0 280px; // 防止搜索框 grow
	position: sticky;
	top: 0;
	height: 100vh;
	height: 100dvh;
	min-width: 0; // 防止搜索框撑开页面
	scrollbar-width: thin;

	@media (max-width: $breakpoint-widescreen) {
		flex-shrink: 0.2;
	}
}

#content {
	display: flex;
	gap: 1rem;

	// 若设置的是 max-width，则内部 main 宽度为 fit-content，可能无法撑满
	// 此时即使设置 flex-grow，也会影响 #sidebar 无法正确 shrink
	width: $breakpoint-widescreen;
	min-width: 0; // 解决父级 flexbox 设置 justify-content: center 时溢出左侧消失的问题

	// 此处不建议给内容设置 padding
	> #main-content {
		flex-grow: 1; // 使较小宽度的内容占满

		// overflow: hidden; // 会使一部分元素吸顶失效

		// 使内容正确计算宽度而不横向溢出
		// 也可设置 width: 0 或者 contain: inline-size（兼容性不佳）
		min-width: 0;
	}
}
</style>
