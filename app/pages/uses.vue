<script setup lang="ts">
const appConfig = useAppConfig()

// key 必须是 content:/uses（= content:${route.path}），
// 侧栏 WidgetToc 经 useArticle() → useNuxtData('content:/uses') 才能拿到 body.toc
const { data: usesDoc } = await useAsyncData(
	'content:/uses',
	() => queryCollection('content').path('/uses').first(),
)

useSeoMeta({
	title: '装备',
	ogType: 'profile',
	description: `${appConfig.title}日常在用的电子产品与自建服务。`,
})
</script>

<template>
<template #aside>
	<!-- TransitionGroup 必须在此层：dxup 把布局里的 <slot name="aside"> 编译成 LayoutSlot 组件，
		放在 BlogAside 里只会看到那一个组件 vnode，看不见 widget 的增删 -->
	<TransitionGroup name="aside-widget">
		<WidgetToc key="toc" />
	</TransitionGroup>
</template>

<ContentRenderer
	v-if="usesDoc"
	:value="usesDoc"
	class="article"
/>
<p v-else class="text-center">
	可于 content/uses.md 配置装备页内容。
</p>
</template>
