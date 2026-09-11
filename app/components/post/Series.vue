<script setup lang="ts">
import { articleSeries } from '~/utils/articleSeries'
import { resolveContentPath } from '~/utils/locale'

const props = defineProps<{ path: string }>()
const { locale } = useI18n()
const route = useRoute()
const collection = useContentCollection()
const series = computed(() => articleSeries.find(item => item.paths.includes(props.path)))
const { data: entries } = await useAsyncData(`series:${collection.value}`, () => queryArticleIndex(collection.value), { default: () => [] })
const copy = computed(() => ({
	zh: { series: '系列', previous: '上一篇', next: '下一篇', current: '本文', mydb: 'MYDB · 手写数据库' },
	en: { series: 'Series', previous: 'Previous', next: 'Next', current: 'Current', mydb: 'MYDB · Building a database' },
	ja: { series: 'シリーズ', previous: '前の記事', next: '次の記事', current: 'この記事', mydb: 'MYDB · データベースを作る' },
})[locale.value]!)
const title = computed(() => series.value?.id === 'mydb' ? copy.value.mydb : series.value?.title[locale.value])
const chapters = computed(() => series.value?.paths.flatMap((path) => {
	const entry = entries.value.find(item => item.path === path)
	return entry ? [{ path, title: entry.title, label: entry.title.replace(/^MYDB\s+\d+[.．:：]\s*/i, '') }] : []
}) ?? [])
const current = computed(() => chapters.value.findIndex(entry => entry.path === props.path))
const previous = computed(() => chapters.value[current.value - 1])
const next = computed(() => chapters.value[current.value + 1])
const anchor = computed(() => `series-${series.value?.id}`)
const panelId = useId()
// Locale pages remount; retain the current article's state, not older visits.
const disclosure = useState<{ path?: string, expanded: boolean }>('series-disclosure', () => ({ expanded: false }))
const sameArticle = disclosure.value.path === props.path
const initiallyExpanded = sameArticle && disclosure.value.expanded
const expanded = ref(initiallyExpanded)
const mounted = useMounted()
const reducedMotion = usePreferredReducedMotion()
const details = useTemplateRef<HTMLDetailsElement>('details')
const summary = useTemplateRef<HTMLElement>('summary')
const panel = useTemplateRef<HTMLElement>('panel')
let animation: Animation | undefined

function setExpanded(open: boolean) {
	const element = details.value
	if (!element || !summary.value || !panel.value)
		return

	const start = element.getBoundingClientRect().height
	// Capture the displayed height before cancelling so a rapid reversal never jumps.
	element.style.height = `${start}px`
	animation?.cancel()
	expanded.value = open
	element.open = true
	const end = summary.value.getBoundingClientRect().height + (open ? panel.value.getBoundingClientRect().height : 0)

	function finish() {
		element!.open = open
		element!.style.removeProperty('height')
		element!.style.removeProperty('overflow')
		animation = undefined
	}

	if (reducedMotion.value === 'reduce') {
		finish()
		return
	}

	element.style.overflow = 'hidden'
	animation = element.animate([{ height: `${start}px` }, { height: `${end}px` }], {
		duration: 280,
		easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
	})
	animation.onfinish = finish
}

function revealAnchor() {
	if (route.hash === `#${anchor.value}`)
		setExpanded(true)
}

onMounted(() => {
	expanded.value = details.value?.open ?? false
	if (!sameArticle)
		revealAnchor()
	disclosure.value = { path: props.path, expanded: expanded.value }
})
watch(expanded, value => disclosure.value = { path: props.path, expanded: value }, { flush: 'sync' })
watch(() => route.hash, revealAnchor)
onBeforeUnmount(() => animation?.cancel())
</script>

