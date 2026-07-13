<script setup lang="ts">
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

const photoCount = travel.days.reduce((sum, day) => sum + day.photos.length, 0)

/** 当前这一屏；-1 是封面屏 */
const activeIndex = ref(-1)

// 声明放在这里而不是挨着 onMounted：stepPhoto 跨天翻图时要用 screens 去滚动定位，
// 而它在下面，声明晚了会触发 no-use-before-define
const scroller = useTemplateRef<HTMLElement>('scroller')
const screens = ref<HTMLElement[]>([])

// ── 看图器 ──
// 不用全站那个灯箱：它是整屏遮罩，一弹出就把右边的地图盖住了，
// 「看大图」和「看这张拍在哪」两件事互相打架。这里的看图器只占叙事列，
// 地图留在原地继续飞。
const viewerScreen = ref(0)
const viewerIndex = ref(0)
const viewerOpen = ref(false)

const viewerPhotos = computed(() => travel.days[viewerScreen.value]?.photos ?? [])
const viewerPhoto = computed(() => viewerPhotos.value[viewerIndex.value])

/** 地图要聚焦的照片：看图器开着时就是它正在看的那张 */
const focusedPhoto = computed(() => viewerOpen.value ? viewerPhoto.value : undefined)

function openViewer(screen: number, index: number) {
	viewerScreen.value = screen
	viewerIndex.value = index
	viewerOpen.value = true
}

function closeViewer() {
	viewerOpen.value = false
}

function stepPhoto(delta: number) {
	const next = viewerIndex.value + delta

	// 还在这一天之内，翻页就完事
	if (next >= 0 && next < viewerPhotos.value.length) {
		viewerIndex.value = next
		return
	}

	// 翻过了这一天的头尾：接着串到相邻那一天，不用退出看图模式
	const nextScreen = viewerScreen.value + (delta > 0 ? 1 : -1)
	const photos = travel.days[nextScreen]?.photos
	if (!photos?.length)
		return // 整篇的第一张之前 / 最后一张之后，到头了

	viewerScreen.value = nextScreen
	viewerIndex.value = delta > 0 ? 0 : photos.length - 1

	// 底下的页面也跟着翻到这一天：否则关掉看图器会发现自己还停在上一天
	activeIndex.value = nextScreen
	screens.value
		.find(screen => screen.dataset.index === String(nextScreen))
		?.scrollIntoView({ block: 'start' })
}

// 看图时滚轮不翻屏，而是一张一张翻照片。
//
// 按「手势」而不是按事件计数：触控板一次轻划会连发几十个 wheel 事件，惯性余波还能
// 再拖一秒多。固定冷却时间挡不住（实测一划仍会翻掉好几张），所以改成：
// 手势的第一个事件翻一张，随后一直锁着，直到 wheel 事件安静 150ms —— 那才算这一划结束。
let wheelLocked = false
let wheelQuiet: ReturnType<typeof setTimeout>

function onViewerWheel(event: WheelEvent) {
	if (Math.abs(event.deltaY) < 4)
		return

	clearTimeout(wheelQuiet)
	wheelQuiet = setTimeout(() => wheelLocked = false, 150)

	if (wheelLocked)
		return

	wheelLocked = true
	stepPhoto(event.deltaY > 0 ? 1 : -1)
}

// 触屏：上下滑一次翻一张
let touchStartY = 0

function onViewerTouchStart(event: TouchEvent) {
	touchStartY = event.changedTouches[0]?.clientY ?? 0
}

function onViewerTouchEnd(event: TouchEvent) {
	const delta = touchStartY - (event.changedTouches[0]?.clientY ?? 0)
	if (Math.abs(delta) > 40)
		stepPhoto(delta > 0 ? 1 : -1)
}

onKeyStroke('Escape', () => viewerOpen.value && closeViewer())
onKeyStroke(['ArrowLeft', 'ArrowUp'], (e) => {
	if (!viewerOpen.value)
		return
	e.preventDefault() // 否则方向键会同时把整屏也翻过去
	stepPhoto(-1)
})
onKeyStroke(['ArrowRight', 'ArrowDown'], (e) => {
	if (!viewerOpen.value)
		return
	e.preventDefault()
	stepPhoto(1)
})

/** 窄屏上地图是吸顶条，占着一截高度，给个收起开关 */
const mapCollapsed = ref(false)

