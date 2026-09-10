import type { FeedEntry } from './app/types/feed'

const basicConfig = {
	title: '信也のブログ',
	subtitle: '一写代码的',
	// 长 description 利好于 SEO
	description: '互联网自留地。shinya 的个人博客，记录折腾、项目、笔记与日常 —— 网络与代理、自建服务、Go 与系统底层、以及那些不知道为什么就搞了一整个周末的东西。',
	author: {
		name: 'shinya',
		avatar: 'https://github.com/senshinya.png',
		email: 'kobayashi_shinya@outlook.com',
		homepage: 'https://github.com/senshinya',
	},
	copyright: {
		abbr: 'CC BY-NC-SA 4.0',
		name: '署名-非商业性使用-相同方式共享 4.0 国际',
		url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hans',
	},
	favicon: '/icons/favicon.png',
	language: 'zh-CN',
	timeEstablished: '2021-11-27',
	timeZone: 'Asia/Shanghai',
	url: 'https://blog.shinya.click/',
	defaultCategory: 'notes',
}

// 存储 nuxt.config 和 app.config 共用的配置
// 此处为启动时需要的配置，启动后可变配置位于 app/app.config.ts
// @keep-sorted
const blogConfig = {
	...basicConfig,

	article: {
		/** 分类 id 与展示名解耦：id 语言无关，展示名进 i18n/locales/*.ts 的 category 词条 */
		categories: {
			/** 折腾：网络/代理/自建服务/系统与硬件 */
			fiddling: { icon: 'tabler:tool', color: '#33aaff' },
			/** 项目：自己写的东西、造的轮子 */
			projects: { icon: 'tabler:code', color: '#7777ff' },
			/** 笔记：学习记录、原理梳理 */
			notes: { icon: 'tabler:notebook', color: '#33bbaa' },
			/** 日常：生活片段与杂感 */
			daily: { icon: 'tabler:leaf', color: '#ff7777' },
		},
		/** 文章版式，首个为默认版式 */
		types: {
			tech: {},
			story: {},
		},
		/** 使用 pnpm new 新建文章时自动生成自定义链接（permalink/abbrlink） */
		useRandomPremalink: false,
		/** 隐藏基于文件路由（不是自定义链接）的 URL /post 路径前缀 */
		hidePostPrefix: true,
		/** 禁止搜索引擎收录的路径 */
		robotsNotIndex: ['/preview', '/previews/*'],
	},

	/** Bangumi(bgm.tv)收藏，用于 /media 娱乐页（番剧/影视/游戏） */
	bangumi: {
		/** 数字 UID：该账号没有自定义用户名，只能用 UID。接口 /v0/users/{uid}/collections */
		uid: '1264845',
		/**
		 * 资源反代前缀（bgm.tv 在大陆访问不稳）。拼成 {prefix}{完整目标URL}，
		 * 如 https://api-bgm-tv.shinya.click/https://api.bgm.tv/...。留空则直连。
		 * 缓存时长由远端自动配置，无需在前缀里带 /cache= 段。
		 * 反代需回传 access-control-allow-origin（客户端取数要跨域）。
		 */
		/** 列表接口反代前缀 */
		apiProxy: 'https://api-bgm-tv.shinya.click/',
		/** 封面图反代前缀 */
		imgProxy: 'https://api-bgm-tv.shinya.click/',
	},

	/**
	 * 自建评论服务 blog-comment（https://github.com/senshinya/blog-comment）。
	 *
	 * 页面 key 就是路由路径，与 giscus 时代的 pathname 映射一致，
	 * 历史评论由服务端的 import 任务按同一套 key 导入，故线程不断。
	 *
	 * 全站是 SSG，浏览器直接打这个域名，跨站带 cookie ——
	 * 服务端的 SITE_ORIGIN 必须包含本站地址，否则所有写操作会被 403。
	 */
	comment: {
		api: 'https://comment.shinya.click',
	},

	/** 博客 Atom 订阅源 */
	feed: {
		/** 订阅源最大文章数量 */
		limit: 50,
		/** 订阅源是否启用XSLT样式 */
		enableStyle: true,
	},

	/**
	 * 三语言定义。name 是语言切换器上的按钮标签，label 是该语言的完整自称
	 * （用于 aria-label 与 tooltip），两者都用各语言自称，任何语言环境下都是
	 * 这个形态，故不进词条表。
	 */
	locales: [
		{ code: 'zh', language: 'zh-CN', name: '中', label: '简体中文', file: 'zh.ts' },
		{ code: 'en', language: 'en-US', name: 'En', label: 'English', file: 'en.ts' },
		{ code: 'ja', language: 'ja-JP', name: 'あ', label: '日本語', file: 'ja.ts' },
	],

	/** 向 <head> 中添加脚本 */
	scripts: [
		// 自己部署的 Umami 统计服务
		{ 'src': 'https://umami.shinya.click/script.js', 'data-website-id': '8d38f911-1c17-4c6f-85b0-381d25bfea33', 'defer': true },
	],

	/** 文章统计配置 */
	stats: {
		/**
		 * 统计范围，匹配 content 下不含扩展名的路径（stem）；空数组统计全部内容
		 * 使用 SQL LIKE 语法：% 匹配任意长度字符，_ 匹配单个字符
		 * 多个范围取并集，如 ['posts/%', 'book/%']
		 */
		includePaths: [] as string[],
	},
}

/** 用于生成 OPML 和友链页面配置 */
export const myFeed: FeedEntry = {
	author: blogConfig.author.name,
	title: blogConfig.title,
	desc: blogConfig.subtitle || blogConfig.description,
	link: blogConfig.url,
	feed: new URL('/atom.xml', blogConfig.url).toString(),
	icon: blogConfig.favicon,
	avatar: blogConfig.author.avatar,
	archs: ['Nuxt', 'Netlify'],
	date: blogConfig.timeEstablished,
	comment: '这是我自己',
}

export default blogConfig
