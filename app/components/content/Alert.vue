<script setup lang="ts">
const props = withDefaults(defineProps<{
	type?: keyof typeof typeMap
	card?: boolean
	flat?: boolean
	icon?: string
	color?: string
	title?: string
	text?: string
}>(), {
	type: 'tip',
})

const appConfig = useAppConfig()
const card = computed(() => appConfig.component.alert.defaultStyle === 'flat' ? props.card : !props.flat)

const { t } = useI18n()
const slots = useSlots()

const typeMap = {
	tip: {
		icon: 'tabler:note',
		color: '#3A7',
		titleKey: 'content.alert.tip',
	},
	info: {
		icon: 'tabler:info-circle',
		// 使用 currentColor 会导致 --c-primary-soft 颜色混合错误
		color: 'var(--c-text-1)',
		titleKey: 'content.alert.info',
	},
	question: {
		icon: 'tabler:help-circle',
		color: '#3AF',
		titleKey: 'content.alert.question',
	},
	warning: {
		icon: 'tabler:alert-triangle',
		color: '#F80',
		titleKey: 'content.alert.warning',
	},
	error: {
		icon: 'tabler:circle-x',
		color: '#F33',
		titleKey: 'content.alert.error',
	},
} as const

const icon = computed(() => props.icon || typeMap[props.type].icon)
const color = computed(() => props.color || typeMap[props.type].color)
/** 标题行只在内容显式写了 title 时出现，默认形态靠色条与图标表达严重度。 */
const hasTitle = computed(() => !!props.title || !!slots.title)
/**
 * 去掉可见标签后，颜色与图标成了严重度的唯一载体 —— 只靠颜色传达信息过不了
 * WCAG 1.4.1。词条因此没有删，改挂到图标的 aria-label 上，读屏仍念得出"警告""错误"。
 */
const label = computed(() => t(typeMap[props.type].titleKey))
</script>

<template>
<div class="alert" :class="{ card }" :style="{ '--c-primary': color }">
	<Icon class="alert-icon" :name="icon" role="img" :aria-label="label" />

	<div class="alert-body">
		<div v-if="hasTitle" class="alert-title">
			<slot name="title">
				{{ title }}
			</slot>
		</div>
		<slot><p>{{ text }}</p></slot>
	</div>
</div>
</template>

<style scoped>
/* 细色条 + 图标。严重度由起始边那条 2px 色条和图标共同表达， */
/* 不再占一整行写"提醒""错误" —— 那行字对读者没有新信息。 */
.alert {
	display: flex;
	gap: 0.7em;
	margin: 1em 0;
	padding: 0.7em 0.9em;
	border-inline-start: 2px solid var(--c-primary);
	/* 逻辑属性：起始边贴着色条不圆角，RTL 下自动换边 */
	border-radius: 0.5em;
	border-start-start-radius: 0;
	border-end-start-radius: 0;
	background-color: var(--c-bg-2);
	font-size: 0.9em;

	@supports (color: color-mix(in srgb, transparent, transparent)) {
		--c-primary-soft: color-mix(in srgb, var(--c-primary) 15%, transparent);

		background-color: color-mix(in srgb, var(--c-primary) 6%, transparent);
	}

	&.card {
		box-shadow: var(--box-shadow-1);
		background-color: var(--ld-bg-card);

		@supports (color: color-mix(in srgb, transparent, transparent)) {
			background-color: color-mix(in srgb, var(--c-primary) 8%, var(--ld-bg-card));
		}
	}

	> .alert-icon {
		margin-top: 0.25em;
		color: var(--c-primary);
	}
}

.alert-body {
	flex: 1;
	min-width: 0;

	/* 首尾子元素的外边距交给容器 padding，否则上下留白翻倍 */
	> :first-child {
		margin-top: 0;
	}

	> :last-child {
		margin-bottom: 0;
	}
}

.alert-title {
	margin-bottom: 0.2em;
	font-weight: bold;
	color: var(--c-primary);

	:deep(p) {
		margin: 0;
	}
}
</style>