<template>
<nav v-if="series" :id="anchor" class="post-series" :aria-label="series.title[locale]">
	<details ref="details" class="series-details" :open="initiallyExpanded" :data-expanded="expanded">
		<summary
			ref="summary"
			class="series-summary"
			:aria-expanded="mounted ? expanded : undefined"
			:aria-controls="panelId"
			@click.prevent="setExpanded(!expanded)"
		>
			<span class="series-label">{{ copy.series }}</span>
			<span class="series-title">{{ title }}</span>
			<span class="series-position">{{ current + 1 }} / {{ chapters.length }}</span>
			<Icon class="series-chevron" name="tabler:chevron-down" />
		</summary>
		<div :id="panelId" ref="panel" class="series-panel" :inert="mounted && !expanded">
			<ol class="series-chapters">
				<li v-for="chapter, index in chapters" :key="chapter.path">
					<NuxtLink :to="resolveContentPath(chapter.path, locale)" :aria-label="chapter.title" :aria-current="chapter.path === path ? 'page' : undefined">
						<span class="chapter-number" aria-hidden="true">{{ String(series.id === 'mydb' ? index : index + 1).padStart(2, '0') }}</span>
						<span class="chapter-title">{{ chapter.label }}</span>
						<span v-if="chapter.path === path" class="chapter-current">{{ copy.current }}</span>
					</NuxtLink>
				</li>
			</ol>
		</div>
	</details>
	<div v-if="previous || next" class="series-neighbors">
		<NuxtLink v-if="previous" class="series-previous" :to="resolveContentPath(previous.path, locale)" :aria-label="`${copy.previous}: ${previous.title}`">
			<span class="neighbor-label">← {{ copy.previous }}</span>
			<span class="neighbor-title">{{ previous.label }}</span>
		</NuxtLink>
		<NuxtLink v-if="next" class="series-next" :to="resolveContentPath(next.path, locale)" :aria-label="`${copy.next}: ${next.title}`">
			<span class="neighbor-label">{{ copy.next }} →</span>
			<span class="neighbor-title">{{ next.label }}</span>
		</NuxtLink>
	</div>
</nav>
</template>

<style scoped>
.post-series {
	margin: 2.5rem 1rem 2rem;
	border-top: 1px solid var(--c-border);
	font-family: var(--font-basic);
	font-size: 0.875rem;
	line-height: 1.65;
	color: var(--c-text-1);
	scroll-margin-top: 1rem;
}

.series-summary {
	display: flex;
	align-items: center;
	gap: 0.65rem;
	min-height: 3.5rem;
	padding: 0.85rem 0;
	list-style: none;
	cursor: pointer;

	&::-webkit-details-marker { display: none; }
}

.series-label,
.series-position,
.series-chevron {
	flex-shrink: 0;
	font-size: 0.75rem;
	color: var(--c-text-2);
}

.series-title {
	min-width: 0;
	font-weight: 500;
	text-wrap: pretty;
}

.series-position {
	margin-inline-start: auto;
	white-space: nowrap;
	font-variant-numeric: tabular-nums;
}

.series-chevron {
	transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);

	[data-expanded="true"] & { transform: rotate(180deg); }
}

.series-panel { padding-bottom: 1rem; }

.series-chapters {
	margin: 0;
	padding: 0.2rem 0 0.5rem;
	list-style: none;

	a {
		display: flex;
		align-items: baseline;
		gap: 0.8rem;
		padding: 0.45rem 0;
		color: var(--c-text-2);
		transition: color 160ms;

		&[aria-current="page"] { color: var(--c-primary); }
	}
}

.chapter-number {
	flex: 0 0 1.4rem;
	font-size: 0.75rem;
	font-variant-numeric: tabular-nums;
}

.chapter-title { min-width: 0; }

.chapter-current {
	flex-shrink: 0;
	margin-inline-start: auto;
	font-size: 0.7rem;
}

.series-neighbors {
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
	gap: clamp(1rem, 4vw, 3rem);
	padding-top: 0.35rem;

	a {
		min-width: 0;
		padding: 0.35rem 0;
		transition: color 160ms;
	}
}

.series-next {
	grid-column: 2;
	text-align: end;
}

.neighbor-label {
	display: block;
	margin-bottom: 0.3rem;
	font-size: 0.75rem;
	color: var(--c-text-2);
}

.neighbor-title {
	display: block;
	text-wrap: pretty;
}

@media (hover: hover) {
	.series-chapters a:hover,
	.series-neighbors a:hover { color: var(--c-primary); }
}

@media (pointer: coarse) {
	.series-chapters a { min-height: 44px; }
}

@media (prefers-reduced-motion: reduce) {
	.series-chevron,
	.series-chapters a,
	.series-neighbors a { transition: none; }
}
</style>
