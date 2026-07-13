<script setup lang="ts">
import type { Map as MapLibreMap, Marker } from 'maplibre-gl'
import type { TravelPhoto } from '~/types/travel'
// 样式静态引入：它会跟着本组件的 CSS chunk 走，只有游记详情页会加载。
// 不用 await import(...css)：Vite 的依赖预打包偶尔会让这条动态 CSS 路径取不到模块。
import 'maplibre-gl/dist/maplibre-gl.css'

const props = defineProps<{
	photos: TravelPhoto[]
	focus?: TravelPhoto
}>()

/**
 * 底图沿用 mapcn（https://www.mapcn.dev/）的路子：MapLibre + 免 key 瓦片 + 明暗两套样式。
 * mapcn 本身是 React-only 的 copy-paste 组件库，这里在 Vue 里复刻它的方案，不引入 React。
 *
 * CARTO 的 positron / dark-matter 无需 API key。想换 OpenFreeMap 只改这两行。
 */
const STYLE = {
	light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
	dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
}

/**
 * 中文优先的标签。
 *
 * 瓦片里本来就带 name:zh（北京那块能取到「丰镇市」「京台高速」），是 CARTO 的样式没去读它 ——
 * 它把 text-field 写死成 {name_en}（低缩放）和 {name}（高缩放），于是中国地名一路显示成英文。
 * 这里不换底图，只在样式装载后把标签图层的 text-field 重写掉。
 *
 * 退到 name（本地名）而不是直接退到拉丁名：日本地名缺 name:zh 时，「清水寺」比「Kiyomizu-dera」好读。
 * CJK 字形由 MapLibre 的 localIdeographFontFamily（默认 sans-serif）在本地渲染，不向字形服务器要 ——
 * 所以中文标签既不额外耗带宽，也不用配字体。
 */
const LABEL_FIELD = ['coalesce', ['get', 'name:zh'], ['get', 'name'], ['get', 'name:latin']]

const container = useTemplateRef<HTMLElement>('container')
const colorMode = useColorMode()

let maplibre: typeof import('maplibre-gl') | undefined
let map: MapLibreMap | undefined
/** 照片 → 标记：focus 时要按照片反查标记来开 popup */
let markers = new Map<TravelPhoto, Marker>()

const ready = ref(false)
/** 地图起不来（浏览器没有 WebGL、GPU 被拉黑等）。降级成一句提示，不能连累整篇游记 */
const failed = ref(false)

function styleUrl() {
	return colorMode.value === 'dark' ? STYLE.dark : STYLE.light
}

/** 把当前样式里所有地名标签换成中文优先。样式一换（换肤）就得重放一次 */
function localizeLabels() {
	if (!map)
		return

	for (const layer of map.getStyle().layers) {
		if (layer.type !== 'symbol')
			continue

		const field = layer.layout?.['text-field']
		if (!field)
			continue

		// 只动画地名的图层。门牌号图层的 text-field 是 {housenumber}，跟 name 无关，
		// 一并重写会让三个 name 字段全取空，门牌号当场消失
		if (!JSON.stringify(field).includes('name'))
			continue

		map.setLayoutProperty(layer.id, 'text-field', LABEL_FIELD)
	}
}

function geoPhotos() {
	return props.photos.filter(photo => photo.lat != null && photo.lng != null)
}

/**
 * popup 里是一张缩略图 + 图题。MapLibre 只吃 DOM 节点，故手工拼。
 *
 * 这里**故意不给 img 赋 src** —— 赋 src 的那一刻浏览器就开始下载了（此时 loading 还是
 * 默认的 eager，之后再补 loading='lazy' 也拦不住已经在飞的请求）。而 renderPhotos 会给
 * 每张照片都建一个 popup：封面屏那一下要建 49 个，等于把整趟旅程的原图（27 MB，都是
 * 4000px 以上的相机原片）全部预载一遍，把 PhotoCard 那边辛苦做的 lazy 整个抵消掉。
 *
 * src 留到 popup 真正打开时再补（见 renderPhotos）。样式里给了 aspect-ratio，
 * 所以没有 src 时占位尺寸也是对的，图到位不会把 popup 撑得跳一下。
 */
