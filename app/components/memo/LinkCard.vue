<script setup lang="ts">
/**
 * memo 正文里「独占一行的裸链接」渲染成的预览卡。
 *
 * 三个状态共用一套尺寸：打底（域名 + 路径 + favicon）、抓到（标题 + 描述 + og:image）、
 * 抓不到（停在打底）。碎语列表一屏能滚过二十条，卡片若在数据回来时改变高度，
 * 每张都会把下文顶一次，滚动位置整屏乱跳。故高度写死，只换里头的内容。
 */
const props = defineProps<{ url: string }>()

const cardEl = useTemplateRef('card')
// 视口内才去抓：外站元数据要经 /api/og 代取，一页 20 条全拉没必要
const visible = useElementVisibility(cardEl)
const og = useOgData(() => props.url, visible)

const domain = computed(() => getDomain(props.url))

/**
 * 打底时的副标题：域名之后那一截路径。
 *
 * 指向站点首页的链接没有路径可显示，退回域名本身，免得留一条空行把版面掏空。
 */
const fallbackDescription = computed(() => {
	try {
		const { pathname, search } = new URL(props.url)
		const rest = safelyDecodeUriComponent(pathname + search)
		return rest === '/' ? domain.value : rest
	}
	catch {
		return props.url
	}
})

const title = computed(() => og.value.title || domain.value)
const description = computed(() => og.value.description || og.value.siteName || fallbackDescription.value)

/** og:image 自己加载失败（403、图挂了）时退回 favicon，而不是留一个破图标 */
const imageBroken = ref(false)
watch(() => og.value.image, () => imageBroken.value = false)

const hasPreview = computed(() => !!og.value.image && !imageBroken.value)
const thumbnail = computed(() => hasPreview.value
	// 缩略格实际只有 5rem 宽，二倍屏也就 160px，没必要把 1200×630 的原图搬回来
	? getOgImgUrl(og.value.image!, 160)
	// unavatar 对任意域名都能出图，比 getDomainIcon 那张写死的映射表覆盖面大得多
	: getFavicon(domain.value, { size: 128 }))
</script>

<template>
<!-- 刻意不挂 title 属性。content/LinkCard 那边挂了，但它的描述是手写的短句；
	这边接的是 OG 描述（可达 400 字）再拼上完整 URL，原生 tooltip 会糊掉半屏。
	卡面上标题和描述本就看得见，目的地浏览器也会显示在状态栏，没什么可补的 -->
<UtilLink
	ref="card"
	:to="url"
	class="memo-link-card"
>
	<div class="info">
		<div class="link-title">
			{{ title }}
		</div>
		<div class="link-description">
			{{ description }}
		</div>
	</div>

	<div class="thumbnail" :class="{ preview: hasPreview }">
		<img
			:src="thumbnail"
			alt=""
			loading="lazy"
			referrerpolicy="no-referrer"
			@error="imageBroken = true"
		>
	</div>
</UtilLink>
</template>

<style lang="scss" scoped>
// 描边而非实心卡：碎语卡本身就是 1px 环（见 MemoCard），
// 里头再套一张带底色和投影的实心卡会压过正文
.memo-link-card {
	display: flex;
	align-items: center;
	gap: 0.8rem;
	overflow: hidden;

	// 用 rem 而非 em：卡片自身是 0.9em 字号，写 em 的话间距会跟着缩水一成，
	// 数值与看到的效果对不上。
	// 相邻两张卡的外边距会合并，故卡与卡、卡与正文之间都是这一个值
	margin: 0.9rem 0;
	padding: 0.6rem;
	border-radius: 8px;
	box-shadow: 0 0 0 1px var(--c-bg-soft);
	font-size: 0.9em;
	line-height: 1.4;
	transition: box-shadow 0.2s, background-color 0.2s;

	// 与 MemoCard 里 reaction chip 的 hover 同一套（描边转主色 + 主色淡底）。
	// 项目没有全局的 focus-visible 兜底，各组件自己管，故键盘态要一并写上，
	// 否则 Tab 过来只剩浏览器默认轮廓
	&:hover, &:focus-visible {
		box-shadow: 0 0 0 1px var(--c-primary);
		background-color: var(--c-primary-soft);
	}
}

.info {
	flex-grow: 1;
	overflow: hidden;
}

// 两行封顶。标题长短各站差异极大，不封顶会把卡片撑成一段文章
.link-title {
	display: -webkit-box;
	overflow: hidden;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	line-clamp: 2;
	color: var(--c-text);
}

// 单行省略。这里放的是描述或路径，两者都可能很长
.link-description {
	overflow: hidden;
	margin-top: 0.2em;
	font-size: 0.85em;
	white-space: nowrap;
	text-overflow: ellipsis;
	color: var(--c-text-3);
}

// 尺寸写死，三个状态同一个格子 —— 这是「数据回来不抽动版面」的关键
.thumbnail {
	display: flex;
	flex-shrink: 0;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	width: 5rem;
	height: 4rem;
	border-radius: 6px;
	background-color: var(--c-bg-2);

	> img {
		// 打底态放的是 favicon：小方图标，居中摆着即可，撑满只会糊成一片
		width: 2rem;
		height: 2rem;
		object-fit: contain;
	}

	// 抓到 og:image 才填满整格
	&.preview > img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
}
</style>