// 封面屏是静态元素、日子屏是 v-for 出来的，两者不能共用一个 ref 名
// （v-for 的 ref 收集成数组，静态 ref 会把它覆盖掉）。统一在挂载后查一次 DOM。
onMounted(() => {
	screens.value = Array.from(
		scroller.value?.querySelectorAll<HTMLElement>('[data-index]') ?? [],
	)
})

// rootMargin 把观察区压成视口中间的一条窄带：谁穿过这条带子，谁就是「当前屏」。
// 每屏恰好一个视口高，居中判定最稳。
useIntersectionObserver(
	screens,
	(entries) => {
		for (const entry of entries) {
			if (!entry.isIntersecting)
				continue

			const index = Number((entry.target as HTMLElement).dataset.index)
			if (Number.isNaN(index) || index === activeIndex.value)
				continue

			// 不用在这里清聚焦：聚焦由看图器决定，而看图器开着时页面是锁住不翻屏的
			activeIndex.value = index
		}
	},
	{ rootMargin: '-45% 0px -45% 0px' },
)

/**
 * 喂给地图的照片：封面屏给全程（开场先亮出整趟路线的轮廓），之后只给当前这一天。
 *
 * 看图时直接认看图器所在的那一天 —— 一路翻到下一天时，地图要立刻跟着换掉标记，
 * 不能等 IntersectionObserver 那一拍。
 */
const mapPhotos = computed(() => {
	if (viewerOpen.value)
		return viewerPhotos.value

	return activeIndex.value < 0
		? travel.days.flatMap(day => day.photos)
		: travel.days[activeIndex.value]?.photos ?? []
})

/** 只在「这一天的第一屏」上打 Day 徽章 —— 同一天可能拆成好几屏 */
function startsNewDay(index: number) {
	return index === 0 || travel.days[index]!.day !== travel.days[index - 1]!.day
}
</script>

