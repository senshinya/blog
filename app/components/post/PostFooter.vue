<script setup lang="ts">
import type { ArticleProps } from '~/types/article'

defineOptions({ inheritAttrs: false })
defineProps<ArticleProps>()

const [DefineTemplate, ReuseTemplate] = createReusableTemplate<{
	title: string
}>({ inheritAttrs: false })

const appConfig = useAppConfig()
</script>

<template>
<div class="post-footer">
	<DefineTemplate v-slot="{ $slots, title }">
		<section>
			<div class="title text-creative">
				{{ title }}
			</div>

			<div class="content">
				<component :is="$slots.default" />
			</div>
		</section>
	</DefineTemplate>

	<ReuseTemplate v-if="references" :title="$t('post.references')">
		<ul>
			<li v-for="{ title, link }, i in references" :key="i">
				<ProseA :href="link || ''">
					{{ title ?? link }}
				</ProseA>
			</li>
		</ul>
	</ReuseTemplate>

	<ReuseTemplate :title="meta?.slots?.copyright?.props?.title as string || $t('post.license')">
		<ContentRenderer v-if="meta?.slots?.copyright" :value="meta?.slots?.copyright" />
		<i18n-t v-else keypath="post.licenseNotice" tag="p">
			<template #link>
				<ProseA :href="appConfig.copyright.url">
					{{ appConfig.copyright.name }}
				</ProseA>
			</template>
		</i18n-t>
	</ReuseTemplate>
</div>
</template>

<style lang="scss" scoped>
.post-footer {
	margin: 2rem 0.5rem;
	border: 1px solid var(--c-border);
	border-radius: 1rem;
	background-color: var(--c-bg-2);
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
</style>
