<script setup lang="ts">
import { myFeed } from '~~/blog.config'
import feeds from '~/feeds'

const appConfig = useAppConfig()
const { t } = useI18n()

const { data: postLink } = await useAsyncData(
	'content:/friends',
	() => queryCollection('content_zh').path('/friends').first(),
)

useSeoMeta({
	title: () => t('page.friends.title'),
	ogType: 'profile',
	description: () => t('page.friends.description', { site: appConfig.title }),
})

const copyFields = computed(() => [
	{ id: 'author', prompt: t('page.friends.author'), code: myFeed.author },
	{ id: 'blogTitle', prompt: t('page.friends.blogTitle'), code: myFeed.title },
	{ id: 'blogDesc', prompt: t('page.friends.blogDesc'), code: myFeed.desc },
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
	<BlogHeader to="/" tag="h1" />
</div>

<FeedGroup
	v-for="group in feeds"
	:key="group.name ?? group.nameKey"
	v-bind="group"
	:shuffle="appConfig.link.randomInGroup"
/>

<Tab :tabs="[$t('page.friends.myInfo'), $t('page.friends.apply')]" center>
	<template #tab1>
		<div class="friends-tab">
			<FeedCard v-bind="myFeed" />
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
