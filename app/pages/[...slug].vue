<script setup lang="ts">
import blogConfig from '~~/blog.config'
import { stripLocale } from '~/utils/locale'

const LOCALES = blogConfig.locales.map(l => l.code)

const route = useRoute()
const collection = useContentCollection()

const dataKey = computed(() => `content:${route.path}`)
const { data: post } = await useAsyncData(
	dataKey,
	() => queryCollection(collection.value).path(stripLocale(route.path, LOCALES, 'zh').basePath).first(),
	{ watch: [collection] },
)

const excerpt = computed(() => post.value?.description || '')
const asideWidgetNames = computed<WidgetName[]>(() => {
	if (!post.value)
		return ['blog-log']
	return (post.value.meta?.aside as WidgetName[] | undefined) ?? ['toc']
})
const { widgets } = useWidgets(asideWidgetNames)

if (post.value) {
	useSeoMeta({
		title: post.value.title,
		ogType: 'article',
		ogImage: post.value.image,
		description: post.value.description,
	})
}
else {
	const event = useRequestEvent()
	event && setResponseStatus(event, 404)
	route.meta.title = '404'
}
</script>

<template>
<template #aside>
	<!-- TransitionGroup 必须在此层：dxup 把布局里的 <slot name="aside"> 编译成 LayoutSlot 组件，
		放在 BlogAside 里只会看到那一个组件 vnode，看不见 widget 的增删 -->
	<TransitionGroup name="aside-widget">
		<!-- 更换页面时相同 key 的组件不会更新 -->
		<component :is="widget.comp" v-for="widget in widgets" :key="widget.name" />
	</TransitionGroup>
</template>

<template v-if="post">
	<PostHeader v-bind="post" />
	<PostExcerpt v-if="excerpt" :excerpt />
	<!-- 使用 float-in 动画会导致搜索跳转不准确 -->
	<ContentRenderer
		class="article"
		:class="getPostTypeClassName(post?.type, { prefix: 'md' })"
		:value="post"
		tag="article"
	/>

	<PostFooter v-bind="post" />
	<PostSurround />
	<PostComment :title="post.title" />
</template>

<ZError
	v-else
	icon="line-md:document-delete-twotone"
	:title="$t('page.notFound.title')"
/>
</template>
