<script setup lang="ts">
import blogConfig from '~~/blog.config'
import { getTravelBySlug } from '~/travels'

definePageMeta({
	layout: false,
})

const { t, locale } = useI18n()
const route = useRoute()
const found = getTravelBySlug(locale.value, route.params.slug as string)

if (!found) {
	throw createError({
		statusCode: 404,
		statusMessage: t('page.travels.notFound'),
		fatal: true,
	})
}

// throw 之后类型已收窄，转存一个非空常量，省得后面到处写 travel!
const travel = found

useSeoMeta({
	title: travel.posttitle,
	description: travel.description,
	ogType: 'article',
	ogImage: travel.coverImage,
})

const schema = articleSchemaData({
	title: travel.title,
	description: travel.description,
	image: travel.coverImage,
	published: travel.published,
}, route.path, blogConfig.locales.find(l => l.code === locale.value)!.language, blogConfig)
useSchemaOrg([definePerson(schema.person), defineArticle(schema.article)])
</script>

<template>
<TravelEditorialTemplate :travel />
</template>
