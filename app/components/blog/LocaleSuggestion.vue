<script setup lang="ts">
import blogConfig from '~~/blog.config'
import { localeRedirectPath, stripLocale } from '~/utils/locale'

const route = useRoute()
const suggestion = useState<string | undefined>('locale-suggestion')
const { persist } = useLocalePreference()
const codes = blogConfig.locales.map(l => l.code)
const targetLocale = computed(() => suggestion.value ? stripLocale(suggestion.value, codes, 'zh').locale : undefined)
const labels: Record<string, { switch: string, stay: string }> = {
	zh: { switch: '切换到中文', stay: '保留当前语言' },
	en: { switch: 'Read in English', stay: 'Keep current language' },
	ja: { switch: '日本語で読む', stay: '現在の言語を使う' },
}
const label = computed(() => labels[targetLocale.value ?? 'en']!)
const destination = computed(() => suggestion.value ? localeRedirectPath(suggestion.value, route.fullPath, blogConfig.url) : undefined)

function choose(code: string) {
	persist(code)
	suggestion.value = undefined
}
</script>

<template>
<ClientOnly>
	<aside v-if="destination && targetLocale" class="locale-suggestion" :lang="targetLocale" aria-label="Language">
		<NuxtLink :to="destination" @click="choose(targetLocale!)">
			{{ label.switch }}
		</NuxtLink>
		<button type="button" @click="choose(stripLocale(route.path, codes, 'zh').locale)">
			{{ label.stay }}
		</button>
	</aside>
</ClientOnly>
</template>

<style scoped>
.locale-suggestion {
	display: flex;
	flex-wrap: wrap;
	gap: 1rem;
	position: fixed;
	inset: auto 1rem 1rem auto;
	max-width: calc(100vw - 2rem);
	padding: 0.8rem 1rem;
	border: 1px solid var(--c-border);
	border-radius: 0.5rem;
	box-shadow: var(--box-shadow-2);
	background: var(--ld-bg-card);
	z-index: 100;

	a { color: var(--c-primary); }
	button { color: var(--c-text-2); }
}
</style>
