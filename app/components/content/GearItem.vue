<script setup lang="ts">
const props = defineProps<{
	name: string
	desc?: string
	icon?: string
	image?: string
}>()

const hasImage = computed(() => !!props.image)
</script>

<template>
<div class="gear-card" :class="{ 'has-image': hasImage }">
	<div v-if="image" class="gear-image">
		<UtilImg
			:src="getCfImgUrl(image, 640)"
			:alt="name"
			:style="getLqipStyle(image)"
		/>
	</div>
	<div class="gear-body">
		<Icon v-if="icon" class="gear-icon" :name="icon" />
		<div class="gear-text">
			<div class="gear-name">
				{{ name }}
			</div>
			<div v-if="desc" class="gear-desc">
				{{ desc }}
			</div>
		</div>
	</div>
</div>
</template>

<style lang="scss" scoped>
.gear-card {
	display: flex;
	flex-direction: column;
	overflow: hidden; // 让满铺大图被圆角裁切
	border-radius: 0.6rem;
	box-shadow: var(--box-shadow-2);
	background-color: var(--ld-bg-card);
}

.gear-image {
	// 固定比例先占好高度，图到位前不跳；--lqip 由内联 style 提供
	aspect-ratio: 3 / 2;
	background-color: var(--c-bg-2);

	:deep(img) {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
}

.gear-body {
	// flex: 1 让正文吃满卡片剩余高度；当无图卡与大图卡同排被拉高时，
	// 配合 align-items: center 把图标+文字竖直居中，而非顶在上沿留空
	display: flex;
	flex: 1;
	align-items: center;
	gap: 0.6rem;
	padding: 0.6em 0.8em;
}

.gear-icon {
	flex-shrink: 0;
	color: var(--c-text-2);
}

// 无图卡：图标居左、较大
.gear-card:not(.has-image) .gear-icon {
	font-size: 1.6rem;
}

// 有图卡：图标缩成名称前小徽标
.gear-card.has-image .gear-icon {
	font-size: 1.1rem;
}

.gear-text {
	overflow: hidden;
}

.gear-name {
	font-weight: 600;
	line-height: 1.3;
}

.gear-desc {
	margin-top: 0.15em;
	font-size: 0.85em;
	line-height: 1.4;
	color: var(--c-text-2);
}
</style>
