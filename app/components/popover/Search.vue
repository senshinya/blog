<script setup lang="ts">
import type { SearchResult } from 'minisearch'
import MiniSearch from 'minisearch'
import blogConfig from '~~/blog.config'

const props = defineProps<{ open: boolean }>()

defineEmits<{ close: [], afterLeave: [] }>()

// appConfig 上从来没有 language 字段——之前这里恒为 undefined，Segmenter
// 实际跟的是运行环境（浏览器/Node）的默认 locale，不是站点语言，
// 中文分词因此一直没真正钉死过。这里改用 blogConfig.locales 换算当前语言。
const { locale } = useI18n()
const currentLanguage = computed(() =>
	blogConfig.locales.find(l => l.code === locale.value)?.language ?? blogConfig.language)
// 当前语言或搜索数据变化时重建索引，索引内容与查询使用同一套分词规则。
const segmenter = computed(() => Intl.Segmenter && new Intl.Segmenter(currentLanguage.value, { granularity: 'word' }))

const collection = useContentCollection()

const dataKey = computed(() => `search:${collection.value}`)
// await useAsyncData() 会阻塞渲染
const { data, status } = await useLazyAsyncData(
	dataKey,
	() => queryCollectionSearchSections(collection.value, {
		ignoredTags: ['pre'],
	}),
	{ watch: [collection] },
)

const miniSearch = shallowRef<MiniSearch>()
// 分词和索引分批让出主线程，首开弹窗时仍能绘制输入框和淡入动画。
watch([data, segmenter], async ([sections, wordSegmenter], _previous, onCleanup) => {
	let cancelled = false
	onCleanup(() => cancelled = true)
	miniSearch.value = undefined
	const index = new MiniSearch({
		fields: ['title', 'content'],
		storeFields: ['title', 'titles', 'content', 'level'],
		searchOptions: {
			prefix: true,
			fuzzy: 0.2,
			combineWith: 'AND',
			boost: { title: 3, titles: 2 },
		},
		processTerm: wordSegmenter
			? term => Array.from(wordSegmenter.segment(term), seg => seg.segment.toLowerCase())
			: undefined,
	})
	for (let offset = 0; offset < (sections?.length ?? 0); offset += 4) {
		await new Promise(resolve => setTimeout(resolve, 0))
		if (cancelled)
			return
		index.addAll(sections!.slice(offset, offset + 4))
	}
	if (!cancelled)
		miniSearch.value = index
}, { immediate: true })

const searchStore = useSearchStore()
const searchInput = ref<HTMLInputElement>()

const { word } = storeToRefs(searchStore)
const debouncedWord = refDebounced(word, 100)
const result = computed(() => miniSearch.value?.search(debouncedWord.value) ?? [])
const batchSize = 24
const renderedCount = ref(batchSize)
const renderedResults = computed(() => result.value.slice(0, renderedCount.value))

const isKeyboardMode = ref(false)
const listResult = useTemplateRef('list-result')
const resultContent = useTemplateRef('result-content')
const resultHeight = ref(0)

// 只平滑容器高度；结果节点和键盘选中状态仍即时更新。
useResizeObserver(resultContent, ([entry]) => {
	if (entry)
		resultHeight.value = entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height
	// 很高的视口或较小字号可能装下首批；没有滚动条时仍需继续填充。
	const list = listResult.value
	if (list?.clientHeight && list.scrollHeight <= list.clientHeight)
		loadMoreResults()
})

const activeIndex = ref(0)
const activeItem = () => listResult.value?.children[activeIndex.value] as HTMLAnchorElement | undefined

whenever(() => props.open, () => focusInput())
onMounted(() => {
	if (props.open)
		focusInput()
})

let selectedId: string | undefined
function onResultsUpdated(items: SearchResult[]) {
	const retained = items.findIndex(item => item.id === selectedId)
	activeIndex.value = Math.max(0, retained)
	selectedId = items[activeIndex.value]?.id
	renderedCount.value = Math.max(batchSize, activeIndex.value + 1)
	if (retained < 0 && listResult.value)
		listResult.value.scrollTop = 0
}

watch(result, onResultsUpdated)

useEventListener('mousemove', () => isKeyboardMode.value = false)
useEventListener('keydown', () => isKeyboardMode.value = true)

async function focusInput(allSelect = false) {
	await nextTick()
	searchInput.value?.focus()
	if (allSelect)
		searchInput.value?.select()
}

function loadMoreResults() {
	const list = listResult.value
	if (list && list.scrollHeight - list.scrollTop - list.clientHeight < list.clientHeight)
		renderedCount.value = Math.min(result.value.length, renderedCount.value + batchSize)
}

async function updateActiveIndex(index: number, isKeyboard = false) {
	focusInput()
	if (index < 0 || index >= result.value.length)
		return
	activeIndex.value = index
	selectedId = result.value[index]?.id
	if (index >= renderedCount.value) {
		renderedCount.value = index + batchSize
		await nextTick()
	}
	if (isKeyboard)
		isKeyboardMode.value = true
	if (isKeyboardMode.value)
		activeItem()?.scrollIntoView({ block: 'nearest' })
}

