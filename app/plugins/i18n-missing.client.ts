/**
 * 仓库没有 vue-tsc，模板里 $t('nav.archiv') 这类拼写错误无法在编译期抓到。
 * 开发环境下把 missing key 提升为抛错，让它在写的时候就暴露。
 * 生产环境保持 vue-i18n 默认行为（渲染原始 key），不因文案问题白屏。
 */
export default defineNuxtPlugin((nuxtApp) => {
	if (!import.meta.dev)
		return

	const i18n = nuxtApp.$i18n as { missing?: unknown }
	i18n.missing = (locale: string, key: string) => {
		throw new Error(`[i18n] 缺少词条：${locale}.${key}`)
	}
})
