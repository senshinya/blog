/**
 * JP 字体只在日语页面注入。站点按语言分别预渲染，
 * 因此中英文页面的 head 里不会出现这条 link，读者不承担这份流量。
 *
 * 这份 JP 字体表单独成一条 stylesheet，不合并进 nuxt.config.ts 里
 * 中英文共用的 css2 link —— Noto 的日文字重按 unicode-range 切了
 * 非常多子集，单这一条就有 230KB，且是阻塞渲染的，不能让中英文读者背这个包袱。
 *
 * fonts.gstatic.cn 已经在 nuxt.config.ts 里有 preconnect（供中文的
 * Noto Serif SC / JetBrains Mono 用），这里复用同一个源，不需要再加。
 */
export function useLocaleFonts() {
	const { locale } = useI18n()

	useHead(() => {
		if (locale.value !== 'ja')
			return {}

		return {
			link: [{
				key: 'locale-font-ja',
				rel: 'stylesheet',
				href: 'https://fonts.googleapis.cn/css2?family=Noto+Sans+JP:wght@100..900&family=Noto+Serif+JP:wght@200..900&display=swap',
			}],
		}
	})
}
