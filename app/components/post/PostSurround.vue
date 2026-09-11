<script setup lang="ts">
import type { ArticleProps } from '~/types/article'
import blogConfig from '~~/blog.config'
import { resolveContentPath, stripLocale } from '~/utils/locale'

const LOCALES = blogConfig.locales.map(l => l.code)

const { locale } = useI18n()
const collection = useContentCollection()
const contentPath = useContentPath()

const dataKey = computed(() => `surround:${contentPath.value}`)
const { data: surrounds } = await useAsyncData(
	dataKey,
	() => queryCollectionItemSurroundings(
		collection.value,
		stripLocale(contentPath.value, LOCALES, 'zh').basePath,
		{ fields: ['date', 'title', 'type'] },
	)
		.order('date', 'ASC')
		.where('stem', 'LIKE', `posts/%`),
	{ watch: [collection] },
)

const prev = computed(() => surrounds.value?.[0] ?? null)
const next = computed(() => surrounds.value?.[1] ?? null)

const [DefineTemplate, ReuseTemplate] = createReusableTemplate<{
	post: ArticleProps | null
	icon: string
	fallbackIcon: string
	fallbackText: string
	alignEnd?: boolean
}>({ inheritAttrs: false })

useResourceFonts(() => ({ serif: !!surrounds.value?.some(post => post?.type === 'story') }))
</script>

<template>
<DefineTemplate v-slot="{ post, icon, fallbackIcon, fallbackText, alignEnd }">
	<UtilLink :to="resolveContentPath(post?.path, locale)" class="surround-link" :data-transition-key="post?.path" :align-end>
		<Icon :class="{ 'rtl-flip': post }" :name="post ? icon : fallbackIcon" />
		<div class="surround-text">
			<strong class="title" :class="getPostTypeClassName(post?.type)">
				{{ post?.title || fallbackText }}
			</strong>
			<UtilDate v-if="post?.date" class="date" :date="post.date" />
		</div>
	</UtilLink>
</DefineTemplate>

<div v-if="prev || next" class="surround-post" dir="ltr">
	<ReuseTemplate
		:post="next" icon="zi:solar-rewind-back-bold-duotone"
		fallback-icon="line-md:coffee-twotone-loop" :fallback-text="$t('post.surroundNext')"
	/>
	<ReuseTemplate
		:post="prev" icon="zi:solar-rewind-forward-bold-duotone"
		fallback-icon="line-md:construction-twotone" :fallback-text="$t('post.surroundEnd')"
		align-end
	/>
</div>
</template>

<style scoped>
.surround-post {
	contain: layout;
	display: flex;
	flex-wrap: wrap;
	gap: 1rem;
	margin: 3rem 1rem;
}

.surround-link {
	display: flex;
	align-items: center;
	gap: 0.5em;
	transition: color 0.2s;

	&:not([href]) {
		opacity: 0.4;
		user-select: none;
	}

	&[align-end] {
		/* direction: rtl 会导致末尾标点居左 */
		flex-direction: row-reverse;
		margin-inline-start: auto;
		text-align: end;
	}

	> .surround-text {
		text-wrap: balance;
		transition: transform 0.2s;

		> .date {
			display: block;
			opacity: 0.6;
			font-size: 0.8rem;
		}
	}

	> .iconify {
		opacity: 0.5;
		font-size: 2rem;
		transition: transform 0.2s;
	}

	&[href]:hover {
		color: var(--c-primary);

		> .surround-text {
			transform: translateX(-1em);
		}

		&[align-end] > .surround-text {
			transform: translateX(1em);
		}

		> .iconify {
			opacity: 0.2;
			transform: scale(2);
		}
	}
}
</style>
