import type { Nav, NavItem } from '~/types/nav'
import { pascalCase } from 'es-toolkit/string'
import { Temporal } from 'temporal-polyfill'
import blogConfig from '~~/blog.config'
import { name, version } from '~~/package.json'

// 图标查询：https://yesicon.app/tabler
// 图标插件：https://marketplace.visualstudio.com/items?itemName=antfu.iconify

// @keep-sorted
export default defineAppConfig({
	// 将 blog.config 中的配置项复制到 appConfig，方便调用
	...blogConfig,

	component: {
		alert: {
			/** 默认使用卡片风格还是扁平风格 */
			defaultStyle: 'card' as 'card' | 'flat',
		},

		codeblock: {
			/** 代码块触发折叠的行数 */
			triggerRows: 32,
			/** 代码块折叠后的行数 */
			collapsedRows: 16,
			/** 启用代码块缩进导航会关闭空格渲染 */
			enableIndentGuide: true,
			/** 代码块缩进导航(Indent Guige)竖线匹配空格数 */
			indent: 4,
			/** tab渲染宽度 */
			tabSize: 3,
		},

		/** 文章开头摘要 */
		excerpt: {
			animation: true,
			caret: '_',
		},

		/** 精选文章 Slide */
		slide: {
			/** 适合封面图无字时启用 */
			showTitle: true,
		},

		stats: {
			/** 归档页面每年标题对应的年龄 */
			birthYear: 1999,
			/** blog-stats widget 的预置文本 */
			wordCountKey: 'widget.blogStats.wordCount',
		},
	},

	// @keep-sorted
	footer: {
		/** 页脚版权信息，支持 <br> 换行等 HTML 标签 */
		copyright: `© ${Temporal.Now.plainDateISO().year.toString()} ${blogConfig.author.name}`,
		/** 侧边栏底部图标导航 */
		iconNav: [
			{ icon: 'tabler:brand-github', text: 'GitHub: senshinya', url: 'https://github.com/senshinya' },
			{ icon: 'tabler:brand-telegram', text: 'Telegram: senshinya', url: 'https://telegram.me/senshinya' },
			{ icon: 'tabler:mail', text: blogConfig.author.email, url: `mailto:${blogConfig.author.email}` },
			{ icon: 'tabler:rss', textKey: 'footer.atom', url: '/atom.xml' },
			{ icon: 'ri:subway-line', textKey: 'footer.travellingsTip', url: 'https://www.travellings.cn/go.html' },
		] satisfies NavItem[],
		/** 页脚站点地图 */
		nav: [
			{
				titleKey: 'footer.explore',
				items: [
					{ icon: 'tabler:rss', textKey: 'footer.atom', url: '/atom.xml' },
					{ icon: 'ri:subway-line', textKey: 'footer.travellings', url: 'https://www.travellings.cn/go.html' },
				],
			},
			{
				titleKey: 'footer.social',
				items: [
					{ icon: 'tabler:brand-github', text: 'senshinya', url: 'https://github.com/senshinya' },
					{ icon: 'tabler:brand-telegram', text: 'senshinya', url: 'https://telegram.me/senshinya' },
					{ icon: 'tabler:mail', text: blogConfig.author.email, url: `mailto:${blogConfig.author.email}` },
				],
			},
			{
				titleKey: 'footer.info',
				items: [
					{ icon: 'simple-icons:nuxt', textKey: 'footer.theme', textParams: { name: pascalCase(name), version }, url: 'https://github.com/L33Z22L11/blog-v3' },
					{ icon: 'tabler:certificate', text: '萌ICP备20248008号', url: 'https://icp.gov.moe/?keyword=20248008' },
				],
			},
		] satisfies Nav,
	},

	/** 左侧栏顶部 Logo */
	header: {
		logo: blogConfig.author.avatar,
		/** 展示标题文本，否则展示纯 Logo */
		showTitle: true,
		subtitle: blogConfig.subtitle,
		emojiTail: ['📄', '🐟', '⌨️', '🍜', '🌙'],
	},

	/** 友链页面 */
	link: {
		/** 无订阅源展示静音图标 */
		remindNoFeed: false,
		/** 友链分组内随机排序 */
		randomInGroup: true,
	},

	/** 左侧栏导航 */
	nav: [
		{
			title: '',
			items: [
				{ icon: 'tabler:files', textKey: 'nav.articles', url: '/' },
				{ icon: 'tabler:map-2', textKey: 'nav.travels', url: '/travels' },
				{ icon: 'tabler:bubble-text', textKey: 'nav.memos', url: '/memos' },
				{ icon: 'tabler:movie', textKey: 'nav.media', url: '/media' },
				{ icon: 'tabler:archive', textKey: 'nav.archive', url: '/archive' },
				{ icon: 'tabler:link', textKey: 'nav.friends', url: '/friends' },
			],
		},
	] satisfies Nav,

	pagination: {
		perPage: 10,
	},

	themes: {
		light: {
			icon: 'tabler:sun',
			tipKey: 'sidebar.theme.light',
		},
		system: {
			icon: 'tabler:device-desktop',
			tipKey: 'sidebar.theme.system',
		},
		dark: {
			icon: 'tabler:moon',
			tipKey: 'sidebar.theme.dark',
		},
	},
})
