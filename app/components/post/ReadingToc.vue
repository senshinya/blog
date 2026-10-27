<script setup lang="ts">
import type { ReadingHeading } from '~/utils/readingProgress'

const props = defineProps<{
	headings: ReadingHeading[]
	activeId: string
	visibleRoots: string[]
	visibleIds: string[]
	collapsed?: boolean
	mobile?: boolean
}>()
const emit = defineEmits<{
	navigate: [event: MouseEvent, id: string]
	marker: [bounds: { left: number, top: number, height: number }]
}>()
const list = useTemplateRef<HTMLElement>('list')
const reduced = usePreferredReducedMotion()
const rootDepth = computed(() => Math.min(...props.headings.map(heading => heading.depth), 6))
const groups = computed(() => props.headings.filter(heading => heading.rootId === heading.id).map(root => ({
	root,
	children: props.headings.filter(heading => heading.rootId === root.id && heading.id !== root.id),
})))
const activeIndex = computed(() => props.headings.findIndex(heading => heading.id === props.activeId))
const marker = ref({ top: 0, height: 0 })

function publishMarker() {
	const element = list.value
	if (!element || props.mobile)
		return
	const top = Math.max(0, marker.value.top - element.scrollTop)
	const bottom = Math.min(element.clientHeight, marker.value.top + marker.value.height - element.scrollTop)
	const bounds = element.getBoundingClientRect()
	const origin = element.closest('.reading-navigation-inner')?.getBoundingClientRect() ?? bounds
	emit('marker', { left: bounds.left - origin.left + 8, top: bounds.top - origin.top + top, height: Math.max(0, bottom - top) })
}

function itemStyle(heading: ReadingHeading) {
	const index = props.headings.findIndex(item => item.id === heading.id)
	return {
		'--toc-indent': `${14 + Math.max(0, heading.depth - rootDepth.value) * 8.4}px`,
		'--toc-delay': `min(var(--reading-item-delay-limit), calc(${Math.abs(index - Math.max(0, activeIndex.value))} * var(--reading-item-step)))`,
	}
}

function measureMarker() {
	const element = list.value
	if (!element)
		return
	const visible = [...element.querySelectorAll<HTMLElement>('a[data-heading]')].filter(link => props.visibleIds.includes(link.dataset.heading!))
	const first = visible[0]
	const last = visible.at(-1)
	if (!first || !last) {
		marker.value = { top: marker.value.top, height: 0 }
		publishMarker()
		return
	}
	const firstBounds = first.getBoundingClientRect()
	marker.value = { top: firstBounds.top - element.getBoundingClientRect().top + element.scrollTop, height: last.getBoundingClientRect().bottom - firstBounds.top }
	publishMarker()
}

watch(() => [props.activeId, props.headings, props.collapsed, props.visibleIds], async () => {
	await nextTick()
	measureMarker()
	if (!props.collapsed && list.value) {
		const element = list.value
		if (marker.value.top < element.scrollTop || marker.value.top + marker.value.height > element.scrollTop + element.clientHeight)
			element.scrollTo({ top: Math.max(0, marker.value.top - element.clientHeight / 4), behavior: reduced.value === 'reduce' ? 'instant' : 'smooth' })
	}
}, { flush: 'post' })
useResizeObserver(list, measureMarker)
useEventListener('resize', publishMarker)
onMounted(measureMarker)
</script>

<template>
<nav ref="list" class="reading-toc" :class="{ 'is-collapsed': collapsed, 'is-mobile': mobile }" :aria-label="$t('widget.toc.title')" :inert="collapsed || undefined" @scroll="publishMarker">
	<ol v-if="headings.length">
		<template v-if="mobile">
			<li v-for="heading in headings" :key="heading.id" class="toc-item" :style="itemStyle(heading)">
				<a :href="`#${encodeURIComponent(heading.id)}`" :title="heading.text" :data-heading="heading.id" :aria-current="heading.id === activeId ? 'location' : undefined" :class="{ 'is-visible': visibleIds.includes(heading.id) }" @click="emit('navigate', $event, heading.id)">{{ heading.text }}</a>
			</li>
		</template>
		<template v-for="group in mobile ? [] : groups" :key="group.root.id">
			<li class="toc-item" :style="itemStyle(group.root)">
				<a :href="`#${encodeURIComponent(group.root.id)}`" :title="group.root.text" :data-heading="group.root.id" :aria-current="group.root.id === activeId ? 'location' : undefined" :class="{ 'is-visible': visibleIds.includes(group.root.id) }" @click="emit('navigate', $event, group.root.id)">{{ group.root.text }}</a>
			</li>
			<li v-if="group.children.length" class="toc-children" :class="{ expanded: visibleRoots.includes(group.root.id) }" :inert="!visibleRoots.includes(group.root.id) || undefined">
				<ol>
					<li v-for="heading in group.children" :key="heading.id" class="toc-item" :style="itemStyle(heading)">
						<a :href="`#${encodeURIComponent(heading.id)}`" :title="heading.text" :data-heading="heading.id" :aria-current="heading.id === activeId ? 'location' : undefined" :class="{ 'is-visible': visibleIds.includes(heading.id) }" @click="emit('navigate', $event, heading.id)">{{ heading.text }}</a>
					</li>
				</ol>
			</li>
		</template>
	</ol>
	<p v-else class="toc-empty">
		{{ $t('widget.toc.empty') }}
	</p>
</nav>
</template>

<style scoped>
.reading-toc {
	position: relative;
	overflow: auto;
	max-height: 75vh;
	padding: 0 7px;
	font-size: 14px;
	line-height: 21px;
	overscroll-behavior: contain;
	scrollbar-width: none;

	&::-webkit-scrollbar { display: none; }

	ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		margin: 0;
		padding: 0;
	}

	a {
		display: inline-block;
		overflow: hidden;
		opacity: 0.35;
		max-width: 100%;
		margin-bottom: 1.5px;
		padding-inline-start: var(--toc-indent);
		font-size: inherit;
		font-weight: 400;
		line-height: 21px;
		white-space: nowrap;
		text-decoration: none;
		text-overflow: ellipsis;
		color: var(--reading-ink);
		transition: opacity 300ms ease-in-out, color 300ms ease-in-out;

		&.is-visible { opacity: 0.7; }
		&:hover { opacity: 0.8; }
		&[aria-current] {
			opacity: 1;
			font-weight: 500;
			color: var(--reading-accent);
		}
	}

	&.is-collapsed .toc-item {
		opacity: 0;
		transform: translateX(-8.75px);
		transition-delay: var(--toc-delay);
	}
	&.is-collapsed { pointer-events: none; }

	&.is-mobile {
		max-height: none;
	}
}

.toc-item {
	line-height: 14px;
	transition: opacity var(--reading-item-duration) var(--reading-curve), transform var(--reading-item-duration) var(--reading-curve);
}

.toc-children {
	display: grid;
	grid-template-rows: 0fr;
	transition: grid-template-rows 400ms var(--reading-curve);

	&.expanded { grid-template-rows: 1fr; }
	> ol {
		overflow: hidden;
		min-height: 0;
	}
}

.toc-empty {
	padding: 0 14px;
	color: var(--reading-muted);
}

@media (prefers-reduced-motion: reduce) {
	.reading-toc a, .toc-item, .toc-children { transition: none; }
}
</style>
