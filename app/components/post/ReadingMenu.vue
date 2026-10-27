<script setup lang="ts">
const { headings, activeId, visibleRoots, visibleIds, scrollingDown, desktop, reducedMotion, navigate } = useArticleReading()
const trigger = useTemplateRef<HTMLButtonElement>('trigger')
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const panel = useTemplateRef<HTMLElement>('panel')
const shade = useTemplateRef<HTMLElement>('shade')
const content = useTemplateRef<HTMLElement>('content')
const phase = ref<'closed' | 'opening' | 'open' | 'closing'>('closed')
const open = computed(() => phase.value !== 'closed')
const motions = new Set<Animation>()
let generation = 0
let touch: { x: number, y: number, time: number, movable: boolean } | undefined
let drag = 0

function cancelMotions() {
	for (const motion of motions)
		motion.cancel()
	motions.clear()
}

async function animate(element: HTMLElement | null, keyframes: Keyframe[], duration: number, easing = 'cubic-bezier(0.22, 1, 0.36, 1)') {
	if (!element || reducedMotion.value === 'reduce')
		return
	const motion = element.animate(keyframes, { duration, easing, fill: 'both' })
	motions.add(motion)
	try {
		await motion.finished
	}
	catch { /* A close, resize or navigation may interrupt the entrance. */ }
}

async function show() {
	if (desktop.value || !dialog.value || open.value)
		return
	const current = ++generation
	phase.value = 'opening'
	dialog.value.showModal()
	await Promise.all([
		animate(panel.value, [{ transform: 'translateY(calc(100% + 14px))', opacity: 0.98 }, { transform: 'translateY(0)', opacity: 1 }], 260),
		animate(shade.value, [{ opacity: 0 }, { opacity: 1 }], 220),
	])
	if (current !== generation)
		return
	cancelMotions()
	phase.value = 'open'
}

async function close(immediate = false) {
	if (!dialog.value?.open || (phase.value === 'closing' && !immediate))
		return
	const current = ++generation
	const transform = panel.value && getComputedStyle(panel.value).transform
	const opacity = shade.value && getComputedStyle(shade.value).opacity
	const panelOpacity = panel.value && getComputedStyle(panel.value).opacity
	phase.value = 'closing'
	cancelMotions()
	if (!immediate) {
		await Promise.all([
			animate(panel.value, [{ transform: transform || 'none', opacity: panelOpacity || 1 }, { transform: 'translateY(calc(100% + 14px))', opacity: 0.98 }], 180, 'cubic-bezier(0.4, 0, 1, 1)'),
			animate(shade.value, [{ opacity: opacity || 1 }, { opacity: 0 }], 220),
		])
	}
	if (current !== generation)
		return
	dialog.value.close()
	cancelMotions()
	phase.value = 'closed'
	drag = 0
	if (panel.value)
		panel.value.style.removeProperty('transform')
	trigger.value?.focus({ preventScroll: true })
	return true
}

async function select(event: MouseEvent, id: string) {
	if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
		return
	event.preventDefault()
	if (await close())
		navigate(event, id)
}

function touchStart(event: TouchEvent) {
	const point = event.touches[0]
	if (!point || phase.value !== 'open')
		return
	touch = {
		x: point.clientX,
		y: point.clientY,
		time: performance.now(),
		movable: !!(event.target as Element).closest('header') || (content.value?.scrollTop ?? 0) <= 0,
	}
}
function touchMove(event: TouchEvent) {
	const point = event.touches[0]
	if (!point || !touch?.movable || !panel.value)
		return
	const distance = point.clientY - touch.y
	if (distance > 6 && distance > Math.abs(point.clientX - touch.x)) {
		event.preventDefault()
		drag = distance
		panel.value.style.transform = `translateY(${distance}px)`
	}
}
async function touchEnd() {
	if (!touch)
		return
	const speed = drag / Math.max(1, performance.now() - touch.time)
	touch = undefined
	if (drag > 64 || (drag > 24 && speed > 0.6)) {
		await close()
	}
	else if (drag && panel.value) {
		const element = panel.value
		const current = generation
		await animate(element, [{ transform: `translateY(${drag}px)` }, { transform: 'translateY(0)' }], 200)
		if (generation !== current || panel.value !== element)
			return
		element.style.removeProperty('transform')
		cancelMotions()
	}
	drag = 0
}

watch(desktop, (value) => {
	if (value)
		void close(true)
})
onScopeDispose(() => {
	generation++
	cancelMotions()
	dialog.value?.close()
})
</script>

<template>
<div v-if="headings.length" class="reading-menu-entry reading-theme" :data-hidden="scrollingDown && !open || undefined">
	<div class="reading-menu-button">
		<button ref="trigger" type="button" :aria-label="$t('widget.toc.show')" aria-haspopup="dialog" :aria-expanded="open" :inert="scrollingDown && !open || undefined" @click="show">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<path fill="currentColor" d="M20.837 5.607c.132-.258-.062-.556-.38-.584a29 29 0 0 0-2.454-.1c-1.106 0-1.983.058-2.516.105c-.296.027-.461.299-.332.552c.22.432.596 1.121 1.144 1.966c.549.845 1.033 1.48 1.343 1.865c.183.225.53.235.704.02c.311-.385.806-1.03 1.361-1.884a22 22 0 0 0 1.13-1.94m0 9.999c.132-.257-.062-.556-.38-.583c-.536-.046-1.39-.1-2.454-.1c-1.106 0-1.983.057-2.516.105c-.296.026-.461.298-.332.552c.22.431.596 1.12 1.144 1.966a23 23 0 0 0 1.343 1.864c.183.226.53.236.704.02c.311-.384.806-1.03 1.361-1.883a22 22 0 0 0 1.13-1.94" />
				<path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M4 5h8m-8 7h8m-8 7h8" />
			</svg>
		</button>
	</div>
