<script setup lang="ts">
import blogConfig from '~~/blog.config'
import { manifest } from '#build/i18n-manifest'
import { useLocaleMotion } from '~/composables/useLocaleMotion'
import { stripLocale } from '~/utils/locale'
import { settleAnimations } from '~/utils/settleAnimations'

const expanded = defineModel<boolean>('expanded', { default: false })
const route = useRoute()
const switchLocalePath = useSwitchLocalePath()
const switchWithMotion = useLocaleMotion()
const { persist } = useLocalePreference()
const root = useTemplateRef('root')
const trigger = useTemplateRef('trigger')
const options = useTemplateRef('options')
const optionsId = useId()
const locales = blogConfig.locales
const localeCodes = locales.map(l => l.code)
const selected = ref<string>()
let choice = 0

// Derive language from the URL so SSR and hydration render the same selection.
const current = computed(() => stripLocale(route.path, localeCodes, 'zh').locale)
const currentIndex = computed(() => Math.max(0, localeCodes.indexOf(selected.value ?? current.value)))
const currentLocale = computed(() => locales[currentIndex.value]!)
const available = computed(() => {
	const { basePath } = stripLocale(route.path, localeCodes, 'zh')
	return manifest[basePath] ?? localeCodes
})

async function open() {
	choice++
	selected.value = undefined
	expanded.value = true
	await nextTick()
	options.value?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true })
}

async function close(restoreFocus = false) {
	expanded.value = false
	if (restoreFocus) {
		await nextTick()
		trigger.value?.focus({ preventScroll: true })
	}
}

async function choose(code: string) {
	if (!available.value.includes(code))
		return
	const version = ++choice
	const path = switchLocalePath(code)
	selected.value = code
	await close(true)
	// nextTick only applies the collapsed class. Starting a document snapshot now
	// freezes the capsule at the first frame of its spring transition.
	await settleAnimations(root.value?.closest('.reading-preferences') ?? root.value, 140)
	if (version !== choice || !root.value?.isConnected)
		return
	persist(code)
	try {
		// Unresolvable routes still retain the language preference.
		if (path && code !== current.value)
			await switchWithMotion(path)
	}
	finally {
		if (version === choice)
			selected.value = undefined
	}
}

function onKeydown(event: KeyboardEvent) {
	if (event.key !== 'Escape' || !expanded.value)
		return
	event.preventDefault()
	event.stopPropagation()
	close(true)
}

function onFocusout(event: FocusEvent) {
	// activeElement can briefly be body between blur and focus. Use the event's
	// destination so clicking another option does not close it before click fires.
	const next = event.relatedTarget as Node | null
	if (next && !root.value?.contains(next))
		close()
}

onClickOutside(root, () => close())
watch(() => route.path, () => {
	choice++
	selected.value = undefined
	close()
})
onScopeDispose(() => {
	choice++
})
</script>

<template>
<div ref="root" class="lang-toggle" :class="{ expanded }" @keydown="onKeydown" @focusout="onFocusout">
	<button
		ref="trigger"
		type="button"
		class="language-trigger"
		:aria-label="`${$t('lang.switch')}: ${currentLocale.label}`"
		:aria-expanded="expanded"
		:aria-controls="optionsId"
		:inert="expanded"
		@click="open"
	>
		<span :lang="currentLocale.code">{{ currentLocale.name }}</span>
		<Icon name="tabler:chevron-down" />
	</button>
	<div
		:id="optionsId"
		ref="options"
		class="language-options"
		role="group"
		:aria-label="$t('lang.switch')"
		:inert="!expanded"
		:style="{ '--option-count': locales.length, '--active-index': currentIndex }"
	>
		<button
			v-for="locale in locales"
			:key="locale.code"
			v-tip="{ content: available.includes(locale.code) ? locale.label : $t('lang.unavailable'), trigger: 'mouseenter' }"
			type="button"
			:aria-disabled="!available.includes(locale.code)"
			:aria-label="locale.label"
			:aria-pressed="(selected ?? current) === locale.code"
			:lang="locale.code"
			@click="choose(locale.code)"
		>
			{{ locale.name }}
		</button>
	</div>
</div>
</template>

<style scoped>
.lang-toggle {
	flex: 0 0 auto;
	position: relative;
	width: 3.5625rem;
	height: var(--preference-height);
	transition: width 0.42s var(--preference-spring);

	&.expanded {
		width: 7.1875rem;
	}
}

.language-trigger {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 5px;
	width: 3.5625rem;
	height: 100%;
	border-radius: 999px;
	box-shadow: var(--box-shadow-2);
	background-color: var(--ld-bg-card);
	color: var(--c-text-1);
	transition: opacity 0.12s, transform 0.25s var(--preference-slide);

	> .iconify {
		font-size: 0.75rem;
	}

	&:hover {
		transform: translateY(-1px);
	}

	&:active {
		transform: scale(0.94);
	}

	.expanded > & {
		opacity: 0;
		transform: scale(0.8);
		pointer-events: none;
	}
}

.language-options {
	position: absolute;
	opacity: 0;
	inset: 0;
	transform: scale(0.85);
	transition: opacity 0.16s, transform 0.3s var(--preference-slide);
	pointer-events: none;

	.expanded > & {
		opacity: 1;
		transform: none;
		transition-delay: 0.08s;
		pointer-events: auto;
	}
}

@media (prefers-reduced-motion: reduce) {
	.lang-toggle,
	.language-trigger,
	.language-options {
		transition: none;
	}
}
</style>
