<script setup lang="ts">
import type { ArticleProps } from '~/types/article'
import blogConfig from '~~/blog.config'
import { buildPath } from '~/utils/locale'

defineOptions({ inheritAttrs: false })

const props = defineProps<ArticleProps & { previewImage?: string, holdCover?: boolean }>()
const mounted = useMounted()
const fullCoverReady = ref(false)
watch(() => props.image, () => fullCoverReady.value = false)

async function onCoverLoad(event: Event) {
	if (!props.previewImage || !(event.target instanceof HTMLImageElement))
		return
	const image = event.target
	const source = image.currentSrc
	await image.decode().catch(() => {})
	if (mounted.value && image.currentSrc === source)
		fullCoverReady.value = true
}

const appConfig = useAppConfig()
const { locale } = useI18n()
const currentLanguage = computed(() =>
	blogConfig.locales.find(l => l.code === locale.value)?.language ?? blogConfig.language)

const coverFilter = computed(() => props.meta?.coverFilter || (props.meta?.coverDim && 'brightness(0.75)') || undefined)

const shareText = computed(() => `【${appConfig.title}】${props.title}\n\n${
	props.description ? `${props.description}\n\n` : ''}${
	new URL(buildPath(props.path!, locale.value, 'zh'), appConfig.url).href}`)

const { copy, copied } = useClipboard({ source: shareText, legacy: true })
</script>

<template>
<div class="post-header" :class="{ 'has-cover': image }" :data-transition-key="path" data-transition-enter>
	<Pic v-if="image && !holdCover" class="post-cover" :src="image" :alt="title" :filter="coverFilter" loading="eager" sizes="(max-width: 768px) 100vw, (max-width: 1280px) 65vw, 900px" @load.capture="onCoverLoad" />
	<Transition name="cover-resolve">
		<img v-if="previewImage && (holdCover || !fullCoverReady)" class="post-cover-preview" :src="previewImage" :style="{ filter: coverFilter }" alt="" aria-hidden="true">
	</Transition>
	<div class="post-nav">
		<div class="operations">
			<Icon v-show="false" name="tabler:check" />
			<ZButton
				:icon="copied ? 'tabler:check' : 'tabler:share'"
				:text="$t('post.share')"
				@click="copy()"
			/>
		</div>

		<div v-if="!meta?.hideInfo" class="post-info">
			<a class="post-author" href="https://shinya.click/" :aria-label="$t('post.author', { name: blogConfig.author.name })">
				{{ blogConfig.author.name }}
			</a>
			<UtilDate
				v-if="date"
				v-tip
				:tip-transform="d => $t('post.createdAt', { date: d })"
				:date
				icon="tabler:pencil-minus"
			/>

			<span v-if="categories">
				<Icon :name="getCategoryIcon(categories[0])" />
				{{ $t(`category.${categories[0]}`) }}
			</span>

			<span>
				<Icon name="tabler:pilcrow" />
				{{ $t('post.words', { n: formatNumber(readingTime?.words, currentLanguage) }) }}
			</span>
		</div>
	</div>

	<h1 class="post-title" :class="getPostTypeClassName(type)">
		{{ title }}
	</h1>
</div>
</template>

<style scoped>
.post-header {
	contain: paint; /* overflow hidden + position relative */
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	gap: 1rem;
	margin: 0.5rem;
	border-radius: 1rem;
	background-color: var(--c-bg-2);
	color: var(--c-text);

	@media (max-width: 768px) {
		margin: 0;
		border-radius: 0;
	}

	&:hover .operations,
	&:focus-within .operations {
		opacity: 1;
	}

	&.has-cover {
		min-height: 16rem;
		max-height: 20rem;
		background-color: #30383F;
		color: white;
		transition: font-size 0.2s;

		.post-info {
			filter: drop-shadow(0 1px 2px #000);
		}

		.post-title {
			background-image: linear-gradient(transparent, #0003, #0005);
			text-shadow: var(--text-shadow-black);

			&.text-story {
				text-align: center;
			}
		}
	}
}

.operations {
	position: absolute;
	opacity: 0;
	inset-inline-end: 1em;
	color: var(--c-text-1);
	transition: opacity 0.2s;
	z-index: 1;
}

.post-cover {
	position: absolute;
	inset: 0;

	> :deep(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
}

.post-cover-preview {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
	pointer-events: none;
}
.cover-resolve-leave-active { transition: opacity 0.18s ease-out; }
.cover-resolve-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
	.cover-resolve-leave-active { transition: none; }
}

.post-title {
	padding: 0.8em 1rem;
	font-size: 1.6em;
	line-height: 1.2;
	z-index: 1;
}

.post-nav {
	padding: 0.8em 1rem;
	font-size: 0.8em;

	.post-info {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5em 1.2em;
		column-gap: clamp(1em, 3%, 1.5em);
	}
}
</style>
