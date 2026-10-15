<script setup lang="ts">
const props = withDefaults(defineProps<{ src: string, poster: string, alt: string, width: number, height: number, active?: boolean, viewer?: boolean }>(), { active: true, viewer: false })
const emit = defineEmits<{ enlarge: [] }>()
const { t } = useI18n()
const reduced = usePreferredReducedMotion()
const video = ref<HTMLVideoElement>()
const playing = ref(false)
const started = ref(false)
const loading = ref(false)
const failed = ref(false)
const ended = ref(false)
const muted = ref(false)
const current = ref(0)
const duration = ref(0)
const seeking = ref(false)
const progress = computed(() => duration.value > 0 ? `${Math.min(100, current.value / duration.value * 100)}%` : '0%')
const playLabel = computed(() => t(`page.travels.editorial.${playing.value ? 'pauseVideo' : ended.value ? 'replayVideo' : 'playVideo'}`))
function formatTime(value: number) {
	const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
function sync() {
	if (!video.value)
		return
	current.value = Number.isFinite(video.value.currentTime) ? video.value.currentTime : 0
	duration.value = Number.isFinite(video.value.duration) ? video.value.duration : 0
}
async function toggle() {
	const media = video.value
	if (!media || !props.active)
		return
	if (!media.paused) {
		media.pause()
		return
	}
	if (failed.value) {
		failed.value = false
		media.load()
	}
	if (media.ended)
		media.currentTime = 0
	const source = props.src
	loading.value = true
	try {
		await media.play()
	}
	catch {
		if (video.value === media && props.src === source) {
			playing.value = false
			loading.value = false
		}
	}
}
function activateSurface() {
	if (props.viewer)
		return toggle()
	emit('enlarge')
}
function onPlaying() {
	playing.value = true
	started.value = true
	loading.value = false
	failed.value = false
	ended.value = false
	sync()
}
function onPause() {
	playing.value = false
	loading.value = false
	sync()
}
function onEnded() {
	onPause()
	ended.value = true
}
function onError() {
	onPause()
	failed.value = true
}
function toggleMuted() {
	muted.value = !muted.value
	if (video.value)
		video.value.muted = muted.value
}
function seek(event: Event) {
	const value = Number((event.target as HTMLInputElement).value)
	seekTo(value)
}
function seekTo(value: number) {
	if (!video.value || !Number.isFinite(value) || duration.value <= 0)
		return
	video.value.currentTime = Math.min(duration.value, Math.max(0, value))
	ended.value = false
	sync()
}
function seekPointer(event: PointerEvent) {
	if (!props.active || duration.value <= 0)
		return
	const input = event.currentTarget as HTMLInputElement
	if (event.type === 'pointerdown') {
		if (event.button !== 0)
			return
		seeking.value = true
		input.setPointerCapture(event.pointerId)
	}
	if (!seeking.value)
		return
	event.preventDefault()
	const rect = input.getBoundingClientRect()
	seekTo((event.clientX - rect.left - 4) / Math.max(1, rect.width - 8) * duration.value)
}
function stopSeeking() {
	seeking.value = false
}
watch(() => props.active, (active) => {
	if (!active) {
		stopSeeking()
		video.value?.pause()
		playing.value = false
		loading.value = false
	}
})
watch(() => props.src, () => {
	stopSeeking()
	video.value?.pause()
	playing.value = false
	started.value = false
	loading.value = false
	failed.value = false
	ended.value = false
	current.value = 0
	duration.value = 0
	muted.value = false
})
onMounted(() => {
	if (props.viewer && reduced.value !== 'reduce')
		void toggle()
})
onScopeDispose(() => video.value?.pause())
</script>

<template>
<div class="video-player" :class="{ 'video-viewer': viewer, 'is-playing': playing, 'has-started': started, 'is-loading': loading }" :style="{ '--video-progress': progress }">
	<img class="video-poster" :src="poster" :alt="alt" :width :height :loading="viewer ? 'eager' : 'lazy'" decoding="async">
	<video
		v-if="active || started" :key="src" ref="video" class="video-media" :src :poster :width :height :aria-label="alt"
		:muted playsinline :preload="active ? 'metadata' : 'none'" tabindex="-1"
		@loadedmetadata="sync" @durationchange="sync" @timeupdate="sync" @playing="onPlaying" @pause="onPause" @ended="onEnded" @error="onError" @waiting="loading = true" @canplay="loading = false"
	/>
	<button class="video-surface" :aria-label="viewer ? playLabel : t('page.travels.editorial.enlargeVideo')" @pointerdown.stop @click.stop="activateSurface" />
	<button class="video-start" :class="{ hidden: playing && !loading }" :aria-label="playLabel" @pointerdown.stop @click.stop="toggle">
		<span class="video-play-disc">
			<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5.5 19 12 9 18.5Z" fill="currentColor" /></svg>
		</span>
		<span class="video-start-label">{{ loading ? t('page.travels.editorial.videoLoading') : failed ? t('page.travels.editorial.videoRetry') : playLabel }}</span>
	</button>
	<div class="video-controls" @pointerdown.stop @click.stop>
		<input class="video-seek" type="range" min="0" :max="duration || 1" step="0.1" :value="current" :disabled="!duration" :aria-label="t('page.travels.editorial.seekVideo')" @input="seek" @pointerdown.stop="seekPointer" @pointermove="seekPointer" @pointerup="stopSeeking" @pointercancel="stopSeeking" @lostpointercapture="stopSeeking">
		<div class="video-control-row">
			<button class="video-control" :aria-label="playLabel" :title="playLabel" @click="toggle">
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path v-if="playing" d="M7 5h4v14H7zm6 0h4v14h-4z" fill="currentColor" />
					<path v-else d="M9 5.5 19 12 9 18.5Z" fill="currentColor" />
				</svg>
			</button>
			<span class="video-time">{{ started ? formatTime(current) : t('page.travels.editorial.video') }}<span v-if="duration">{{ started ? ' / ' : ' · ' }}{{ formatTime(duration) }}</span></span>
			<button class="video-control" :aria-label="t(`page.travels.editorial.${muted ? 'unmuteVideo' : 'muteVideo'}`)" :title="t(`page.travels.editorial.${muted ? 'unmuteVideo' : 'muteVideo'}`)" :aria-pressed="muted" @click="toggleMuted">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M11 5 6 9H3v6h3l5 4Z" />
					<path v-if="muted" d="m16 9 5 6m0-6-5 6" />
					<path v-else d="M15 8a5 5 0 0 1 0 8m3-11a9 9 0 0 1 0 14" />
				</svg>
			</button>
			<button v-if="!viewer" class="video-control" :aria-label="t('page.travels.editorial.enlargeVideo')" :title="t('page.travels.editorial.enlargeVideo')" @click="$emit('enlarge')">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /></svg>
			</button>
		</div>
	</div>
</div>
</template>
