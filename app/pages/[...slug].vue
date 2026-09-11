<script setup lang="ts">
import blogConfig from '~~/blog.config'
import { articleSeries } from '~/utils/articleSeries'
import { stripLocale } from '~/utils/locale'

const LOCALES = blogConfig.locales.map(l => l.code)

const route = useRoute()
const { locale } = useI18n()
const collection = useContentCollection()
const contentPath = useContentPath()
const discussionKey = computed(() => stripLocale(contentPath.value, LOCALES, 'zh').basePath)

const dataKey = computed(() => `content:${contentPath.value}`)
const { data: post } = await useAsyncData(
	dataKey,
	async () => {
		const entry = await queryCollection(collection.value).path(stripLocale(contentPath.value, LOCALES, 'zh').basePath).first()
		return import.meta.dev || isPublicArticle(entry) ? entry : null
	},
	{ watch: [collection] },
)

useContentResources(() => post.value)

const hasSeries = computed(() => !!post.value?.stem.startsWith('posts/') && articleSeries.some(series => series.paths.includes(post.value!.path)))
const excerpt = computed(() => post.value?.description || '')
const asideWidgetNames = computed<WidgetName[]>(() => {
	if (!post.value)
		return ['blog-log']
	return (post.value.meta?.aside as WidgetName[] | undefined) ?? ['toc']
})
const { widgets } = useWidgets(asideWidgetNames)

if (post.value) {
	useSeoMeta({
		title: post.value.seoTitle || post.value.title,
		ogTitle: post.value.seoTitle || post.value.title,
		twitterTitle: post.value.seoTitle || post.value.title,
		ogType: 'article',
		ogImage: post.value.image,
		description: post.value.seoDescription || post.value.description,
		ogDescription: post.value.seoDescription || post.value.description,
		twitterDescription: post.value.seoDescription || post.value.description,
	})

	if (post.value.stem.startsWith('posts/')) {
		const schema = articleSchemaData(post.value, route.path, blogConfig.locales.find(l => l.code === locale.value)!.language, blogConfig)
		useSchemaOrg([definePerson(schema.person), defineArticle(schema.article)])
	}
}
else {
	const event = useRequestEvent()
	event && setResponseStatus(event, 404)
	route.meta.title = '404'
}
</script>

<template>
<template #aside>
	<!-- 每篇文章拥有独立的目录状态，沿用布局的原生入场。 -->
	<component :is="widget.comp" v-for="widget in widgets" :key="`${contentPath}:${widget.name}`" />
</template>

<template #comments>
	<PostComment v-if="post" :key="discussionKey" :title="post.title" />
</template>

<template v-if="post">
	<PostHeader v-bind="post" />
	<PostExcerpt v-if="excerpt" :excerpt />
	<!-- 正文只淡入，保持 URL 锚点和目录测量的坐标稳定。 -->
	<ContentRenderer
		class="article"
		data-transition-enter
		:class="getPostTypeClassName(post?.type, { prefix: 'md' })"
		:value="post"
		tag="article"
	/>

	<PostSeries v-if="hasSeries" :path="post.path" />
	<PostFooter v-bind="post" />
	<PostSurround v-if="!hasSeries" />
</template>

<ZError
	v-else
	icon="line-md:document-delete-twotone"
	:title="$t('page.notFound.title')"
/>
</template>
