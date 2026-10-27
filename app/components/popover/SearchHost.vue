<script setup lang="ts">
const layoutStore = useLayoutStore()
const modalStore = useModalStore()
const zIndex = computed(() => Math.max(510, ...modalStore.modals.map(modal => modal.zIndex)) + 2)
const open = computed(() => layoutStore.state === 'search')
const mounted = ref(false)

watch(open, (value) => {
	if (value)
		mounted.value = true
}, { immediate: true })

function finishLeave() {
	if (!open.value)
		mounted.value = false
}
</script>

<template>
<Transition>
	<div v-if="open" class="bikariya-overlay search-overlay" :style="{ zIndex: zIndex - 1 }" @click="layoutStore.close" />
</Transition>
<LazyPopoverSearch
	v-if="mounted"
	:open
	:style="{ zIndex }"
	@close="layoutStore.close"
	@after-leave="finishLeave"
/>
</template>

<style scoped>
/* 面板重虚化、遮罩轻虚化，两级景深把注意力压到搜索框上。 */
/* 全屏 backdrop-filter 在低功耗设备上是笔真开销，移动端直接省掉这一层。 */
.search-overlay {
	backdrop-filter: blur(2px);

	@media (max-width: 768px) {
		backdrop-filter: none;
	}

	&.v-enter-active {
		transition: opacity var(--motion-fade-duration) var(--motion-easing);
	}

	&.v-leave-active {
		transition: opacity var(--motion-dismiss-duration) var(--motion-exit-easing);
	}

	@media (prefers-reduced-motion: reduce) {
		&.v-enter-active, &.v-leave-active { transition: none; }
	}
}
</style>
