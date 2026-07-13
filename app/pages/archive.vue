<script setup lang="ts">
import type { ArticleProps } from '~/types/article'
import { groupBy } from 'es-toolkit/array'
import { sumBy } from 'es-toolkit/math'
import { mapValues } from 'es-toolkit/object'

const appConfig = useAppConfig()
useSeoMeta({
	title: '归档',
	description: `${appConfig.title}的所有文章归档。`,
})
const birthYear = computed(() => appConfig.component.stats.birthYear)
const showTuning = ref(false)
const spacing = ref(0)
const column = ref(1)

const tuningRef = useTemplateRef('tuning-panel')
useAvoidTarget(tuningRef, showTuning)

const { data: listRaw } = await useAsyncData('posts:index', () => getArticleIndexOptions(), { default: () => [] })
const { listSorted } = useArticleSort(listRaw)
const { category, categories, listCategorized } = useCategory(listSorted)

const listGrouped = computed(() => {
	// reverse 不是可有可无的：groupBy 的键是 "2021" 这类类整数字符串，JS 会把它们当作数组索引，
	// Object.entries 一律按数值升序吐出，与 listSorted 的倒序无关。故这里必须再翻一次，
	// 年份才是新到旧。与去掉排序开关之前的默认行为（allowAscending: false）一致
	const groupList = Object.entries(groupBy(listCategorized.value, getArticleYear))
	return groupList.reverse()
})

// 不能使用 /api/stats，因为可能切换分组方式
const yearlyWordCount = computed(() =>
	mapValues(Object.fromEntries(listGrouped.value), (articles) => {
		const total = sumBy(articles, a => a.readingTime?.words ?? 0)
		return formatNumber(total)
	}),
)

function getArticleYear(article: ArticleProps) {
	try {
		return toZonedTemporal(article.date as string).year.toString()
	}
	catch {
		return ''
	}
}
</script>

<template>
<template #aside>
	<!-- TransitionGroup 必须在此层：dxup 把布局里的 <slot name="aside"> 编译成 LayoutSlot 组件，
		放在 BlogAside 里只会看到那一个组件 vnode，看不见 widget 的增删 -->
	<TransitionGroup name="aside-widget">
		<WidgetBlogStats key="blog-stats" />
		<WidgetBlogLog key="blog-log" />
		<WidgetBlogTech key="blog-tech" />
	</TransitionGroup>
</template>

<div class="archive proper-height">
	<PostFilter
		v-model:category="category"
		:categories
	>
		<ZSecret>
			<ZToggle
				v-model="showTuning"
				label="密度调节"
			/>
		</ZSecret>
	</PostFilter>

	<section
		v-for="[year, yearGroup] in listGrouped"
		:key="year"
		class="archive-group"
		:class="{ 'hide-info': column > 1 }"
		:style="{
			'--archive-item-gap': `${spacing}em`,
			'--archive-item-column': column,
		}"
	>
		<div class="archive-title">
			<h2 class="archive-year">
				{{ year }}
			</h2>

			<div class="archive-age">
				<span>{{ Number(year) - birthYear }}</span>
				<span class="age-label">岁</span>
			</div>

			<div class="archive-info">
				<span>{{ yearlyWordCount[year] }}字</span>
				<span>{{ yearGroup?.length }}篇</span>
			</div>
		</div>

		<TransitionGroup tag="menu" class="archive-list" name="float-in">
			<PostArchive
				v-for="article, index in yearGroup"
				:key="article.path"
				v-bind="article"
				:to="article.path"
				:show-category="column < 3"
				:style="getFixedDelay(index * 0.03)"
			/>
		</TransitionGroup>
	</section>

	<div v-if="showTuning" ref="tuning-panel" class="archive-tuning card">
		<ZSlider
			v-model="spacing"
			label="间距"
			:spring-min="-0.4"
			:spring-max="0.1"
			:list="['-0.3', '0']"
			min="-1"
			max=".2"
			step=".1"
		/>

		<ZSlider
			v-model="column"
			label="列数"
			min="1"
			max="8"
		/>
	</div>
</div>
</template>

<style lang="scss" scoped>
.archive {
	padding: 1rem; // 防止内部 outline 被 mask
	mask-image: linear-gradient(#FFF 50%, #FFF7);
}

.archive-group {
	margin: 1rem 0 3rem;

	> .archive-list {
		display: grid;
		grid-template-columns: repeat(var(--archive-item-column), 1fr);
		column-gap: calc((5 - var(--archive-item-column)) * 0.2em);
	}

	&.hide-info :deep(.dim-hover) {
		display: none;
	}
}

.archive-tuning {
	position: sticky;
	bottom: min(2em, 5%);

	> .z-slider {
		margin: 0.5em 0.8em;
	}
}

.archive-title {
	display: flex;
	justify-content: space-between;
	gap: 1em;
	position: sticky;
	opacity: 0.5;
	top: 0;
	font-size: min(1.5em, 5vw);
	color: transparent;
	transition: color 0.2s;

	&::selection, :hover > & {
		color: var(--c-text-3);
	}

	:hover > & .archive-age {
		opacity: 0;
	}

	> .archive-year, .archive-age {
		margin-bottom: -0.3em;
		mask-image: linear-gradient(#FFF 50%, transparent);
		font-family: var(--font-stroke-free);
		font-size: 3em;
		font-variant-numeric: tabular-nums;
		font-weight: 800;
		line-height: 1;
		z-index: -1;
		-webkit-text-stroke: 1px var(--c-text-3);
	}

	> .archive-age {
		position: absolute;
		inset-inline-end: 0;
		transition: opacity 0.2s;

		> .age-label {
			font-size: 0.5em;
			vertical-align: super;
		}
	}

	> .archive-info {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		column-gap: 0.5em;
	}
}
</style>
