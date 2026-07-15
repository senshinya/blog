<script setup lang="ts">
import type { BgmCollection, BgmCollectionPage, BgmStatusKey } from '~/utils/bangumi'
import { BGM_CATEGORIES, BGM_STATUS_KEYS, BGM_STATUS_TYPES, withBgmProxy } from '~/utils/bangumi'

const PAGE_SIZE = 20
const BGM_API = 'https://api.bgm.tv/v0/users'

const appConfig = useAppConfig()
useSeoMeta({
	title: '娱乐',
	description: `${appConfig.title}追过的番剧、看过的影视、玩过的游戏，同步自 Bangumi。`,
})

const route = useRoute()
const router = useRouter()

const DEFAULT_CATEGORY = BGM_CATEGORIES[0]!.key
const DEFAULT_STATUS: BgmStatusKey = BGM_STATUS_KEYS[0]

// 筛选状态以 URL query 为准（?category=&status=）：读 query 决定当前视图，点击时写回。
// 深链、浏览器前进/后退因此天然可用；非法值回落默认，默认值省略以保持裸 /media 干净
const categoryKey = computed(() => {
	const raw = route.query.category
	const key = (Array.isArray(raw) ? raw[0] : raw) || ''
	return BGM_CATEGORIES.some(c => c.key === key) ? key : DEFAULT_CATEGORY
})
const statusKey = computed<BgmStatusKey>(() => {
	const raw = route.query.status
	const key = (Array.isArray(raw) ? raw[0] : raw) || ''
	return (BGM_STATUS_KEYS as readonly string[]).includes(key) ? key as BgmStatusKey : DEFAULT_STATUS
})
const category = computed(() => BGM_CATEGORIES.find(c => c.key === categoryKey.value)!)
const statusType = computed(() => BGM_STATUS_TYPES[BGM_STATUS_KEYS.indexOf(statusKey.value)]!)

// 只把非默认值写进 query，默认组合对应裸 /media；push 让每个组合成为可后退的历史条目
function applyFilter(cat: string, stat: BgmStatusKey) {
	const query: Record<string, string> = {}
	if (cat !== DEFAULT_CATEGORY)
		query.category = cat
	if (stat !== DEFAULT_STATUS)
		query.status = stat
	router.push({ query })
}

const items = ref<BgmCollection[]>([])
const total = ref(0)
const loading = ref(true) // 首屏取数走客户端（server: false 语义），预渲染时先显示加载态
const loadingMore = ref(false)
const error = ref<Error>()

function fetchPage(offset: number) {
	// 手动拼 query 而非用 $fetch 的 query 选项：反代前缀里嵌了完整的 https://，
	// 交给 ofetch/ufo 处理有可能被规范化，这里整条 URL 原样传入最稳
	const query = new URLSearchParams({
		subject_type: String(category.value.subjectType),
		type: String(statusType.value),
		limit: String(PAGE_SIZE),
		offset: String(offset),
	})
	const url = `${BGM_API}/${appConfig.bangumi.uid}/collections?${query}`
	return $fetch<BgmCollectionPage>(withBgmProxy(appConfig.bangumi.apiProxy, url))
}

// 切换分类/状态会连发请求，用递增的 token 丢弃迟到的旧响应，避免顺序错乱覆盖列表
let reqId = 0

async function reload() {
	const id = ++reqId
	loading.value = true
	error.value = undefined
	items.value = []
	total.value = 0
	try {
		const page = await fetchPage(0)
		if (id !== reqId)
			return
		items.value = page.data ?? []
		total.value = page.total ?? 0
	}
	catch (e) {
		if (id === reqId)
			error.value = e as Error
	}
	finally {
		if (id === reqId)
			loading.value = false
	}
}

async function loadMore() {
	if (loadingMore.value || items.value.length >= total.value)
		return
	const id = reqId
	loadingMore.value = true
	error.value = undefined
	try {
		const page = await fetchPage(items.value.length)
		if (id !== reqId)
			return
		items.value.push(...(page.data ?? []))
		total.value = page.total ?? total.value
	}
	catch (e) {
		if (id === reqId)
			error.value = e as Error
	}
	finally {
		if (id === reqId)
			loadingMore.value = false
	}
}

// 硬开深链(/media?category=game&status=collect)时，客户端 router 会晚一拍才把 query 解析到位。
// 若在 onMounted 直接取数，会先按默认(番剧·在看)打一枪、query 落定后再打第二枪。
// 故等 router.isReady() 后再首取，并用 ready 挡掉 query 落定过程中的那次 watch 触发。
const ready = ref(false)

onMounted(async () => {
	await router.isReady()
	ready.value = true
	reload()
})

watch([categoryKey, statusKey], () => {
	if (ready.value)
		reload()
})
</script>

<template>
<template #aside>
	<TransitionGroup name="aside-widget">
		<WidgetBlogStats key="blog-stats" />
		<WidgetMemos key="memos" />
		<WidgetBlogTech key="blog-tech" />
	</TransitionGroup>
