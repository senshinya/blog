<script setup lang="ts">
import { Temporal } from 'temporal-polyfill'
import blogConfig from '~~/blog.config'

const props = withDefaults(defineProps<{
	icon?: string
	date?: string | Temporal.ZonedDateTime
	format?: dateTimeFormatOptions
	absolute?: boolean
	relative?: boolean
	nospace?: boolean
	tipFormat?: dateTimeFormatOptions
	tipTransform?: (formattedDate: string) => string
}>(), {
	tipTransform: String,
})

const today = Temporal.Now.plainDateISO()
const zdt = computed(() => {
	try {
		return typeof props.date === 'string' ? toZonedTemporal(props.date) : props.date
	}
	catch {
		return null
	}
})

const relative = computed(() => props.absolute || !zdt.value
	? false
	: props.relative || today.since(zdt.value, { largestUnit: 'week' }).weeks < 1,
)

const mounted = useMounted()
const tooltip = computed(() => mounted.value && zdt.value
	? props.tipTransform(toZdtLocaleString(zdt.value, props.tipFormat))
	: props.date as string,
)
</script>

<template>
<span :title="tooltip">
	<Icon v-if="icon" :name="icon" />
	<template v-if="icon && !nospace">&nbsp;</template>

	<span v-if="!zdt">Invalid Date</span>

	<time
		v-else-if="format"
		:datetime="toInstantString(zdt)"
		v-text="toZdtLocaleString(zdt, format)"
	/>

	<!-- locale 必须显式给：NuxtTime 留空会落到浏览器语言，
		英文浏览器下相对时间就成了「21 minutes ago」 -->
	<NuxtTime
		v-else
		:datetime="toInstantString(zdt)"
		:locale="blogConfig.language"
		:relative
		:year="zdt.year === today.year ? undefined : '2-digit'"
		month="long"
		day="numeric"
		numeric="auto"
	/>
</span>
</template>
