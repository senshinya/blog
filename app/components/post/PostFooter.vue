<script setup lang="ts">
import type { ArticleProps } from '~/types/article'

defineOptions({ inheritAttrs: false })
defineProps<ArticleProps>()

const [DefineTemplate, ReuseTemplate] = createReusableTemplate<{
	title: string
	kind: 'references' | 'license'
	showMobileTitle?: boolean
}>({ inheritAttrs: false })
</script>

<template>
<div class="post-footer">
	<div class="seal-row">
		<PostAuthorshipSeal :authorship />
	</div>
	<DefineTemplate v-slot="{ $slots, title, kind, showMobileTitle }">
		<section :class="[`${kind}-section`, { 'show-mobile-title': showMobileTitle }]" :aria-label="title">
			<div class="title text-creative">
				{{ title }}
			</div>

			<div class="content">
				<component :is="$slots.default" />
			</div>
		</section>
	</DefineTemplate>

	<ReuseTemplate v-if="references" kind="references" :title="$t('post.references')">
		<ul>
			<li v-for="{ title, link }, i in references" :key="i">
				<ProseA :href="link || ''">
					{{ title ?? link }}
				</ProseA>
			</li>
		</ul>
	</ReuseTemplate>

	<ReuseTemplate kind="license" :show-mobile-title="!!meta?.slots?.copyright" :title="meta?.slots?.copyright?.props?.title as string || $t('post.license')">
		<ContentRenderer v-if="meta?.slots?.copyright" :value="meta?.slots?.copyright" />
		<i18n-t v-else keypath="post.licenseNotice" tag="p">
			<template #link>
				<ProseA :href="$t('post.licenseUrl')">
					{{ $t('post.licenseName') }}
				</ProseA>
			</template>
		</i18n-t>
	</ReuseTemplate>
</div>
</template>

<style lang="scss" scoped>
.post-footer {
	--seal-size: 164px;

	position: relative;
	margin: 3rem 0.5rem 2rem;
	padding-inline-end: calc(var(--seal-size) + 1rem);
	border: 1px solid var(--c-border);
	border-radius: 1rem;
	background-color: var(--c-bg-2);
}

.seal-row {
	position: absolute;
	top: -52px;
	right: 10px;
	z-index: 1;
}

section {
	padding: 1rem;

	& + section {
		border-top: 1px solid var(--c-border);
	}
}

.title {
	font-weight: bold;
	color: var(--c-text);
}

.content {
	margin-top: 0.5em;
	font-size: 0.9rem;

	li {
		margin: 0.5em 0;
	}
}

@media (max-width: 480px) {
	.post-footer {
		--seal-size: 136px;

		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin: 1.5rem 0.5rem 2rem;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: none;
	}

	.seal-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 20px;
		position: static;

		&::before,
		&::after {
			content: "";
			flex: 0 0 34px;
			height: 1px;
			background: var(--c-border);
		}
	}

	.license-section {
		padding: 0 0.5rem;
		border: 0;
		text-align: center;

		&:not(.show-mobile-title) > .title {
			display: none;
		}

		.content {
			margin-top: 0;
		}
	}

	.references-section {
		order: -1;
		margin-bottom: 0.75rem;
		padding: 0 0.5rem 1rem;
		border-bottom: 1px solid var(--c-border);
	}
}
</style>
