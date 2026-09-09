<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps<{
	error: NuxtError & { url?: string }
}>()
</script>

<template>
<NuxtLayout>
	<template #aside>
		<WidgetBlogLog />
	</template>

	<div class="app-error">
		<ZError
			:code="error.stack"
			:message="error.url"
			:title="`[${error.status}] ${error.message}`"
		>
			<template #operation>
				<ZButton :text="$t('error.backHome')" @click="clearError({ redirect: '/' })" />
				<ZButton :text="$t('error.ignore')" @click="clearError()" />
			</template>
		</ZError>
	</div>
</NuxtLayout>
</template>

<style lang="scss" scoped>
.app-error {
	margin: 1rem;
}
</style>
