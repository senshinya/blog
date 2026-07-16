<script setup lang="ts">
const props = defineProps<{
	/** 名称 */
	name: string
	/** 右上角小标签（电子产品用，如「键盘」）；服务用 active 代替 */
	tag?: string
	/** 产品照片 URL；有则走图，无则退化成 icon 图标块 */
	photo?: string
	/** 无照片时的图标（iconify 名，如 simple-icons:apple / tabler:keyboard） */
	icon?: string
	/** 自建服务：显示运行中状态点 */
	active?: boolean
	/** 参数列表，键值对，如 { 处理器: 'M2 Pro', 内存: '16 GB' } */
	params?: Record<string, string>
	/** 我的评价，置于卡片底部 */
	say?: string
}>()

const paramEntries = computed(() => Object.entries(props.params ?? {}))
</script>

<template>
<div class="gear-card">
	<div v-if="photo" class="gear-media">
		<UtilImg :src="getCfImgUrl(photo, 320)" :alt="name" :style="getLqipStyle(photo)" />
	</div>
	<div v-else class="gear-media logo">
		<Icon :name="icon || 'tabler:box'" />
	</div>

	<div class="gear-body">
		<div class="gear-head">
			<span class="gear-name">{{ name }}</span>
			<span v-if="active" class="gear-live"><i />active</span>
			<span v-else-if="tag" class="gear-tag">{{ tag }}</span>
		</div>

		<dl v-if="paramEntries.length" class="gear-params">
			<div v-for="[k, v] in paramEntries" :key="k" class="gear-param">
				<dt>{{ k }}</dt>
				<span class="gear-dots" />
				<dd>{{ v }}</dd>
			</div>
		</dl>

		<p v-if="say" class="gear-say">
			{{ say }}
		</p>
	</div>
</div>
</template>

<style scoped lang="scss">
.gear-card {
	display: flex;
	overflow: hidden;
	min-height: 150px;
	margin-bottom: 0.9rem;
	border: 1px solid var(--c-border);
	border-radius: 0.8rem;
	background-color: var(--ld-bg-card);

	// 瀑布流(column-count)下别把卡片拆到两列
	break-inside: avoid;
	transition: border-color var(--delay), box-shadow var(--delay), transform var(--delay);

	&:hover {
		border-color: var(--sec, var(--c-primary));
		box-shadow: var(--box-shadow-2);
		transform: translateY(-2px);
	}
}

.gear-media {
	display: flex;
	flex-shrink: 0;
	align-items: center;
	align-self: stretch;
	justify-content: center;
	width: 132px;
	background-color: var(--c-bg-2);

	:deep(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	// 无照片：图标块，取分区强调色
	&.logo {
		font-size: 2.2rem;
		color: var(--sec, var(--c-primary));
	}
}

.gear-body {
	display: flex;
	flex: 1;
	flex-direction: column;
	min-width: 0;
	padding: 1.1rem 1.15rem;
}

.gear-head {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.gear-name {
	flex: 1;
	overflow: hidden;
	font-family: var(--font-creative);
	font-weight: 700;
	line-height: 1.25;
	white-space: nowrap;
	text-overflow: ellipsis;
	color: var(--c-text);
}

.gear-tag {
	flex-shrink: 0;
	padding: 0.12em 0.6em;
	border-radius: 2em;
	background-color: var(--c-bg-2);
	font-family: var(--font-monospace);
	font-size: 0.7rem;
	white-space: nowrap;
	color: var(--c-text-2);
}

.gear-live {
	display: inline-flex;
	flex-shrink: 0;
	align-items: center;
	gap: 0.35em;
	font-family: var(--font-monospace);
	font-size: 0.72rem;
	color: var(--c-success);

	> i {
		width: 0.45em;
		height: 0.45em;
		border-radius: 50%;
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-success) 22%, transparent);
		background-color: var(--c-success);
	}
}

// 参数列表：名字之下、评价之上，点线对齐
.gear-params {
	display: flex;
	flex-direction: column;
	gap: 0.24rem;
	margin: 0.8rem 0 0;
}

.gear-param {
	display: flex;
	align-items: baseline;
	gap: 0.8rem;
	font-size: 0.76rem;
	line-height: 1.5;

	> dt {
		margin: 0;
		white-space: nowrap;
		color: var(--c-text-3);
	}

	> dd {
		margin: 0;
		font-family: var(--font-monospace);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		color: var(--c-text-1);
	}
}

.gear-dots {
	flex: 1;
	align-self: center;
	height: 0;
	border-bottom: 1px dotted var(--c-border);
}

// 我的评价：钉在卡底，靠留白与参数隔开（不用分隔线）
.gear-say {
	margin: 0;
	margin-top: auto;
	padding-top: 1.7rem;
	font-size: 0.85rem;
	line-height: 1.5;
	color: var(--c-text-1);

	&::before {
		content: "「";
		color: var(--c-text-3);
	}

	&::after {
		content: "」";
		color: var(--c-text-3);
	}
}
</style>
