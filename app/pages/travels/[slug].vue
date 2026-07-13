<script setup lang="ts">
import type { TravelPhoto } from '~/types/travel'
import { getTravelBySlug } from '~/travels'

definePageMeta({
	layout: false,
})

const route = useRoute()
const found = getTravelBySlug(route.params.slug as string)

if (!found) {
	throw createError({
		statusCode: 404,
		statusMessage: '游记不存在',
		fatal: true,
	})
}

// throw 之后类型已收窄，转存一个非空常量，省得后面到处写 travel!
const travel = found

useSeoMeta({
	title: travel.posttitle,
	description: travel.description,
	ogType: 'article',
	ogImage: travel.coverImage,
})

/** 被点开的那张照片；地图会飞过去。切小节时清空 */
const focusedPhoto = ref<TravelPhoto>()

function onPhotoFocus(photo: TravelPhoto) {
	focusedPhoto.value = photo
}

/** 只在「这一天的第一个小节」上打 Day 徽章 —— 同一天可能拆成好几节 */
function startsNewDay(index: number) {
	return index === 0 || travel.days[index]!.day !== travel.days[index - 1]!.day
}
</script>

<template>
<div class="travel">
	<NuxtLink class="travel-back" to="/travels">
		<Icon name="tabler:arrow-left" />
		游记
	</NuxtLink>

	<header class="travel-hero" :style="{ backgroundImage: `url(${travel.coverImage})` }">
		<div class="travel-hero-mask">
			<p class="travel-hero-badge">
				旅行日记
			</p>
			<h1 class="travel-hero-title">
				{{ travel.title }}
			</h1>
			<p class="travel-hero-subtitle">
				{{ travel.subtitle }}
			</p>
			<p class="travel-hero-desc">
				{{ travel.description }}
			</p>
			<p class="travel-hero-meta">
				<Icon name="tabler:route" />
				{{ travel.totaldays }} 天行程
			</p>
		</div>
		<Icon class="travel-hero-scroll" name="tabler:chevron-down" />
	</header>

	<div class="travel-body">
		<!-- 地图在下一步接进来 -->
		<aside class="travel-map-col" />

		<div class="travel-narrative">
			<section
				v-for="day, index in travel.days"
				:key="index"
				class="travel-section"
				:data-index="index"
			>
				<p v-if="startsNewDay(index)" class="travel-day-badge">
					Day {{ day.day }}
				</p>
				<h2 class="travel-day-title">
					{{ day.title }}
				</h2>

				<p v-for="text, i in day.descriptions" :key="i" class="travel-para">
					{{ text }}
				</p>

				<ol v-if="day.photos.length" class="travel-photos">
					<TravelPhotoCard
						v-for="photo in day.photos"
						:key="photo.src"
						:photo
						@focus="onPhotoFocus(photo)"
					/>
				</ol>
			</section>

			<footer class="travel-end">
				<p>—— 完 ——</p>
				<NuxtLink class="travel-end-link" to="/travels">
					回到游记列表
				</NuxtLink>
			</footer>
		</div>
	</div>
</div>
</template>

<style lang="scss" scoped>
.travel {
	background-color: var(--c-bg);
}

.travel-back {
	display: flex;
	align-items: center;
	gap: 0.3em;
	position: fixed;
	top: 1rem;
	left: 1rem;
	padding: 0.4em 0.9em;
	border: 1px solid var(--c-border);
	border-radius: 2em;
	box-shadow: var(--box-shadow-1);
	background-color: var(--c-bg-a80);
	backdrop-filter: blur(0.5rem);
	font-size: 0.9rem;
	color: var(--c-text-1);
	z-index: 3;

	&:hover {
		color: var(--c-primary);
	}
}

.travel-hero {
	display: flex;
	align-items: center;
	position: relative;
	height: 100dvh;
	background-position: center;
	background-size: cover;
}

.travel-hero-mask {
	width: 100%;
	padding: 3rem clamp(1.5rem, 8vw, 8rem);

	// 底图明暗未知，统一压一层深色蒙版保证文字对比度（故此处颜色不随主题变）
	background: linear-gradient(90deg, #000000B3, #00000059 60%, transparent);
	color: #FFF;
}

.travel-hero-badge {
	width: fit-content;
	margin-bottom: 1rem;
	padding: 0.3em 0.9em;
	border-radius: 2em;
	background-color: #FFFFFF26;
	font-size: 0.8rem;
	letter-spacing: 0.1em;
}

.travel-hero-title {
	font-size: clamp(2.5rem, 7vw, 5rem);
	line-height: 1.1;
}

.travel-hero-subtitle {
	margin-bottom: 1.5rem;
	font-size: clamp(1.2rem, 2.5vw, 2rem);
	color: #FFFFFFB3;
}

.travel-hero-desc {
	max-width: 32rem;
	line-height: 2;
	white-space: pre-line; // 作者手排的分行
	color: #FFFFFFE6;
}

.travel-hero-meta {
	display: flex;
	align-items: center;
	gap: 0.4em;
	margin-top: 2rem;
	font-size: 0.9rem;
	color: #FFFFFFB3;
}

.travel-hero-scroll {
	position: absolute;
	bottom: 2rem;
	left: 50%;
	font-size: 1.5rem;
	color: #FFFFFFB3;

	// 主题的 animation.scss 里只有 float-in（入场用），滚动提示要的是循环浮动，自带一个
	animation: travel-bob 2s ease-in-out infinite;
	translate: -50%;
}

@keyframes travel-bob {
	0%, 100% {
		transform: translateY(0);
	}

	50% {
		transform: translateY(0.4rem);
	}
}

.travel-body {
	display: grid;
	grid-template-columns: minmax(0, 55fr) minmax(0, 45fr);
}

.travel-map-col {
	order: 2; // 叙事在左、地图在右；但 DOM 里地图在前，移动端才好吸顶
	position: sticky;
	top: 0;
	height: 100dvh;
}

.travel-narrative {
	padding: clamp(2rem, 5vw, 5rem) clamp(1.5rem, 4vw, 4rem);
}

.travel-section {
	padding: 3rem 0;

	& + .travel-section {
		border-top: 1px solid var(--c-border);
	}
}

.travel-day-badge {
	width: fit-content;
	margin-bottom: 0.8rem;
	padding: 0.25em 0.8em;
	border-radius: 2em;
	background-color: var(--c-primary-soft);
	font-size: 0.75rem;
	letter-spacing: 0.08em;
	color: var(--c-primary);
}

.travel-day-title {
	margin-bottom: 1.5rem;
	font-size: clamp(1.5rem, 3vw, 2.2rem);
	line-height: 1.3;
}

.travel-para {
	margin-bottom: 1.2rem;
	line-height: 2;
	color: var(--c-text-1);
}

.travel-photos {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
	gap: 0.8rem;
	margin-top: 2rem;
	list-style: none;
}

.travel-end {
	padding: 4rem 0 6rem;
	text-align: center;
	color: var(--c-text-3);
}

.travel-end-link {
	display: inline-block;
	margin-top: 1rem;
	color: var(--c-primary);

	&:hover {
		text-decoration: underline;
	}
}

@media (max-width: $breakpoint-mobile) {
	// 单列：地图改为吸顶条。这里必须是 block 而不是 grid ——
	// grid item 的 sticky 只在自己那一行的范围内生效，一滚就跑没了
	.travel-body {
		display: block;
	}

	.travel-map-col {
		height: 35vh;
		z-index: 2;
	}

	.travel-narrative {
		padding: 1rem;
	}
}
</style>