function popupContent(photo: TravelPhoto) {
	const figure = document.createElement('figure')
	figure.className = 'travel-popup'

	const img = document.createElement('img')
	img.alt = photo.alt

	// 占位色。CSS 那条规则是按 [style*="--lqip:"] 命中的，setProperty 写出来的正是这个形状
	const meta = getImgMeta(photo.src)
	if (meta)
		img.style.setProperty('--lqip', `#${meta.lqip}`)

	const caption = document.createElement('figcaption')
	caption.textContent = photo.alt

	figure.append(img, caption)
	return { figure, img }
}

function clearMarkers() {
	markers.forEach(marker => marker.remove())
	markers = new Map()
}

/** 收掉所有已打开的 popup —— 同一时刻只该有当前这张照片的那一个 */
function closePopups() {
	markers.forEach((marker) => {
		if (marker.getPopup()?.isOpen())
			marker.togglePopup()
	})
}

/** 把视野收回到当前这批照片的范围 */
function fitToPhotos() {
	if (!map || !maplibre)
		return

	const photos = geoPhotos()
	if (!photos.length)
		return

	const bounds = new maplibre.LngLatBounds()
	for (const photo of photos)
		bounds.extend([photo.lng!, photo.lat!])

	map.fitBounds(bounds, { padding: 72, maxZoom: 15, duration: 1200 })
}

/** 换一批照片：重建标记，并把视野收到这批照片的范围 */
function renderPhotos() {
	if (!map || !maplibre)
		return

	clearMarkers()

	const photos = geoPhotos()
	if (!photos.length)
		return // 这一屏没有带坐标的照片：保持上一次的视野，不乱飞

	const bounds = new maplibre.LngLatBounds()

	for (const photo of photos) {
		// 外层交给 MapLibre 定位（它会往上面写 transform: translate(...)），
		// 视觉和 hover 缩放全放在内层 —— 直接给外层加 scale 会跟那个 transform 叠加，
		// 点会当场从坐标上弹开
		const element = document.createElement('div')
		element.className = 'travel-marker'

		const dot = document.createElement('button')
		dot.type = 'button'
		dot.className = 'travel-marker-dot'
		dot.setAttribute('aria-label', photo.alt)
		element.append(dot)

		const { figure, img } = popupContent(photo)

		const popup = new maplibre.Popup({
			offset: 14,
			closeButton: false,
			maxWidth: '15rem',
		}).setDOMContent(figure)

		// 到这一刻才真去取图。once 就够：popup 关掉再开时 MapLibre 留着同一份 DOM，
		// img 上的 src 还在，不必重设
		popup.once('open', () => {
			img.src = getTravelImg(photo.src, TravelImgWidth.popup)
		})

		const marker = new maplibre.Marker({ element })
			.setLngLat([photo.lng!, photo.lat!])
			.setPopup(popup)
			.addTo(map)

		markers.set(photo, marker)
		bounds.extend([photo.lng!, photo.lat!])
	}

	map.fitBounds(bounds, { padding: 72, maxZoom: 15, duration: 1200 })
}

/** 聚焦单张照片：飞过去，并且只留它自己的 popup */
function focusPhoto(photo: TravelPhoto) {
	if (!map || photo.lat == null || photo.lng == null)
		return

	map.flyTo({
		center: [photo.lng, photo.lat],
		zoom: 16,
		duration: 1200,
	})

	// 先收掉上一张的 popup，否则一路翻下去会在地图上堆一片弹窗
	closePopups()

	const marker = markers.get(photo)
	if (marker && !marker.getPopup()?.isOpen())
		marker.togglePopup()
}

onMounted(async () => {
	// try/catch 不是防御性摆设：MapLibre 拿不到 WebGL 上下文时，new Map() 会同步抛错。
	// 不接住的话，这个错会从 onMounted 冒到 Nuxt，把整篇游记换成 500 错误页 ——
	// 地图挂了就赔上全文，不值当。
	try {
		// 动态 import：maplibre 只在游记详情页加载，不进其它页面的首屏包
		maplibre = await import('maplibre-gl')

		map = new maplibre.Map({
			container: container.value!,
			style: styleUrl(),
			center: [135.7681, 35.0116], // 京都：首帧兜底，随即被 fitBounds 覆盖
			zoom: 9,
			attributionControl: { compact: true },
		})

		map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'bottom-right')
		map.on('load', () => {
			localizeLabels()
			ready.value = true
		})
	}
	catch (error) {
		console.error('[travel] 地图初始化失败，降级为无地图模式：', error)
		failed.value = true
		map = undefined
	}
})