<template>
<div ref="scroller" class="travel" :class="{ 'viewer-open': viewerOpen }">
	<NuxtLink class="travel-back" to="/travels">
		<Icon name="tabler:arrow-left" />
		游记
	</NuxtLink>

	<div class="travel-body" :class="{ 'map-collapsed': mapCollapsed }">
		<aside class="travel-map-col">
			<ClientOnly>
				<TravelMap :photos="mapPhotos" :focus="focusedPhoto" />
			</ClientOnly>
			<button
				class="travel-map-toggle mobile-only"
				:aria-label="mapCollapsed ? '展开地图' : '收起地图'"
				@click="mapCollapsed = !mapCollapsed"
			>
				<Icon :name="mapCollapsed ? 'tabler:map' : 'tabler:chevron-up'" />
			</button>
		</aside>

		<main class="travel-screens">
			<!-- 封面屏：封面图整幅铺在这一屏做背景，压暗到能压住文字，不裁成卡片 -->
			<section
				class="travel-screen travel-cover"
				data-index="-1"
				:style="{ backgroundImage: `url(${getTravelImg(travel.coverImage, TravelImgWidth.hero)})` }"
			>
				<div class="travel-cover-text">
					<p class="travel-cover-badge">
						旅行日记
					</p>
					<h1 class="travel-cover-title">
						{{ travel.title }}
					</h1>
					<p class="travel-cover-subtitle">
						{{ travel.subtitle }}
					</p>
					<p class="travel-cover-desc">
						{{ travel.description }}
					</p>
					<p class="travel-cover-meta">
						<span><Icon name="tabler:route" /> {{ travel.totaldays }} 天行程</span>
						<span><Icon name="tabler:photo" /> {{ photoCount }} 张照片</span>
						<span><Icon name="tabler:calendar" /> {{ travel.published }}</span>
					</p>
				</div>

				<Icon class="travel-scroll-hint" name="tabler:chevron-down" />
			</section>

			<!-- 一天一屏：标题钉在屏顶，正文和照片在屏内滚动，绝不溢到下一屏 -->
			<section
				v-for="day, index in travel.days"
				:key="index"
				class="travel-screen travel-day"
				:data-index="index"
			>
				<header class="travel-day-head">
					<p v-if="startsNewDay(index)" class="travel-badge travel-day-badge">
						Day {{ day.day }}
					</p>
					<h2 class="travel-day-title">
						{{ day.title }}
					</h2>
				</header>

				<div class="travel-day-content scrollbar-hidden">
					<p v-for="text, i in day.descriptions" :key="i" class="travel-para">
						{{ text }}
					</p>

					<ol v-if="day.photos.length" class="travel-photos">
						<TravelPhotoCard
							v-for="photo, i in day.photos"
							:key="photo.src"
							:photo
							@open="openViewer(index, i)"
						/>
					</ol>
				</div>

				<p class="travel-progress">
					{{ index + 1 }} / {{ travel.days.length }}
				</p>
			</section>

			<!-- 结束屏 -->
			<section class="travel-screen travel-end">
				<p class="travel-end-mark">
					—— 完 ——
				</p>
				<NuxtLink class="travel-end-link" to="/travels">
					回到游记列表
				</NuxtLink>
			</section>
		</main>

		<!-- 看图器：只盖住叙事列，右边的地图照常跟着当前这张照片飞 -->
		<Transition name="travel-viewer">
			<div
				v-if="viewerOpen && viewerPhoto"
				class="travel-viewer"
				@click.self="closeViewer"
				@wheel.prevent="onViewerWheel"
				@touchstart.passive="onViewerTouchStart"
				@touchend.passive="onViewerTouchEnd"
			>
				<button class="travel-viewer-close" aria-label="关闭大图" @click="closeViewer">
					<Icon name="tabler:x" />
				</button>

				<!--
					figcaption 只能是 figure 的子元素，故补上这层 figure —— 之前它直接躺在 div 里，
					是无效 HTML，浏览器根本不给它 figcaption 语义，还会警告水合风险。
					figure 上挂 display: contents（见样式），不生成盒子，img 和 figcaption 仍是
					.travel-viewer 的直接 flex 子项，布局一点不动。
				-->
				<figure class="travel-viewer-figure">
					<!--
						width / height 是这里唯一真正修布局跳变的东西：这张图只有 max-width/max-height，
						没有任何内在尺寸，加载前是 0×0，加载完突然撑开，把底下的图题和翻页条一起顶下去。
						（游记别处的图都有 aspect-ratio 的盒子兜着，不跳；正文那 37 张则跳得更凶。）
						--lqip 只是在占好的位置上先糊一层主色，它本身修不了跳变。
					-->
					<img
						:key="viewerPhoto.src"
						class="travel-viewer-img"
						:src="getTravelImg(viewerPhoto.src, TravelImgWidth.viewer)"
						:alt="viewerPhoto.alt"
						:width="getImgMeta(viewerPhoto.src)?.w"
						:height="getImgMeta(viewerPhoto.src)?.h"
						:style="getLqipStyle(viewerPhoto.src)"
					>

					<figcaption class="travel-viewer-caption">
						{{ viewerPhoto.caption || viewerPhoto.alt }}
					</figcaption>
				</figure>

				<div class="travel-viewer-bar">
					<button
						aria-label="上一张"
						:disabled="viewerIndex === 0"
						@click="stepPhoto(-1)"
					>
						<Icon name="tabler:chevron-left" />
					</button>
					<span class="travel-viewer-count">
						{{ viewerIndex + 1 }} / {{ viewerPhotos.length }}
					</span>
					<button
						aria-label="下一张"
						:disabled="viewerIndex === viewerPhotos.length - 1"
						@click="stepPhoto(1)"
					>
						<Icon name="tabler:chevron-right" />
					</button>
				</div>
			</div>
		</Transition>
	</div>
</div>
</template>

<style lang="scss" scoped>
.travel {
	overflow-y: auto;

	// 页面自己当滚动容器：整页吸附靠它，不必去改全局 html/body 的样式
	height: 100dvh;
	background-color: var(--c-bg);
	scroll-snap-type: y mandatory;

	// 看图时锁住翻屏：滚轮改为一张一张翻照片（见 onViewerWheel）
	&.viewer-open {
		overflow: hidden;
	}
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
	box-shadow: var(--box-shadow-2);

	// 不透明：正文会从它底下滚过去，半透明的话内容会透出来糊成一团
	background-color: var(--ld-bg-card);
	font-size: 0.9rem;
	color: var(--c-text-1);
	z-index: 3;

	&:hover {
		color: var(--c-primary);
	}
}

.travel-body {
	// 桌面端地图在右侧独立成列，不占屏幕的垂直空间
	--travel-map-h: 0px;

	display: grid;
	grid-template-columns: minmax(0, 55fr) minmax(0, 45fr);
}

.travel-map-col {
	order: 2; // 叙事在左、地图在右；但 DOM 里地图在前，移动端才好吸顶
	position: sticky;
	top: 0;
	height: 100dvh;
}

.travel-map-toggle {
	display: none; // 桌面端地图常驻，不需要开关
}

