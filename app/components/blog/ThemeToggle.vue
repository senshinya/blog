<script setup lang="ts">
const appConfig = useAppConfig()
const colorMode = useColorMode()
const themes = computed(() => Object.entries(appConfig.themes))
const activeIndex = computed(() => themes.value.findIndex(([name]) => name === colorMode.preference))

// Browser persistence is unavailable during SSR. Reveal the selection only after
// hydration, avoiding a stale system highlight next to the saved preference.
const mounted = ref(false)
onMounted(() => mounted.value = true)
</script>

<template>
<div
	class="theme-toggle"
	:class="{ 'selection-ready': mounted && activeIndex >= 0 }"
	role="group"
	:aria-label="$t('sidebar.appearance')"
	:style="{ '--option-count': themes.length, '--active-index': mounted ? Math.max(0, activeIndex) : 0 }"
>
	<button
		v-for="[themeName, themeData] in themes"
		:key="themeName"
		v-tip="$t(themeData.tipKey)"
		type="button"
		:aria-label="$t(themeData.tipKey)"
		:data-theme="themeName"
		:aria-pressed="mounted && colorMode.preference === themeName"
		@click="colorMode.preference = themeName"
	>
		<Icon :name="themeData.icon" />
	</button>
</div>
</template>

<style lang="scss" scoped>
.theme-toggle {
	@include segmented-pill;

	flex: 1;

	&::before {
		opacity: 0;
	}

	&.selection-ready::before {
		opacity: 1;
	}

	> button:hover .iconify {
		transform: rotate(-18deg);
	}

	> button:first-of-type:hover .iconify {
		transform: rotate(35deg);
	}

	> button[data-theme="system"] > .iconify {
		transform: none;
	}

	> button[data-theme="system"][aria-pressed="true"] > .iconify {
		transform: scale(1.05);
	}
}
</style>
