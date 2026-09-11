<script setup lang="ts">
import type { Memo } from '~/utils/memo'
import { ENTRANCE_SKIP_KEY } from '~/composables/useEntranceDelay'
import { startMemoAppendMotion } from '~/utils/memoAppendMotion'

interface MemoPage {
	memos: Memo[]
	nextPageToken?: string
}

const API = 'https://memos.shinya.click/api/v1/memos'
const PAGE_SIZE = 20

const appConfig = useAppConfig()
const { t } = useI18n()
const entranceDelay = useEntranceDelay()
const localeSwitch = useState<boolean>(ENTRANCE_SKIP_KEY, () => false)
useSeoMeta({
	title: () => t('page.memos.title'),
	description: () => t('page.memos.description', { site: appConfig.title }),
})

const loadingMore = ref(false)
const revealing = ref(false)
const memoList = useTemplateRef('memoList')
const memoFooter = useTemplateRef('memoFooter')
let cancelReveal = () => {}
let disposed = false
let paginationController: AbortController | undefined
function stopReveal() {
	cancelReveal()
	revealing.value = false
}
onBeforeUnmount(() => {
	disposed = true
	paginationController?.abort()
	stopReveal()
})
useEventListener('resize', stopReveal)
watch(localeSwitch, (switching) => {
	if (switching)
		stopReveal()
})

function fetchPage(pageToken?: string, signal?: AbortSignal) {
	return $fetch<MemoPage>(API, {
		query: { pageSize: PAGE_SIZE, ...(pageToken && { pageToken }) },
		signal,
	})
}

// server: false —— 碎语更新频繁，若在构建时取数会一直停留在上次部署的快照
// 用 lazy 版而非顶层 await：await 会挂起 Suspense，从导航栏点「碎语」要干等一两秒才换页
// 缓存实际列表与游标，语言切换复用请求时仍能还原已加载的所有页。
const { data: cachedFeed } = useNuxtData<MemoPage>('memos')
const { data: feed, status, error } = useLazyAsyncData('memos', () => fetchPage(), {
	server: false,
	// payload 仅保存首次请求结果；useNuxtData 还包含「加载更多」追加的数据。
	getCachedData: (_key, _nuxtApp, { cause }) => cause === 'initial' && localeSwitch.value
		? cachedFeed.value
		: undefined,
})
const memos = computed(() => feed.value?.memos ?? [])
const nextPageToken = computed(() => feed.value?.nextPageToken ?? '')

// server: false 时服务端压根不取数，status 停在 idle 而非 pending。
// 漏掉 idle 会让预渲染的 HTML 直接落到「空列表」分支，白纸黑字写上「共 0 条，没有更多了」
const loading = computed(() => status.value === 'idle' || status.value === 'pending')

async function loadMore() {
	if (disposed || loadingMore.value || revealing.value || !nextPageToken.value)
		return
	loadingMore.value = true
	paginationController = new AbortController()
	try {
		const page = await fetchPage(nextPageToken.value, paginationController.signal)
		// Nuxt's shared feed may now belong to a newly mounted memo page.
		if (disposed)
			return
		const list = memoList.value
		const footer = memoFooter.value
		const before = list && footer
			? { count: list.children.length, height: list.offsetHeight, footerTop: footer.offsetTop }
			: undefined
		revealing.value = true
		feed.value = {
			memos: [...memos.value, ...(page.memos ?? [])],
			nextPageToken: page.nextPageToken ?? '',
		}
		loadingMore.value = false
		await nextTick()
		if (before && list?.isConnected && footer?.isConnected && revealing.value) {
			const motion = startMemoAppendMotion(list, footer, before)
			cancelReveal = motion.cancel
			await motion.finished
		}
		revealing.value = false
	}
	catch (err) {
		if (!disposed)
			throw err
	}
	finally {
		paginationController = undefined
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

<div class="memos proper-height" :data-revealing="revealing || undefined">
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
		<ol ref="memoList" class="memo-list">
			<MemoCard
				v-for="memo, index in parsedMemos"
				:key="memo.id"
				v-bind="memo"
				:viewer-reactions="viewerReactions[`/memos/${memo.id}`]"
				:style="entranceDelay(Math.min(index % PAGE_SIZE, 4) * 0.03)"
			/>
		</ol>

		<div ref="memoFooter" class="memos-footer">
			<button
				v-if="nextPageToken"
				type="button"
				class="memos-load-more"
				:disabled="loadingMore || revealing"
				:aria-busy="loadingMore"
				@click="loadMore"
			>
				<span>{{ loadingMore ? $t('page.memos.loadingMore') : $t('page.memos.loadMore') }}</span>
				<Icon :name="loadingMore ? 'line-md:loading-loop' : 'tabler:chevron-down'" aria-hidden="true" />
			</button>
			<p v-else class="memos-end" role="status">
				{{ $t('page.memos.noMore') }}
			</p>
		</div>
	</template>
</div>
</template>

<style scoped>
.memos {
	padding: 1rem;

	&[data-revealing] {
		overflow-anchor: none;
	}
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
	align-items: center;
	gap: 1rem;
	position: relative;
	margin: 2rem 0;
	background-color: var(--c-bg-1);
	z-index: 1;

	&::before,
	&::after {
		content: "";
		flex: 1;
		height: 1px;
		background-color: var(--c-border);
	}
}

.memos-load-more,
.memos-end {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
	min-height: 44px;
	padding: 0 0.5rem;
	font-size: 0.875rem;
}

.memos-load-more {
	border-radius: 0.5rem;
	background: none;
	color: var(--c-text-2);
	transition: color 0.18s, transform 0.18s;
	cursor: pointer;

	> .iconify {
		transition: transform 0.18s;
	}

	&:disabled {
		cursor: default;
	}

	&:focus-visible {
		outline: 2px solid var(--c-primary);
		outline-offset: 3px;
	}

	&:not(:disabled):active {
		transform: scale(0.98);
	}

	@media (hover: hover) {
		&:not(:disabled):hover {
			color: var(--c-text-1);

			> .iconify {
				transform: translateY(2px);
			}
		}
	}

	@media (prefers-reduced-motion: reduce) {
		&, > .iconify {
			transform: none !important;
			transition: none;
		}
	}
}

.memos-end {
	color: var(--c-text-3);
}

.memos-tip {
	font-size: 0.9em;
	text-align: center;
	color: var(--c-text-3);
}
</style>