</div>
<dialog ref="dialog" class="reading-menu reading-theme" :aria-label="$t('widget.toc.menuTitle')" @cancel.prevent="close()">
	<div ref="shade" class="reading-menu-shade" aria-hidden="true" @click="close()" />
	<div ref="panel" class="reading-menu-popup" @touchstart.passive="touchStart" @touchmove="touchMove" @touchend="touchEnd" @touchcancel="touchEnd">
		<section class="reading-menu-panel">
			<header>
				<h2>{{ $t('widget.toc.menuTitle') }}</h2>
				<button type="button" :aria-label="$t('widget.toc.close')" autofocus @click="close()">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
				</button>
			</header>
			<div ref="content" class="reading-menu-content">
				<PostReadingToc :headings :active-id="activeId" :visible-roots="visibleRoots" :visible-ids="visibleIds" mobile @navigate="select" />
			</div>
		</section>
	</div>
</dialog>
</template>

<style scoped>
.reading-menu-entry {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	position: fixed;
	overflow-x: clip;
	opacity: 1;
	inset: auto env(safe-area-inset-right, 0px) calc(70px + env(safe-area-inset-bottom)) auto;
	transition: opacity 300ms cubic-bezier(0.22, 1, 0.36, 1), transform 300ms cubic-bezier(0.22, 1, 0.36, 1);
	z-index: calc(var(--z-index-popover) - 1);

	&[data-hidden] {
		opacity: 0;
		transform: translateY(12px);
		pointer-events: none;
	}
	.reading-menu-button {
		overflow: hidden;
		width: 48px;
		margin-top: 7px;
		transform-origin: right center;
		animation: reading-entry 280ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 42px;
		height: 49px;
		padding: 0 3.5px 0 0;
		border: 1px solid rgb(0 0 0 / 8%);
		border-inline-end: 0;
		border-radius: 14px 0 0 14px;
		background: color-mix(in srgb, var(--reading-paper) 95%, transparent);
		color: var(--reading-muted);
		transition: color 200ms cubic-bezier(0.22, 1, 0.36, 1), background-color 200ms cubic-bezier(0.22, 1, 0.36, 1), transform 120ms;
		&:hover {
			background: rgb(0 0 0 / 2%);
			color: #24231F;
		}
		&:active {
			background: rgb(0 0 0 / 4%);
			transform: scale(0.97);
		}
		svg {
			opacity: 0.75;
			transition: opacity 200ms;
		}
		&:hover svg { opacity: 1; }
		:root.dark & { border-color: rgb(255 255 255 / 10%); }
	}
	@media (min-width: 1025px) { display: none; }
}
.reading-menu {
	position: fixed;
	overflow: hidden;
	inset: 0;
	width: 100%;
	height: 100dvh;
	max-width: none;
	max-height: none;
	margin: 0;
	padding: 0;
	border: 0;
	background: transparent;
	overscroll-behavior: contain;
	&::backdrop { background: transparent; }
}
.reading-menu-shade {
	position: absolute;
	inset: 0;
	background: rgb(36 35 31 / 25%);
	:root.dark & { background: rgb(20 20 20 / 25%); }
}
.reading-menu-popup {
	display: flex;
	flex-direction: column;
	position: absolute;
	inset: auto 0 7px;
	max-height: calc(100svh - 70px);
	padding: 0 12.25px 12.25px;
}
.reading-menu-panel {
	display: flex;
	flex-direction: column;
	overflow: hidden;
	max-height: calc(100svh - 70px);
	border: 1px solid var(--reading-border);
	border-radius: 20px;
	box-shadow: 0 1px 2px rgb(0 0 0 / 4%), 0 4px 14px rgb(0 0 0 / 6%);
	background: var(--reading-panel);
	:root.dark & { box-shadow: 0 1px 2px rgb(0 0 0 / 15%), 0 4px 12px rgb(0 0 0 / 10%); }
	header {
		display: flex;
		flex: none;
		align-items: center;
		justify-content: space-between;
		padding: 14px 17.5px 0;
	}
	h2 {
		overflow: hidden;
		margin: 0;
		padding-right: 28px;
		font-size: 15px;
		font-weight: 500;
		line-height: 1.5;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	header button {
		display: grid;
		flex: none;
		place-items: center;
		width: 21px;
		height: 21px;
		padding: 0;
		color: #A8A69F;
		:root.dark & { color: #787878; }
		transition: color 200ms;
		&:hover { color: var(--reading-ink); }
	}
}
.reading-menu-content {
	overflow: auto;
	min-height: 0;
	padding: 14px 17.5px 17.5px;
	overscroll-behavior: contain;
	scrollbar-width: none;
}
@keyframes reading-entry {
	from {
		opacity: 0;
		width: 0;
	}
	to {
		opacity: 1;
		width: 48px;
	}
}
@media (prefers-reduced-motion: reduce) {
	.reading-menu-entry, .reading-menu-entry button, .reading-menu-entry svg, .reading-menu-panel header button { transition: none; }
	.reading-menu-button { animation: none !important; }
}
</style>
