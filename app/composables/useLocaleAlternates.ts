import blogConfig from '~~/blog.config'
import { manifest } from '#build/i18n-manifest'
import { buildPath, stripLocale } from '~/utils/locale'

const LOCALES = blogConfig.locales.map(l => l.code)

/**
 * 只为真实存在译文的语言发 hreflang。
 *
 * @nuxtjs/i18n 目前压根不发 hreflang（`seo` 是 useLocaleHead()/localeHead() 的参数，
 * 不是模块顶层选项，写在 i18n: 段下没有任何效果），69 个预渲染页面里没有一个含
 * "hreflang" 字符串。这里从零补上，且只列清单里真实存在的语言，不像天真实现那样
 * 对着配置的 locale 列表照单全发、把没译文的语言也标进去。
 *
 * 清单里查不到 basePath 的路径视为应用页面（/archive、/media 等），
 * i18n 会为每个语言都生成一份，此时退回 LOCALES 全量。
 *
 * key 与 app.vue 里 atom feed 的 rel="alternate" link 区分开 —— 都是
 * rel="alternate"，不给 key 的话 Unhead 可能把它们当成同一条互相去重。
 */
export function useLocaleAlternates() {
	const route = useRoute()

	useHead(() => {
		const { basePath } = stripLocale(route.path, LOCALES, 'zh')
		const available = manifest[basePath] ?? LOCALES
		const href = (code: string) => new URL(buildPath(basePath, code, 'zh'), blogConfig.url).toString()

		return {
			link: [
				...available.map(code => ({
					key: `locale-alternate-${code}`,
					rel: 'alternate',
					hreflang: blogConfig.locales.find(l => l.code === code)!.language,
					href: href(code),
				})),
				{ key: 'locale-alternate-x-default', rel: 'alternate', hreflang: 'x-default', href: href('zh') },
			],
		}
	})
}