</template>

<div class="media proper-height">
	<header class="media-header">
		<h1 class="text-creative">
			娱乐
		</h1>
		<p class="media-desc">
			追过的番剧、看过的影视、玩过的游戏，同步自
			<UtilLink to="https://bgm.tv">
				Bangumi
			</UtilLink>
		</p>
	</header>

	<div class="media-filter">
		<div class="filter-cats">
			<button
				v-for="c in BGM_CATEGORIES"
				:key="c.key"
				type="button"
				class="filter-cat"
				:class="{ active: c.key === categoryKey }"
				:aria-pressed="c.key === categoryKey"
				@click="applyFilter(c.key, statusKey)"
			>
				<Icon :name="c.icon" />{{ c.label }}
			</button>

			<span v-if="!loading && !error && total" class="filter-count">
				共 {{ total }} {{ category.unit }}
			</span>
		</div>

		<div class="filter-status">
			<button
				v-for="label, i in category.statusLabels"
				:key="i"
				type="button"
				class="filter-status-tab"
				:class="{ active: BGM_STATUS_KEYS[i] === statusKey }"
				:aria-pressed="BGM_STATUS_KEYS[i] === statusKey"
				@click="applyFilter(categoryKey, BGM_STATUS_KEYS[i]!)"
			>
				{{ label }}
			</button>
		</div>
	</div>

	<!-- 整页报错只在「一条都没加载出来」时顶替内容；「加载更多」失败不清空已有列表 -->
	<ZError v-if="error && !items.length" :message="`加载失败：${error.message}`" />

	<p v-else-if="loading" class="media-tip">
		加载中...
	</p>

	<p v-else-if="!items.length" class="media-tip">
		这个分类还没有收藏
	</p>

	<template v-else>
		<TransitionGroup tag="ol" class="media-grid" name="float-in">
			<li
				v-for="item, index in items"
				:key="item.subject_id"
				:style="getFixedDelay(index % PAGE_SIZE * 0.03)"
			>
				<MediaCard :item />
			</li>
		</TransitionGroup>

		<div class="media-footer">
			<ZButton
				v-if="items.length < total"
				:icon="loadingMore ? 'line-md:loading-loop' : 'tabler:chevron-down'"
				:text="loadingMore ? '加载中' : '加载更多'"
				@click="loadMore"
			/>
			<p v-else class="media-tip">
				共 {{ total }} 条，没有更多了
			</p>
		</div>
	</template>
</div>
</template>

<style lang="scss" scoped>
.media {
	padding: 1rem;
}

.media-header {
	margin-bottom: 1rem;

	> h1 {
		font-size: 1.5rem;
	}

	> .media-desc {
		margin-top: 0.3em;
		font-size: 0.9em;
		color: var(--c-text-3);
	}
}

// 筛选器：分类=带图标的胶囊标签（主），状态=下划线文字标签（次），计数锚在右侧
.media-filter {
	margin: 1.25rem 0 0.5rem;
}

.filter-cats {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0.5rem;
}

.filter-cat {
	display: inline-flex;
	align-items: center;
	gap: 0.35em;
	padding: 0.34em 0.9em;
	border: 1px solid var(--c-border);
	border-radius: 2em;
	background-color: var(--c-bg-2);
	font-size: 0.9em;
	color: var(--c-text-2);
	transition: all 0.2s;
	cursor: pointer;

	&:hover {
		border-color: var(--c-primary);
		color: var(--c-primary);
	}

	&.active {
		border-color: var(--c-primary);
		background-color: var(--c-primary-soft);
		font-weight: 550;
		color: var(--c-primary);
	}
}

.filter-count {
	margin-inline-start: auto;
	font-size: 0.8em;
	color: var(--c-text-3);
	font-variant-numeric: tabular-nums;
}

.filter-status {
	display: flex;
	flex-wrap: wrap;
	gap: 1.25em;
	margin-top: 0.9rem;
}

.filter-status-tab {
	position: relative;
	padding: 0.1em 0;
	background: none;
	font-size: 0.85em;
	color: var(--c-text-3);
	transition: color 0.2s;
	cursor: pointer;

	&:hover {
		color: var(--c-text-1);
	}

	&.active {
		font-weight: 550;
		color: var(--c-primary);
	}

	// 激活项底部 2px 下划线，切换时淡入淡出
	&::after {
		content: "";
		position: absolute;
		opacity: 0;
		inset-inline: 0;
		bottom: -4px;
		height: 2px;
		border-radius: 2px;
		background-color: var(--c-primary);
		transition: opacity 0.2s;
	}

	&.active::after {
		opacity: 1;
	}
}

.media-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(min(100%, 350px), 1fr));
	gap: 1rem;
	margin-top: 1.5rem;
	list-style: none;
}

.media-footer {
	display: flex;
	justify-content: center;
	margin: 2rem 0;
}

.media-tip {
	margin-top: 1.5rem;
	font-size: 0.9em;
	text-align: center;
	color: var(--c-text-3);
}
</style>
