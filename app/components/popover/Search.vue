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

const miniSearch = computed(() => {
	const wordSegmenter = segmenter.value
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
	index.addAll(data.value ?? [])
	return index
})

const searchStore = useSearchStore()
const searchInput = ref<HTMLInputElement>()

const { word } = storeToRefs(searchStore)
const debouncedWord = refDebounced(word, 100)
const result = computed(() => miniSearch.value.search(debouncedWord.value))

const isKeyboardMode = ref(false)
const listResult = useTemplateRef('list-result')
const resultContent = useTemplateRef('result-content')
const resultHeight = ref(0)

// 只平滑容器高度；结果节点和键盘选中状态仍即时更新。
useResizeObserver(resultContent, ([entry]) => {
	if (entry)
		resultHeight.value = entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height
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
	if (retained < 0 && listResult.value)
		listResult.value.scrollTop = 0
}

watch(result, onResultsUpdated, { flush: 'post' })

useEventListener('mousemove', () => isKeyboardMode.value = false)
useEventListener('keydown', () => isKeyboardMode.value = true)

async function focusInput(allSelect = false) {
	await nextTick()
	searchInput.value?.focus()
	if (allSelect)
		searchInput.value?.select()
}

function updateActiveIndex(index: number, isKeyboard = false) {
	focusInput()
	if (index < 0 || index >= (listResult.value?.children.length ?? 0))
		return
	activeIndex.value = index
	selectedId = activeItem()?.dataset.resultId
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
			<Icon :name="status === 'pending' ? 'line-md:loading-alt-loop' : 'tabler:search'" />

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
				<div v-if="debouncedWord && status === 'success' && !result.length" class="no-result">
					{{ $t('search.noResults') }}
				</div>

				<menu
					v-show="result.length"
					ref="list-result"
					class="scrollcheck-y search-result"
				>
					<PopoverSearchItem
						v-for="(item, itemIndex) in result"
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
	--float-distance: 10px;

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
	background-color: var(--ld-bg-card);
}

.search-popover-enter-active,
.search-popover-leave-active {
	transition: opacity 0.2s ease-out, transform 0.2s ease-out;
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
