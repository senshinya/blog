<script setup lang="ts">
import travels from '~/travels'

const appConfig = useAppConfig()

useSeoMeta({
	title: '游记',
	description: `${appConfig.title}的旅行记录：走过的地方、拍下的照片，和当时的心情。`,
})

const items = computed(() => travels.map(travel => ({
	...travel,
	photoCount: travel.days.reduce((sum, day) => sum + day.photos.length, 0),
})))
</script>

<template>
<template #aside>
	<TransitionGroup name="aside-widget">
		<WidgetBlogStats key="blog-stats" />
		<WidgetMemos key="memos" />
		<WidgetBlogTech key="blog-tech" />
	</TransitionGroup>
</template>

<div class="travels proper-height">
	<header class="travels-header">
		<h1 class="text-creative">
			游记
		</h1>
		<p class="travels-desc">
			走过的地方，和当时拍下的照片。
		</p>
	</header>

	<TransitionGroup tag="ol" class="travel-list" name="float-in">
		<li
			v-for="travel, index in items"
			:key="travel.slug"
			:style="getFixedDelay(index * 0.05)"
		>
			<NuxtLink class="travel-card card upraise" :to="`/travels/${travel.slug}`">
				<div class="travel-cover">
					<img
						:src="getTravelImg(travel.coverImage, TravelImgWidth.cover)"
						:alt="travel.title"
						loading="lazy"
						:style="getLqipStyle(travel.coverImage)"
					>
				</div>
				<article>
					<h2 class="travel-title text-creative">
						{{ travel.title }}
					</h2>
					<p class="travel-subtitle">
						{{ travel.subtitle }}
					</p>
					<p class="travel-summary">
						{{ travel.description }}
					</p>
					<p class="travel-meta">
						<span><Icon name="tabler:calendar" /> {{ travel.published }}</span>
						<span><Icon name="tabler:route" /> {{ travel.totaldays }} 天</span>
						<span><Icon name="tabler:photo" /> {{ travel.photoCount }} 张</span>
					</p>
				</article>
			</NuxtLink>
		</li>
	</TransitionGroup>
</div>
</template>

<style lang="scss" scoped>
.travels {
	padding: 1rem;
}

.travels-header {
	margin-bottom: 2rem;

	> h1 {
		font-size: 1.5rem;
	}
}

.travels-desc {
	color: var(--c-text-2);
}

.travel-list {
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
	list-style: none;
}

// 与文章卡片同构（components/post/Article.vue）：底色、圆角、hover 抬升全交给全局 .card.upraise，
// 这里只补封面的裁切和排版。
// 逐项错峰的 --delay 挂在外层 <li> 上，会一路渗到这棵子树 —— 所以子元素里的过渡时长
// 一律写死 0.2s，不能再用 var(--delay)：第一项的 delay 是 0s，hover 会当场瞬跳
.travel-card {
	container-type: inline-size;
	position: relative;

	// 封面宽度 = 卡片高 × 比例，而卡片高是被文字撑出来的 —— 描述短的游记会把封面一起压扁。
	// 给个下限兜住
	min-height: 12rem;
	color: var(--c-text);
	animation: float-in 0.2s var(--delay) backwards;

	> article {
		display: grid;
		gap: 0.5em;
		padding: 1em;
	}
}

// 封面盒子的比例。竖构图的照片按这个比例取景：越接近 1，图越宽、上下裁得越多；
// 越小（如 4/5）越接近原图，但也越窄。调这一个值即可
$cover-ratio: 1;

// 左缘模糊：半径，以及糊到多远就彻底淡干净。范围收得越紧，图保持清晰的部分越多
$cover-blur: 4px;
$cover-blur-end: 35%;

// 盒子必须严丝合缝地等于「画出来的那张图」，否则 mask 和模糊层会落空 ——
// 之前用 object-fit: contain 就栽在这：竖图被缩成盒子右侧窄窄一条，而 mask 是按盒子算的，
// 渐变早在图的左边的空白区里就走完了，图本体整个落在不透明、不模糊的区间，看着毫无效果。
// 改成「固定比例的盒子 + cover」：cover 保证图铺满盒子，盒子即图，渐变才有东西可作用。
// 另外外壳自身不能带 opacity / mask / filter —— 这三者任意一个都会让它变成 backdrop root，
// 里面的 ::after 就采样不到那张图，模糊层会糊在卡片底色上，等于什么都没糊。
// 故渐隐和 hover 提亮全部下沉到 > img
.travel-cover {
	position: absolute;
	inset-inline-end: 0;
	top: 0;
	height: 100%;
	max-width: calc(45% + 2em); // 卡片被文字撑得过高时，别让封面侵占文字区
	aspect-ratio: $cover-ratio; // 宽度 = 卡片高 × 比例

	> img {
		opacity: 0.8;
		width: 100%;
		height: 100%;
		margin: 0;
		mask-image: linear-gradient(to var(--end), transparent, #FFF 50%);
		transition: opacity 0.2s;
		object-fit: cover;
	}

	// 左缘的模糊渐变。backdrop-filter 糊的是「身下已经画好的东西」，也就是那张图；
	// 再给这层模糊自己套一道 mask，让它从左往右淡出 —— 于是模糊强度随位置连续变化，
	// 而不是糊完在某一列突然变清晰、留一条硬边。
	// 文字在 DOM 里排在封面之后（且 position: relative），画在这层之上，不会被糊到
	&::after {
		content: "";
		position: absolute;
		inset: 0;
		backdrop-filter: blur($cover-blur);
		mask-image: linear-gradient(to var(--end), #FFF, transparent $cover-blur-end);
		pointer-events: none;
	}

	:hover > & > img {
		opacity: 1;
	}

	& + article {
		position: relative;
		width: 60%;
	}

	// 窄屏放不下左右分栏：封面退回顶部通栏，文字压在它下缘的渐隐处。
	// 渐隐方向转成竖直，模糊也跟着转 —— 糊的边从左缘变成下缘
	@mixin cover-narrow {
		position: revert;
		width: 100%;
		height: auto;
		max-width: none;
		aspect-ratio: 2.4; // 通栏横幅：同样是盒子定比例、cover 铺满，盒子即图
		margin-bottom: -10%;

		> img {
			mask-image: linear-gradient(#FFF 50%, transparent);
		}

		&::after {
			// 与横向那支对称：从边缘起最糊，到 $cover-blur-end 的距离处淡干净
			mask-image: linear-gradient(transparent (100% - $cover-blur-end), #FFF);
		}

		& + article {
			width: auto;

			> .travel-title {
				text-shadow: 0 0 0.2em var(--ld-bg-card), 0 0 0.5em var(--ld-bg-card), 0 0 1em var(--ld-bg-card);
			}
		}
	}

	@media (max-width: $breakpoint-phone) {
		@include cover-narrow;
	}

	@container (max-width: #{$breakpoint-phone}) {
		@include cover-narrow;
	}
}

.travel-title {
	font-size: 1.2em;
	color: var(--c-text);
}

.travel-subtitle {
	font-size: 0.9em;
	color: var(--c-text-2);
}

.travel-summary {
	font-size: 0.9em;
	white-space: pre-line; // description 里的换行是作者排的分行，保住
	color: var(--c-text-2);
}

.travel-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5em clamp(1em, 5%, 1.5em);
	font-size: 0.8em;
	color: var(--c-text-2);

	> span {
		display: flex;
		align-items: center;
		gap: 0.3em;
	}
}
</style>
