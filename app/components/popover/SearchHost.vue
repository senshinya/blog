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
	<div v-if="open" class="bikariya-overlay" :style="{ zIndex: zIndex - 1 }" @click="layoutStore.close" />
</Transition>
<LazyPopoverSearch
	v-if="mounted"
	:open
	:style="{ zIndex }"
	@close="layoutStore.close"
	@after-leave="finishLeave"
/>
</template>
