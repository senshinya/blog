<script setup lang="ts">
defineProps<{
	title?: string
}>()
</script>

<template>
<details :style="{ '--label-expand': JSON.stringify($t('content.expand')), '--label-collapse': JSON.stringify($t('content.collapse')) }">
	<summary>
		<slot name="title">
			{{ title }}
		</slot>
	</summary>
	<slot />
</details>
</template>

<style lang="scss" scoped>
details {
	margin: 1em 0;
	padding: 0.5em 0.8em;
	border: 1px solid var(--c-border);
	border-radius: 0.5em;
	background-color: var(--c-bg-2);
	font-size: 0.9em;

	&[open] {
		> summary {
			margin-bottom: 0.5em;
			font-weight: bold;
			color: currentcolor;

			&::before {
				content: var(--label-collapse);
			}
		}
	}

	> summary {
		margin: -0.5em -0.8em;
		padding: 0.5em 0.8em;
		color: var(--c-text-2);
		transition: all 0.2s;
		cursor: pointer;

		> :deep(p) {
			display: inline;
		}

		&::before {
			content: var(--label-expand);
			float: right;
			float: inline-end;
			opacity: 0.5;
			margin-inline-start: 0.5em;
			font-weight: normal;
			transition: color 0.2s;
		}

		&:hover {
			color: var(--c-text);
		}
	}

	> :deep(.z-codeblock) {
		margin: 0 -0.8em -0.5em;
	}
}
</style>
