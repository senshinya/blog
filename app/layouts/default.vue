<script setup lang="ts">
import '~/assets/css/article-layout.css'

const { slots } = provideLayoutSlots()
const { arrival } = useArticleArrival()
const arriving = computed(() => arrival.value?.visible && (arrival.value.loading || arrival.value.moving))
// 同步 memos/travels 页面也与客户端首帧保持一致，挂载后才显示侧栏按钮。
const mounted = useMounted()
</script>

<template>
<NuxtRouteAnnouncer :style="{ position: 'absolute' }" />
<BlogSkipToContent />
<BlogSidebar />
<main id="main-content" :data-article-arriving="arriving || undefined" :aria-busy="arriving || undefined">
	<PostArrival />
	<slot />
	<!-- 评论只在客户端取数；等待页面注册插槽后挂载，避免异步正文的 hydration 错位。 -->
	<ClientOnly>
		<slot name="comments" />
	</ClientOnly>
</main>
<!-- 与正文同高的容器限制侧栏 sticky 边界，让页脚进入视口时将侧栏向上顶走。 -->
<div class="blog-aside-track">
	<BlogAside>
		<slot name="aside" />
	</BlogAside>
</div>
<BlogFooter />
<BlogPanel :has-aside="mounted && (!!arrival?.visible || !!slots?.aside)" />
<BikariyaModals />
<ClientOnly>
	<PopoverSearchHost />
</ClientOnly>
</template>

<!-- eslint-disable-next-line vue/enforce-style-attribute -->
<style>
#blog-root:has(> #main-content) {
	--aside-width: 280px;
	--sidebar-width: var(--aside-width);

	display: grid;
	grid-template-columns: var(--sidebar-width) minmax(0, 1fr) var(--aside-width);
	align-items: start;
	column-gap: 1rem;
	width: 100%;
	min-width: 0;
	max-width: calc(var(--aside-width) + 1rem + 1080px);
	margin-inline: auto;

	/* Keep responsive overrides from inheriting the aside selector's ID weight. */
	&:where(:not(:has(> .blog-aside-track > #blog-aside:not(.is-empty)))) {
		grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
	}

	@media (max-width: 1080px) {
		--sidebar-width: clamp(240px, 25vw, var(--aside-width));

		grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
	}

	@media (max-width: 768px) {
		grid-template-columns: minmax(0, 1fr);
	}
}

#blog-sidebar, #blog-aside {
	position: sticky;
	top: 0;
	height: 100vh;
	height: 100dvh;
	min-width: 0;
	scrollbar-width: thin;
}

#blog-sidebar {
	grid-area: 1 / 1;
}

#main-content {
	grid-area: 1 / 2;
	/* 保留语义 main 和可见溢出，不影响正文内的 sticky 元素。 */
	min-width: 0;
	/* The live route can finish in the background without repainting the moving header. */
	&[data-article-arriving] > :not(.article-arrival) { display: none !important; }

	:root[data-article-transition] & { view-transition-name: article-body; }

	@media (max-width: 768px) {
		grid-column: 1;
	}
}

.blog-aside-track {
	display: contents;

	@media not (max-width: 1080px) {
		&:has(> #blog-aside:not(.is-empty)) {
			display: block;
			grid-area: 1 / 3;
			align-self: stretch;
			min-width: 0;
		}
	}
}

/* 阅读目录沿用参考站 1024px 断点；其余侧栏继续使用现有布局。 */
@media (min-width: 1025px) and (max-width: 1080px) {
	#blog-root:has(> .blog-aside-track .reading-navigation) {
		grid-template-columns: var(--sidebar-width) minmax(0, 1fr) 200px;
	}

	.blog-aside-track:has(.reading-navigation) {
		display: block;
		grid-area: 1 / 3;
		align-self: stretch;
		min-width: 0;
	}
}

#blog-root > .blog-footer {
	grid-area: 2 / 2 / auto / -1;
	min-width: 0;

	@media (max-width: 768px) {
		grid-column: 1 / -1;
	}
}
</style>
