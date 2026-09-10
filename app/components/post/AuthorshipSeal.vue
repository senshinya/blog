<script setup lang="ts">
import type { Authorship } from '~~/content.config'
import { ENTRANCE_SKIP_KEY } from '~/composables/useEntranceDelay'

const props = withDefaults(defineProps<{ authorship?: Authorship }>(), { authorship: 'human-only' })
const { t, locale } = useI18n()
const id = useId()
const localeSwitch = useState<boolean>(ENTRANCE_SKIP_KEY, () => false).value
const printing = ref(false)
const pending = ref(localeSwitch)
let replayFrame = 0
const human = computed(() => props.authorship.startsWith('human-'))
const reviewed = computed(() => props.authorship === 'ai-human-reviewed')
const label = computed(() => `${t('post.authorship.label')}: ${t(`post.authorship.${props.authorship}.top`)} · ${t(`post.authorship.${props.authorship}.bottom`)}`)

let replayVersion = 0

async function replay() {
	const version = ++replayVersion
	cancelAnimationFrame(replayFrame)
	pending.value = true
	printing.value = false
	await nextTick()
	if (version !== replayVersion)
		return
	const start = () => {
		// Native locale snapshots hide live elements until their transition ends.
		if (document.documentElement.classList.contains('locale-motion')) {
			replayFrame = requestAnimationFrame(start)
			return
		}
		pending.value = false
		printing.value = true
	}
	replayFrame = requestAnimationFrame(() => {
		replayFrame = requestAnimationFrame(start)
	})
}

onBeforeUnmount(() => {
	replayVersion++
	cancelAnimationFrame(replayFrame)
})

watch(locale, replay, { flush: 'pre' })
onMounted(() => {
	if (localeSwitch)
		void replay()
})
</script>

<template>
<button
	type="button"
	class="authorship-seal"
	:class="{ pending, printing }"
	:lang="locale"
	:title="`${label} · ${t('post.authorship.replay')}`"
	:aria-label="`${label} · ${t('post.authorship.replay')}`"
	@click="replay"
	@animationend.self="printing = false"
>
	<svg viewBox="-4 -4 168 168" aria-hidden="true">
		<defs>
			<path :id="`${id}-top`" d="M24 80a56 56 0 0 1 112 0" />
			<path :id="`${id}-bottom`" d="M17 80a63 63 0 0 0 126 0" />
			<mask :id="`${id}-review`" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
				<path fill="white" d="M0 0h32v32H0z" />
				<circle cx="25" cy="25" r="8" fill="black" />
			</mask>
			<filter :id="`${id}-ink`" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
				<feTurbulence type="fractalNoise" baseFrequency=".76" numOctaves="3" seed="12" result="noise" />
				<feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  6 0 0 0 -1.85" result="grain" />
				<feComposite in="SourceGraphic" in2="grain" operator="in" result="ink" />
				<feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="2" seed="12" result="edge" />
				<feDisplacementMap in="ink" in2="edge" scale=".35" xChannelSelector="R" yChannelSelector="G" />
			</filter>
		</defs>
		<g :filter="`url(#${id}-ink)`" opacity=".94">
			<g fill="none" stroke="currentColor">
				<circle cx="80" cy="80" r="76" stroke-width="1.5" />
				<circle cx="80" cy="80" r="72" stroke-width=".5" />
				<circle cx="80" cy="80" r="40" stroke-width=".8" />
			</g>
			<g fill="currentColor" text-anchor="middle">
				<text class="seal-top"><textPath :href="`#${id}-top`" startOffset="50%">{{ t(`post.authorship.${authorship}.top`) }}</textPath></text>
				<text class="seal-bottom"><textPath :href="`#${id}-bottom`" startOffset="50%">{{ t(`post.authorship.${authorship}.bottom`) }}</textPath></text>
				<path d="M23 77l3 3-3 3-3-3ZM137 77l3 3-3 3-3-3Z" />
			</g>
			<g transform="translate(55 55) scale(1.5625)" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
				<g v-if="human">
					<path d="m7 23 3.5-12L21 6l5 5-5.5 10.5L8 25zM8 24l9-9M10.5 11 21 21.5M21 6l2-2 5 5-2 2" />
					<circle cx="18" cy="14" r="1.6" />
					<path v-if="authorship === 'human-ai-polished'" d="m5 3 1.5 3.5L10 8 6.5 9.5 5 13 3.5 9.5 0 8 3.5 6.5Z" />
				</g>
				<template v-else>
					<g :mask="reviewed ? `url(#${id}-review)` : undefined">
						<rect x="7" y="7" width="18" height="18" rx="4" />
						<path d="M12 3v4M20 3v4M12 25v4M20 25v4M3 12h4M3 20h4M25 12h4M25 20h4m-17-3 4-6 4 6m-6.7-2h5.4M12 21h8" />
					</g>
					<g v-if="reviewed">
						<circle cx="25" cy="25" r="6" />
						<path d="m22 25 2 2 4-4" />
					</g>
				</template>
			</g>
		</g>
	</svg>
</button>
</template>

<style lang="scss" scoped>
.authorship-seal {
	display: block;
	width: var(--seal-size, 164px);
	aspect-ratio: 1;
	padding: 0;
	border: 0;
	border-radius: 50%;
	background: none;
	color: #315F96;
	transform: rotate(15deg);
	transform-origin: center;
	cursor: default;
	mix-blend-mode: multiply;
	touch-action: manipulation;

	&:focus-visible {
		outline: 2px solid var(--c-primary);
		outline-offset: 5px;
	}

	.dark & {
		color: #A8C8F0;
		mix-blend-mode: screen;
	}

	svg {
		display: block;
		overflow: visible;
		width: 100%;
		height: 100%;
	}

	text {
		font-family: "Songti SC", "Hiragino Mincho ProN", serif;
		letter-spacing: 0.09em;
	}

	&:lang(en) text {
		font-family: Georgia, serif;
		letter-spacing: 0.06em;
	}

	.seal-top {
		font-size: 14px;
	}

	.seal-bottom {
		font-size: 12px;
	}

	&.pending {
		opacity: 0;
	}

	&.printing {
		animation: stamp-down 0.46s cubic-bezier(0.25, 0.7, 0.2, 1) both;
	}
}

@keyframes stamp-down {
	0% {
		opacity: 0;
		transform: translate(6px, -21px) rotate(9deg) scale(1.42);
	}

	40% {
		opacity: 0.8;
		transform: translateY(1px) rotate(15deg) scale(0.98);
	}

	58% {
		opacity: 1;
		transform: rotate(15deg) scale(1.015);
	}

	100% {
		transform: rotate(15deg);
	}
}

@media (prefers-reduced-motion: reduce) {
	.authorship-seal.printing {
		animation: none;
	}
}
</style>