.travel-screen {
	// 一屏一天：高度锁死一个视口，滚动只会停在整屏上，屏与屏的内容不会同框
	display: flex;
	flex-direction: column;
	height: calc(100dvh - var(--travel-map-h));
	padding: clamp(2rem, 4vw, 4rem) clamp(1.5rem, 4vw, 4rem);
	scroll-margin-top: var(--travel-map-h);
	scroll-snap-align: start;
	scroll-snap-stop: always; // 一次滚动只翻一屏，不许一口气飞过好几天
}

/* ── 封面屏 ── */

.travel-cover {
	justify-content: center;
	position: relative;
	background-position: center;
	background-size: cover;

	// 文字直接压在封面图上，颜色不跟主题走（底图明暗未知）
	color: #FFF;

	// 压暗：左侧最重，保证标题和正文的可读性；右侧留亮，让照片本身还看得见
	&::before {
		content: "";
		position: absolute;
		inset: 0;
		background: linear-gradient(90deg, #000000D9, #000000A6 55%, #00000059);
	}
}

.travel-cover-text {
	position: relative; // 压在遮罩之上
	z-index: 1;
}

.travel-cover-badge {
	width: fit-content;
	padding: 0.25em 0.8em;
	border-radius: 2em;
	background-color: #FFFFFF2E;
	font-size: 0.75rem;
	letter-spacing: 0.08em;
}

.travel-cover-title {
	margin-top: 0.8rem;
	font-size: clamp(2.2rem, 5vw, 3.6rem);
	line-height: 1.15;
}

.travel-cover-subtitle {
	font-size: clamp(1rem, 1.6vw, 1.3rem);
	color: #FFFFFFB3;
}

.travel-cover-desc {
	max-width: 32rem;
	margin-top: 1.2rem;
	line-height: 2;
	white-space: pre-line; // 作者手排的分行
	color: #FFFFFFE6;
}

.travel-cover-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 1.2rem;
	margin-top: 1.5rem;
	font-size: 0.85rem;
	color: #FFFFFFB3;

	> span {
		display: flex;
		align-items: center;
		gap: 0.35em;
	}
}

.travel-scroll-hint {
	position: absolute;
	bottom: 1.2rem;
	left: 50%;
	font-size: 1.5rem;
	color: #FFFFFFB3;
	animation: travel-bob 2s ease-in-out infinite;
	translate: -50%;
	z-index: 1;
}

// 主题的 animation.scss 里只有入场用的 float-in，滚动提示要的是循环浮动，自带一个
@keyframes travel-bob {
	0%, 100% {
		transform: translateY(0);
	}

	50% {
		transform: translateY(0.4rem);
	}
}

/* ── 每天一屏 ── */

.travel-day-head {
	flex-shrink: 0; // 标题钉在屏顶，只有下面的正文滚
	padding-bottom: 1rem;
}

.travel-day-badge {
	width: fit-content;
	margin-bottom: 0.6rem;
	padding: 0.25em 0.8em;
	border-radius: 2em;
	background-color: var(--c-primary-soft);
	font-size: 0.75rem;
	letter-spacing: 0.08em;
	color: var(--c-primary);
}

.travel-day-title {
	font-size: clamp(1.4rem, 2.6vw, 2.1rem);
	line-height: 1.3;
}

.travel-day-content {
	flex: 1;
	overflow-y: auto;
	min-height: 0; // 不加这条，flex 子项不肯收缩，内滚就失效
	overscroll-behavior-y: auto; // 内层滚到底后，把滚动交还给外层去翻下一屏
}

.travel-para {
	margin-bottom: 1.2rem;
	line-height: 2;
	color: var(--c-text-1);
}

.travel-photos {
	display: grid;

	// 照片是这页的主角，缩略图给足尺寸；一屏放不下的部分在屏内滚动
	grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
	gap: 0.8rem;
	margin-top: 1.5rem;
	padding-bottom: 0.5rem;
	list-style: none;
}

.travel-progress {
	flex-shrink: 0;
	padding-top: 0.8rem;
	font-size: 0.75rem;
	text-align: center;
	color: var(--c-text-3);
	font-variant-numeric: tabular-nums;
}

/* ── 看图器 ── */

