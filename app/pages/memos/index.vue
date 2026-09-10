<script setup lang="ts">
import type { Memo } from '~/utils/memo'

interface MemoPage {
	memos: Memo[]
	nextPageToken?: string
}

const API = 'https://memos.shinya.click/api/v1/memos'
const PAGE_SIZE = 20

const appConfig = useAppConfig()
const { t } = useI18n()
const entranceDelay = useEntranceDelay()
useSeoMeta({
	title: () => t('page.memos.title'),
	description: () => t('page.memos.description', { site: appConfig.title }),
})

const memos = ref<Memo[]>([])
const nextPageToken = ref('')
const loadingMore = ref(false)

function fetchPage(pageToken?: string) {
	return $fetch<MemoPage>(API, {
		query: { pageSize: PAGE_SIZE, ...(pageToken && { pageToken }) },
	})
}

// server: false —— 碎语更新频繁，若在构建时取数会一直停留在上次部署的快照
// 用 lazy 版而非顶层 await：await 会挂起 Suspense，从导航栏点「碎语」要干等一两秒才换页
const { status, error } = useLazyAsyncData('memos', async () => {
	const page = await fetchPage()
	memos.value = page.memos ?? []
	nextPageToken.value = page.nextPageToken ?? ''
	return true
}, { server: false })

// server: false 时服务端压根不取数，status 停在 idle 而非 pending。
// 漏掉 idle 会让预渲染的 HTML 直接落到「空列表」分支，白纸黑字写上「共 0 条，没有更多了」
const loading = computed(() => status.value === 'idle' || status.value === 'pending')

async function loadMore() {
	if (loadingMore.value || !nextPageToken.value)
		return
	loadingMore.value = true
	try {
		const page = await fetchPage(nextPageToken.value)
		memos.value.push(...(page.memos ?? []))
		nextPageToken.value = page.nextPageToken ?? ''
	}
	finally {
		loadingMore.value = false
	}
}

const parsedMemos = computed(() => memos.value.map(parseMemo))
const pageKeys = computed(() => parsedMemos.value.map(memo => `/memos/${memo.id}`))
const viewerReactions = usePageViewerReactions(pageKeys)
</script>

<template>
<template #aside>
	<!-- TransitionGroup 必须在此层：dxup 把布局里的 <slot name="aside"> 编译成 LayoutSlot 组件，
		放在 BlogAside 里只会看到那一个组件 vnode，看不见 widget 的增删 -->
	<TransitionGroup name="aside-widget">
		<WidgetBlogStats key="blog-stats" />
		<WidgetBlogTech key="blog-tech" />
	</TransitionGroup>
</template>

<div class="memos proper-height">
	<header class="memos-header">
		<h1 class="text-creative">
			{{ $t('page.memos.title') }}
		</h1>
		<i18n-t keypath="page.memos.syncNotice" tag="p" class="memos-desc">
			<template #link>
				<UtilLink to="https://memos.shinya.click">
					Memos
				</UtilLink>
			</template>
		</i18n-t>
	</header>

	<ZError v-if="error" :message="$t('page.memos.loadError', { message: error.message })" />

	<p v-else-if="loading" class="memos-tip">
		{{ $t('page.memos.loading') }}
	</p>

	<template v-else>
		<ol class="memo-list">
			<MemoCard
				v-for="memo, index in parsedMemos"
				:key="memo.id"
				v-bind="memo"
				:viewer-reactions="viewerReactions[`/memos/${memo.id}`]"
				:style="entranceDelay(index * 0.05)"
			/>
		</ol>

		<div class="memos-footer">
			<ZButton
				v-if="nextPageToken"
				:icon="loadingMore ? 'line-md:loading-loop' : 'tabler:chevron-down'"
				:text="loadingMore ? $t('page.memos.loadingMore') : $t('page.memos.loadMore')"
				@click="loadMore"
			/>
			<p v-else class="memos-tip">
				{{ $t('page.memos.count', { n: memos.length }) }}
			</p>
		</div>
	</template>
</div>
</template>

<style lang="scss" scoped>
.memos {
	padding: 1rem;
}

.memos-header {
	margin-bottom: 2rem;

	> h1 {
		font-size: 1.5rem;
	}

	> .memos-desc {
		margin-top: 0.3em;
		font-size: 0.9em;
		color: var(--c-text-3);
	}
}

.memos-footer {
	display: flex;
	justify-content: center;
	margin: 2rem 0;
}

.memos-tip {
	font-size: 0.9em;
	text-align: center;
	color: var(--c-text-3);
}
</style>
