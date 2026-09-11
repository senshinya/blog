export const useSearchStore = defineStore('search', () => {
	// 搜索框应和侧边栏状态联动
	const layoutStore = useLayoutStore()
	const { $i18n } = useNuxtApp()

	const word = ref('')
	const { text } = useTextSelection()
	const label = computed(() => text.value.trim() || word.value || $i18n.t('sidebar.search'))

	// 从外部调用时应该操作 layoutStore
	watch(() => layoutStore.state, (state) => {
		if (state === 'search')
			word.value = text.value.trim() || word.value
	})

	return {
		word,
		label,
	}
})