.travel-viewer {
	// 只盖叙事列（栅格是 55fr / 45fr），右边 45% 留给地图 ——
	// 用整屏遮罩的话，「看大图」和「看这张拍在哪」就互相盖住了
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 1rem;
	position: fixed;
	inset: 0 45% 0 0;
	padding: 3rem 2rem 2rem;
	background-color: var(--c-bg-a80);
	backdrop-filter: blur(1rem) saturate(1.6);
	z-index: 4;
}

// 只为让 figcaption 有个合法的父元素，不参与布局。
// 不能让它生成盒子：.travel-viewer-img 的 max-height: 100% 要有一个「高度确定」的父元素才算得出来，
// 而 .travel-viewer 是 position: fixed + inset，高度是确定的。中间插一个高度由内容撑起（auto）的
// figure，那个百分比就会解析成 none，图会当场撑破容器。
// display: contents 让 figure 不生成盒子，img 和 figcaption 仍是 .travel-viewer 的直接 flex 子项 ——
// 连 gap: 1rem 都照常落在它们之间，布局一个像素都不动
.travel-viewer-figure {
	display: contents;
}

.travel-viewer-img {
	min-height: 0; // 让 flex 能把图压回容器内，而不是撑破
	max-width: 100%;
	max-height: 100%;
	border-radius: 0.6rem;
	box-shadow: var(--box-shadow-3);
	animation: float-in var(--delay) backwards;
	object-fit: contain;
}

.travel-viewer-caption {
	flex-shrink: 0;
	max-width: 34rem;
	font-size: 0.85rem;
	line-height: 1.8;
	text-align: center;
	color: var(--c-text-2);
}

.travel-viewer-bar {
	display: flex;
	flex-shrink: 0;
	align-items: center;
	gap: 0.5rem;
	padding: 0.3rem;
	border: 1px solid var(--c-border);
	border-radius: 2em;
	box-shadow: var(--box-shadow-1);
	background-color: var(--ld-bg-card);

	> button {
		display: flex;
		padding: 0.4em;
		border-radius: 50%;
		color: var(--c-text-2);

		&:hover:not(:disabled) {
			background-color: var(--c-primary-soft);
			color: var(--c-primary);
		}

		&:disabled {
			opacity: 0.3;
			cursor: not-allowed;
		}
	}
}

.travel-viewer-count {
	font-size: 0.8rem;
	color: var(--c-text-3);
	font-variant-numeric: tabular-nums;
}

.travel-viewer-close {
	display: flex;
	position: absolute;
	top: 1rem;
	right: 1rem;
	padding: 0.4em;
	border: 1px solid var(--c-border);
	border-radius: 50%;
	background-color: var(--ld-bg-card);
	color: var(--c-text-2);

	&:hover {
		color: var(--c-primary);
	}
}

.travel-viewer-enter-active,
.travel-viewer-leave-active {
	transition: opacity var(--delay);
}

.travel-viewer-enter-from,
.travel-viewer-leave-to {
	opacity: 0;
}

/* ── 结束屏 ── */

.travel-end {
	align-items: center;
	justify-content: center;
	gap: 1rem;
	color: var(--c-text-3);
}

.travel-end-link {
	color: var(--c-primary);

	&:hover {
		text-decoration: underline;
	}
}

@media (max-width: $breakpoint-mobile) {
	// 单列：地图改为吸顶条。这里必须是 block 而不是 grid ——
	// grid item 的 sticky 只在自己那一行的范围内生效，一滚就跑没了
	.travel-body {
		--travel-map-h: 35vh;

		display: block;
	}

	// 地图收起时，每屏能用的高度跟着长回来
	.travel-body.map-collapsed {
		--travel-map-h: 2.5rem;
	}

	.travel-map-col {
		height: var(--travel-map-h);
		border-bottom: 1px solid var(--c-border);
		transition: height var(--delay);
		z-index: 2;
	}

	.travel-map-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		position: absolute;
		right: 0.6rem;
		bottom: 0.6rem;
		width: 2rem;
		height: 2rem;
		border: 1px solid var(--c-border);
		border-radius: 50%;
		box-shadow: var(--box-shadow-1);
		background-color: var(--ld-bg-card);
		color: var(--c-text-1);
		z-index: 3;
	}

	.travel-screen {
		padding: 1.2rem 1rem;
	}

	// 窄屏放不下 13rem 两列，退到两列小图
	.travel-photos {
		grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
	}

	// 窄屏没有右侧列：看图器改为让出顶部那条地图，地图照样跟着照片飞
	.travel-viewer {
		inset: var(--travel-map-h) 0 0;
		padding: 3rem 1rem 1.5rem;
	}
}
</style>
