<script setup lang="ts">
import type { Travel } from '~/types/travel'
import './chapter-directory.css'

const props = defineProps<{
	open: boolean
	travel: Travel
	chapter: number
	progress?: { current: number, total: number }
	anchor?: HTMLElement | null
}>()
const emit = defineEmits<{ close: [], navigate: [key: string] }>()
const { t } = useI18n()
const panel = useTemplateRef<HTMLElement>('panel')
const list = useTemplateRef<HTMLElement>('list')
const closing = ref(false)
const center = ref('50%')
const above = ref(false)
const below = ref(false)
let pending: string | undefined
const items = computed(() => [
	{ key: 'intro', index: 0, number: t('page.travels.editorial.opening'), title: props.travel.title, detail: '' },
	...props.travel.days.map((day, index) => ({
		key: `chapter-${index}`,
		index: index + 1,
		number: String(index + 1).padStart(2, '0'),
		title: day.title,
		detail: `${day.day === 0 ? t('page.travels.editorial.departure') : t('page.travels.editorial.day', { n: day.day })} · ${t('page.travels.tripPhotos', { n: day.photos.length })}`,
	})),
])
const columns = computed(() => {
	const chapters = items.value.slice(1)
	if (!chapters.length)
		return []
	const middle = chapters.length > 6 ? Math.ceil(chapters.length / 2) : chapters.length
	return chapters.length > 6 ? [chapters.slice(0, middle), chapters.slice(middle)] : [chapters]
})
function updateEdges() {
	const element = list.value
	if (!element)
		return
	above.value = element.scrollTop > 2
	below.value = element.scrollTop + element.clientHeight < element.scrollHeight - 2
}
function measure() {
	if (!props.open)
		return
	const width = window.innerWidth
	const box = props.anchor?.getBoundingClientRect()
	const half = Math.min(panel.value?.offsetWidth ?? 560, width - 32) / 2
	center.value = `${Math.max(half + 16, Math.min(width - half - 16, box ? box.left + box.width / 2 : width / 2))}px`
	updateEdges()
}
function reveal(centered = false) {
	const element = list.value
	const index = Math.max(0, Math.min(items.value.length - 1, props.chapter + 1))
	const option = element?.querySelector<HTMLElement>(`[data-directory-index="${index}"]`)
	if (!element || !option)
		return
	const viewport = element.getBoundingClientRect()
	const box = option.getBoundingClientRect()
	const top = element.scrollTop + box.top - viewport.top
	const target = centered
		? top - (element.clientHeight - box.height) / 2
		: box.top < viewport.top + 12
			? top - 12
			: box.bottom > viewport.bottom - 12 ? top + box.height - element.clientHeight + 12 : element.scrollTop
	element.scrollTop = Math.max(0, Math.min(element.scrollHeight - element.clientHeight, target))
	updateEdges()
}
function choose(key: string) {
	if (closing.value)
		return
	pending = key
	closing.value = true
	emit('close')
}
function dismiss() {
	if (closing.value)
		return
	pending = undefined
	closing.value = true
	emit('close')
}
function afterLeave() {
	if (props.open)
		return
	const key = pending
	pending = undefined
	closing.value = false
	if (key !== undefined)
		emit('navigate', key)
}
function handleKey(event: KeyboardEvent) {
	if ((!props.open && !closing.value) || event.ctrlKey || event.metaKey || event.altKey)
		return
	if (!['ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter', 'Escape', 'PageUp', 'PageDown', ' '].includes(event.key))
		return
	event.preventDefault()
	event.stopPropagation()
	// Keep reader shortcuts from changing the page behind the directory.
	if (event.key === 'Escape' && !closing.value)
		dismiss()
}
watch(() => props.open, async (open) => {
	if (!open) {
		closing.value = true
		return
	}
	pending = undefined
	closing.value = false
	await nextTick()
	if (props.open) {
		measure()
		reveal(true)
	}
})
useEventListener('keydown', handleKey, { capture: true })
useEventListener('resize', () => {
	measure()
	if (props.open)
		reveal()
})
</script>

<template>
<Transition name="directory" @after-leave="afterLeave">
	<div v-if="open" class="chapter-directory-layer" :style="{ '--directory-center': center }" @wheel.stop @touchmove.stop>
		<div class="chapter-directory-shade" aria-hidden="true" @click="dismiss" />
		<section ref="panel" class="chapter-directory" :data-columns="columns.length" :aria-busy="closing">
			<header class="chapter-directory-head">
				<div>
					<p>{{ travel.title }}<span>{{ $t('page.travels.editorial.chapterCount', { n: travel.days.length }) }}</span></p>
					<h2 id="travel-directory-title">
						{{ $t('page.travels.editorial.directory') }}
					</h2>
				</div>
				<button class="icon-button chapter-directory-close" :aria-label="$t('page.travels.editorial.closeDirectory')" @click="dismiss">
					<TravelEditorialIcon name="close" />
				</button>
			</header>
			<div class="chapter-directory-window" :data-above="above" :data-below="below">
				<div id="travel-chapter-menu" ref="list" class="chapter-directory-scroll" role="listbox" aria-labelledby="travel-directory-title" @scroll="updateEdges">
					<button id="travel-directory-option-intro" class="chapter-directory-item chapter-directory-opening" role="option" :aria-selected="chapter < 0" data-directory-index="0" tabindex="-1" @click="choose('intro')">
						<span class="chapter-directory-number">{{ $t('page.travels.editorial.opening') }}</span><span class="chapter-directory-copy"><strong>{{ travel.title }}</strong></span><TravelEditorialIcon name="right" />
					</button>
					<div class="chapter-directory-columns">
						<div v-for="column, columnIndex in columns" :key="columnIndex" class="chapter-directory-column" role="presentation">
							<button v-for="item in column" :id="`travel-directory-option-${item.key}`" :key="item.key" class="chapter-directory-item" role="option" :aria-selected="item.index === chapter + 1" :data-directory-index="item.index" tabindex="-1" @click="choose(item.key)">
								<span class="chapter-directory-number">{{ item.number }}</span>
								<span class="chapter-directory-copy">
									<strong>{{ item.title }}</strong>
									<small>{{ item.detail }}<span v-if="item.index === chapter + 1" class="chapter-directory-progress" :aria-label="progress ? $t('page.travels.editorial.photoProgress', progress) : $t('page.travels.editorial.readingHere')">{{ progress ? `${progress.current} / ${progress.total}` : $t('page.travels.editorial.readingHere') }}</span></small>
								</span>
							</button>
						</div>
					</div>
				</div>
			</div>
		</section>
	</div>
</Transition>
</template>