onBeforeUnmount(() => {
	clearMarkers()
	map?.remove()
	map = undefined
})

// 地图就绪之前 props 就可能变过，故把 ready 一并纳入依赖
watch([ready, () => props.photos], () => {
	if (ready.value)
		renderPhotos()
})

watch(() => props.focus, (photo) => {
	if (!ready.value)
		return

	if (photo) {
		focusPhoto(photo)
		return
	}

	// 看图器关掉了：收起 popup，视野退回这一屏的全貌
	closePopups()
	fitToPhotos()
})

// 标记是 DOM 覆盖物，不随 setStyle 销毁，故换肤后无需重建。
// 但图层表会被整份换掉，中文标签得跟着重放 —— styledata 在新样式就位后触发，
// 用 once 而不是 on：localizeLabels 自己会改 layout，on 会被自己触发的 styledata 打回来，转成死循环
watch(() => colorMode.value, () => {
	if (!map)
		return

	map.setStyle(styleUrl())
	map.once('styledata', localizeLabels)
})
</script>

<template>
<div class="travel-map-wrap">
	<div ref="container" class="travel-map" />
	<p v-if="failed" class="travel-map-failed">
		<Icon name="tabler:map-off" />
		这个浏览器没法渲染地图（缺少 WebGL），照片和游记正文不受影响。
	</p>
</div>
</template>

<style lang="scss" scoped>
.travel-map-wrap {
	position: relative;
	width: 100%;
	height: 100%;
}

.travel-map {
	width: 100%;
	height: 100%;
	background-color: var(--c-bg-2);
}

.travel-map-failed {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.4em;
	position: absolute;
	inset: 0;
	padding: 2rem;
	background-color: var(--c-bg-2);
	font-size: 0.85rem;
	text-align: center;
	color: var(--c-text-3);
}

// 标记和 popup 是 MapLibre 用 DOM API 塞进来的，不带 scoped 属性，故用 :deep 穿透
// 外层 .travel-marker 不设任何会影响 transform 的属性 —— MapLibre 拿它定位
.travel-map :deep(.travel-marker-dot) {
	display: block;
	width: 0.9rem;
	height: 0.9rem;
	padding: 0;
	border: 2px solid var(--c-bg);
	border-radius: 50%;
	box-shadow: var(--box-shadow-1);
	background-color: var(--c-primary);
	transition: scale var(--delay);
	cursor: pointer;

	&:hover {
		scale: 1.4;
	}
}

.travel-map :deep(.maplibregl-popup-content) {
	padding: 0.4rem;
	border: 1px solid var(--c-border);
	border-radius: 0.6rem;
	box-shadow: var(--box-shadow-2);
	background-color: var(--ld-bg-card);
}

.travel-map :deep(.travel-popup) {
	> img {
		display: block;
		width: 100%;
		aspect-ratio: 4 / 3;
		border-radius: 0.4rem;
		object-fit: cover;
	}

	> figcaption {
		padding: 0.4em 0.2em 0.1em;
		font-size: 0.75rem;
		text-align: center;
		color: var(--c-text-1);
	}
}

// popup 小三角按锚点方向分别上色，否则深色主题下会露出一个白尖
.travel-map :deep(.maplibregl-popup-anchor-bottom .maplibregl-popup-tip) {
	border-top-color: var(--ld-bg-card);
}

.travel-map :deep(.maplibregl-popup-anchor-top .maplibregl-popup-tip) {
	border-bottom-color: var(--ld-bg-card);
}

.travel-map :deep(.maplibregl-popup-anchor-left .maplibregl-popup-tip) {
	border-right-color: var(--ld-bg-card);
}

.travel-map :deep(.maplibregl-popup-anchor-right .maplibregl-popup-tip) {
	border-left-color: var(--ld-bg-card);
}
</style>
