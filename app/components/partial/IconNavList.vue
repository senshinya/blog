<script setup lang="ts">
import type { NavItem } from '~/types/nav'

defineProps<{
	list: NavItem[]
}>()

const { locale } = useI18n()
</script>

<template>
<menu>
	<UtilLink
		v-for="item in list"
		:key="item.textKey ?? item.text"
		v-tip="resolveNavText(item, $t)"
		:to="resolveNavUrl(item, locale)"
		:aria-label="resolveNavText(item, $t)"
	>
		<Icon :name="item.icon" />
	</UtilLink>
</menu>
</template>

<style scoped>
menu {
	display: flex;
	justify-content: center;

	a {
		padding: 0.5em;
		border-radius: 2em;
		transition: background-color 0.2s;

		&:hover {
			background-color: var(--c-bg-soft);
		}

		.iconify {
			display: block;
		}
	}
}
</style>
