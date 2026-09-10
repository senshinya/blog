<script setup lang="ts">
import { myFeed } from '~~/blog.config'
import feeds from '~/feeds'
import { buildPath } from '~/utils/locale'

const appConfig = useAppConfig()
const { t, locale } = useI18n()

const collection = useContentCollection()
const dataKey = computed(() => `content:/friends:${collection.value}`)
const { data: postLink } = await useAsyncData(
	dataKey,
	() => queryCollection(collection.value).path('/friends').first(),
	{ watch: [collection] },
)

useSeoMeta({
	title: () => t('page.friends.title'),
	ogType: 'profile',
	description: () => t('page.friends.description', { site: appConfig.title }),
})

// myFeed.desc 兜底用的 blogConfig.subtitle、myFeed.comment 都是中文默认值，
// 友链页展示"我的博客信息"卡片时要跟着语言走——用 i18n 词条覆盖，而不是动
// blog.config.ts 这份多处（OPML 等构建期消费方）共用的默认语言源
const myDesc = computed(() => t('site.subtitle'))
const myComment = computed(() => t('page.friends.myComment'))

// feeds.ts 里的 myFeed 同时出现在自己的友链分组里（是自己友链列表里的"自己"这个彩蛋），
// 那份列表和其余条目一样走 FeedGroup -> FeedCard 的通用渲染，其余条目的 desc/comment
// 是别人的博客名与自我介绍，本就该保留原文；只有 myFeed 这一条需要按引用识别出来单独覆盖，
// 不能改 feeds.ts 本身——它还被友链检测 CLI 用相对路径直接导入
const localizedFeeds = computed(() => feeds.map(group => ({
	...group,
	entries: group.entries.map(entry => entry === myFeed
		? { ...entry, desc: myDesc.value, comment: myComment.value }
		: entry),
})))

const copyFields = computed(() => [
	{ id: 'author', prompt: t('page.friends.author'), code: myFeed.author },
	{ id: 'blogTitle', prompt: t('page.friends.blogTitle'), code: myFeed.title },
	{ id: 'blogDesc', prompt: t('page.friends.blogDesc'), code: myDesc.value },
	{ id: 'blogUrl', prompt: t('page.friends.blogUrl'), code: myFeed.link },
	{ id: 'avatar', prompt: t('page.friends.avatar'), code: myFeed.avatar },
])
</script>

<template>
<template #aside>
	<!-- TransitionGroup 必须在此层：dxup 把布局里的 <slot name="aside"> 编译成 LayoutSlot 组件，
		放在 BlogAside 里只会看到那一个组件 vnode，看不见 widget 的增删 -->
	<TransitionGroup name="aside-widget">
		<WidgetBlogStats key="blog-stats" />
		<WidgetMemos key="memos" />
		<WidgetBlogTech key="blog-tech" />
	</TransitionGroup>
</template>

<div class="mobile-only">
	<BlogHeader :to="buildPath('/', locale, 'zh')" tag="h1" />
</div>

<FeedGroup
	v-for="group in localizedFeeds"
	:key="group.name ?? group.nameKey"
	v-bind="group"
	:shuffle="appConfig.link.randomInGroup"
/>

<Tab :tabs="[$t('page.friends.myInfo'), $t('page.friends.apply')]" center>
	<template #tab1>
		<div class="friends-tab">
			<FeedCard v-bind="myFeed" :desc="myDesc" :comment="myComment" />
			<Copy v-for="field in copyFields" :key="field.id" :prompt="field.prompt" :code="field.code" />
		</div>
	</template>
	<template #tab2>
		<ContentRenderer
			v-if="postLink"
			:value="postLink"
			class="article"
		/>
		<p v-else class="text-center">
			{{ $t('page.friends.applyNotice') }}
		</p>
	</template>
</Tab>

<PostComment :title="$t('page.friends.title')" :reactions="false" />
</template>

<style lang="scss" scoped>
.friends-tab {
	margin: 1rem;
}
</style>
