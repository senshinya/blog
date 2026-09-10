<script setup lang="ts">
defineProps<{
	title?: string
}>()
</script>

<template>
<!--
	这两个值最终进的是 CSS content 属性。JSON.stringify 只覆盖了引号和反斜杠——
	能生效纯属巧合：CSS 的通用转义规则里，反斜杠 + 非十六进制字符会被解析成那个字符本身，
	刚好和 JSON 的转义规则对上了。换行符不在此列：JSON.stringify("a\nb") 产出的是
	反斜杠加字母 n，CSS 会把它解析成字面的 n，换行会被悄悄吞掉而不是报错。
	因此 content.expand / content.collapse 在任何语言下都必须保持单行、简短。
-->
<details :style="{ '--label-expand': JSON.stringify($t('content.expand')), '--label-collapse': JSON.stringify($t('content.collapse')) }">
	<summary>
		<slot name="title">
			{{ title }}
		</slot>
	</summary>
	<slot />
</details>
</template>

<style scoped>
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
