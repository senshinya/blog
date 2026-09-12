<script setup lang="ts">
import type { Map as MapLibreMap, Marker } from 'maplibre-gl'
import type { TravelPhoto } from '~/types/travel'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { getTravelMapLabelField } from '~/utils/travelMapLocale'
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

const container = useTemplateRef<HTMLElement>('container')
const colorMode = useColorMode()
const { t, locale } = useI18n()

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

/** 地名跟随博客语言；换肤后也重新应用，不改门牌号等非地名标签。 */
function localizeLabels() {
	if (!map)
		return

	for (const layer of map.getStyle().layers) {
		if (layer.type !== 'symbol')
			continue

		const field = layer.layout?.['text-field']
		if (!field)
			continue

		// 只替换地名的图层。门牌号图层的 text-field 是 {housenumber}，跟 name 无关，
		// 一并重写会让地名字段全取空，门牌号当场消失
		if (!JSON.stringify(field).includes('name'))
			continue

		map.setLayoutProperty(layer.id, 'text-field', getTravelMapLabelField(locale.value))
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

useVisibleTask(container, async (isActive) => {
	// try/catch 不是防御性摆设：MapLibre 拿不到 WebGL 上下文时，new Map() 会同步抛错。
	// 不接住的话，这个错会从 onMounted 冒到 Nuxt，把整篇游记换成 500 错误页 ——
	// 地图挂了就赔上全文，不值当。
	try {
		// 动态 import：maplibre 只在游记详情页加载，不进其它页面的首屏包
		maplibre = await import('maplibre-gl')
		if (!isActive() || !container.value)
			return

		maplibre.setWorkerUrl(workerUrl)
		map = new maplibre.Map({
			container: container.value!,
			style: styleUrl(),
			center: [135.7681, 35.0116], // 京都：首帧兜底，随即被 fitBounds 覆盖
			zoom: 9,
			attributionControl: { compact: true },
			// Locale routes remount this component, including MapLibre's UI controls.
			locale: {
				'Map.Title': t('page.travels.mapControls.title'),
				'NavigationControl.ZoomIn': t('page.travels.mapControls.zoomIn'),
				'NavigationControl.ZoomOut': t('page.travels.mapControls.zoomOut'),
				'AttributionControl.ToggleAttribution': t('page.travels.mapControls.attribution'),
				'AttributionControl.MapFeedback': t('page.travels.mapControls.feedback'),
			},
		})

		map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'bottom-right')
		map.on('style.load', localizeLabels)
		map.on('load', () => {
			ready.value = true
		})
	}
	catch (error) {
		if (!isActive())
			return
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

// style.load handles both the initial style and theme changes. Unlike styledata,
// it is not triggered by setLayoutProperty, so localization cannot recurse.
watch(() => colorMode.value, () => {
	map?.setStyle(styleUrl())
})

watch(locale, () => {
	if (map?.isStyleLoaded())
		localizeLabels()
})
</script>

<template>
<div class="travel-map-wrap">
	<div ref="container" class="travel-map" />
	<p v-if="failed" class="travel-map-failed">
		<Icon name="tabler:map-off" />
		{{ $t('page.travels.mapUnavailable') }}
	</p>
</div>
</template>

<style scoped>
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

/* 标记和 popup 是 MapLibre 用 DOM API 塞进来的，不带 scoped 属性，故用 :deep 穿透 */
/* 外层 .travel-marker 不设任何会影响 transform 的属性 —— MapLibre 拿它定位 */
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

/* popup 小三角按锚点方向分别上色，否则深色主题下会露出一个白尖 */
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