function openActiveItem() {
	// 触发 vue-router 点击事件
	activeItem()?.click()
}
</script>

<template>
<Transition name="search-popover" appear @after-leave="$emit('afterLeave')">
	<div v-if="open" class="blog-search">
		<form class="input" @submit.prevent>
			<Icon v-show="false" name="line-md:loading-alt-loop" />
			<Icon :name="status === 'pending' || !miniSearch ? 'line-md:loading-alt-loop' : 'tabler:search'" />

			<!-- 方向键切换搜索结果不应只在搜索框内触发 -->
			<input
				ref="searchInput"
				v-model="word"
				type="search"
				incremental
				class="search-input"
				:placeholder="$t('search.placeholder')"
				@keydown.up.prevent
				@keydown.down.prevent
			>
		</form>

		<div class="search-results" :style="{ height: `${resultHeight}px` }">
			<div ref="result-content" class="result-content">
				<div v-if="debouncedWord && status === 'success' && miniSearch && !result.length" class="no-result">
					{{ $t('search.noResults') }}
				</div>

				<menu
					v-show="result.length"
					ref="list-result"
					class="scrollcheck-y search-result"
					@scroll.passive="loadMoreResults"
				>
					<PopoverSearchItem
						v-for="(item, itemIndex) in renderedResults"
						:key="item.id"
						:data-result-id="item.id"
						v-bind="item"
						:class="{ active: activeIndex === itemIndex }"
						@mousemove="updateActiveIndex(itemIndex)"
					/>
				</menu>

				<div v-if="result.length" class="tip" @click="searchInput?.focus()">
					<Key code="ArrowUp" prevent @press="updateActiveIndex(activeIndex - 1, true)" />
					<Key code="ArrowDown" prevent @press="updateActiveIndex(activeIndex + 1, true)" />
					{{ $t('search.navigate') }}&emsp;
					<Key code="Enter" icon @press="openActiveItem" />
					{{ $t('search.select') }}&emsp;
					<Key code="Escape" :icon="false" @press="$emit('close')" />
					{{ $t('search.close') }}
				</div>
			</div>
		</div>
	</div>
</Transition>
</template>

<style scoped>
.blog-search {
	--float-distance: 6px;

	contain: paint;
	position: fixed;
	inset: 10dvh 0 auto;
	width: 90%;
	height: fit-content;
	max-width: 768px;
	margin: 0 auto;
	border: 1px solid var(--c-primary);
	border-radius: 1em;
	box-shadow: var(--box-shadow-2), var(--box-shadow-3);
	outline: 0.2em solid var(--c-primary-soft);
	/* 半透明面板 + 背后虚化：页面透出一点，面板才像浮在上面的一层，而不是一个贴图对话框。 */
	/* 不用 --ld-bg-blur：它在浅色下是不透明的，虚化会白做。--c-bg-a80 两套配色都带透明度。 */
	background-color: var(--c-bg-a80);
	backdrop-filter: blur(1rem) saturate(1.5);
}

/* 结果逐条浮入。列表按 item.id 复用 DOM，故连续输入时只有真正新增的条目会播， */
/* 留下的条目原地不动。错峰最多 120ms，避免长列表末尾等得发木。 */
.search-result > :deep(.search-item) {
	animation: search-item-in 0.22s var(--motion-easing) backwards;
	animation-delay: min(calc((sibling-index() - 1) * 0.02s), var(--motion-stagger-limit));
}

/* 不支持 sibling-index() 时整条 animation-delay 失效，退化成无错峰的同步浮入。 */
@keyframes search-item-in {
	from {
		opacity: 0;
		translate: 0 6px;
	}
}

.search-popover-enter-active {
	transition: opacity var(--motion-fade-duration) var(--motion-easing), transform var(--motion-surface-duration) var(--motion-easing);
}

.search-popover-leave-active {
	transition: opacity var(--motion-dismiss-duration) var(--motion-exit-easing), transform var(--motion-dismiss-duration) var(--motion-exit-easing);
}

.search-popover-enter-from,
.search-popover-leave-to {
	opacity: 0;
	transform: translateY(var(--float-distance));
}

@media (prefers-reduced-motion: reduce) {
	.search-popover-enter-active,
	.search-popover-leave-active {
		transition: none;
	}
}

.input {
	display: flex;
	align-items: center;
	gap: 1em;
	position: relative;
	padding: 0 1em;

	> .search-input {
		width: 100%;
		padding: 1em 0;
		outline: none;
	}
}

.search-results {
	overflow: clip;
	transition: height var(--motion-duration) var(--motion-easing);
}

.result-content {
	display: flow-root;
}

.no-result {
	max-height: 5em;
	line-height: 5em;
	text-align: center;
	color: var(--c-text-3);
}

.search-result {
	max-height: calc(80dvh - 6rem);
	scroll-padding: var(--fadeout-height);
}

.tip {
	max-height: 1rem;
	margin: 0 1em 0.5rem;
	font-size: 0.8em;
	text-align: center;
	color: var(--c-text-3);
}
</style>
