/**
 * 仓库没有 vue-tsc，而 i18n/i18n.d.ts 里对 DefineLocaleMessage 的类型增广
 * 并不能让 $t() 的 key 参数被类型检查约束（原因见该文件内的说明）。
 * 因此这个开发期运行时 handler 是目前唯一能挡住 $t('nav.archiv') 这类拼写错误的防线。
 * 只在客户端生效：如果某个错误 key 只在开发期 SSR 渲染时命中、客户端从未走到
 * 同一处模板，这里理论上抓不到；但 hydration 会把同样的模板在客户端重新渲染一遍，
 * 实践中仍能在那时补抓到。
 * 生产环境保持 vue-i18n 默认行为（渲染原始 key），不因文案问题白屏。
 */
export default defineNuxtPlugin((nuxtApp) => {
	if (!import.meta.dev)
		return

	nuxtApp.$i18n.setMissingHandler((locale, key) => {
		throw new Error(`[i18n] 缺少词条：${locale}.${key}`)
	})
})
