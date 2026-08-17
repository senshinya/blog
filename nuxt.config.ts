import { readdirSync, readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { arch, env, version as nodeVersion, platform } from 'node:process'
import { pathToFileURL } from 'node:url'
import { name as ciName, CLOUDFLARE_PAGES, GITHUB_ACTIONS, NETLIFY, VERCEL } from 'ci-info'
import { mapValues } from 'es-toolkit/object'
import { pascalCase } from 'es-toolkit/string'
import { Temporal } from 'temporal-polyfill'
import { isTravelDraftSource } from './app/travels/draft'
import blogConfig from './blog.config'
import packageJson from './package.json'
import redirectList from './redirects.json'

function pluginPath(path: string) {
	return pathToFileURL(resolve(`./remark-plugins/${path}.ts`)).href
}

// 游记数据是 app/travels/*.yaml。加载 nuxt.config 的 jiti 不认 yaml import，
// 所以从文件名推路由，并直接读取文本中的顶层 `draft: true` 来排除草稿。
// 文件名即 slug，这条约定由迁移脚本和 app/travels/index.ts 共同保证。
const travelDirectory = resolve('./app/travels')
const travelRoutes = readdirSync(travelDirectory)
	.filter(file => file.endsWith('.yaml'))
	.filter(file => !isTravelDraftSource(readFileSync(resolve(travelDirectory, file), 'utf8')))
	.map(file => `/travels/${basename(file, '.yaml')}`)

// 此处配置无需修改
export default defineNuxtConfig({
	app: {
		head: {
			meta: [
				{ name: 'author', content: [blogConfig.author.name, blogConfig.author.email].filter(Boolean).join(', ') },
				{ name: 'color-scheme', content: 'light dark' },
				{ name: 'google-site-verification', content: 'Upwpz7OZi3RkL8sFzigeC7dGcmnZUO3bKqGLizsUl0w' },
				// 此处为元数据的生成器标识，不建议修改
				{ 'name': 'generator', 'content': `${pascalCase(packageJson.name)} ${packageJson.version}`, 'data-github-repo': packageJson.homepage },
				{ name: 'mobile-web-app-capable', content: 'yes' },
			],
			link: [
				{ rel: 'icon', href: blogConfig.favicon },
				{ rel: 'alternate', type: 'application/atom+xml', href: '/atom.xml' },
				{ rel: 'preconnect', href: 'https://giscus.app' },
				{ rel: 'stylesheet', href: 'https://cdnjs.snrat.com/ajax/libs/KaTeX/0.16.44/katex.min.css' },
				// "InterVariable", "Inter", "InterDisplay"
				{ rel: 'stylesheet', href: 'https://rsms.me/inter/inter.css' },
				// "JetBrains Mono", 思源宋体 "Noto Serif SC"
				{ rel: 'preconnect', href: 'https://fonts.gstatic.cn', crossorigin: '' },
				{ rel: 'stylesheet', href: 'https://fonts.googleapis.cn/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Noto+Serif+SC:wght@200..900&display=swap' },
				// 抖音美好体 "DOUYINSANSBOLD-GB"
				{ rel: 'stylesheet', href: 'https://fonts.bytedance.com/dfd/api/v1/css?family=DOUYINSANSBOLD-GB&display=swap' },
			],
			templateParams: {
				separator: '|',
			},
			titleTemplate: `%s %separator ${blogConfig.title}`,
			script: blogConfig.scripts,
		},
		rootAttrs: {
			id: 'blog-root',
		},
	},

	compatibilityDate: '2024-08-03',

	components: [
		{ path: '~/components/partial', prefix: 'Z' },
		'~/components',
	],

	css: [
		'@/assets/css/animation.scss',
		'@/assets/css/article.scss',
		'@/assets/css/color.scss',
		'@/assets/css/font.scss',
		// .css 而非 .scss：里头的 round(down, …) 会被 Sass 自带的单参 round() 顶掉
		'@/assets/css/lqip.css',
		'@/assets/css/main.scss',
		'@/assets/css/reusable.scss',
	],

	// @keep-sorted
	experimental: {
		extractAsyncDataHandlers: true,
		typescriptPlugin: true,
	},

	nitro: {
		prerender: {
			// 修复部分平台会在文章路径后添加 `/`，导致闪现 404 错误
			// https://github.com/nuxt/content/issues/2378
			autoSubfolderIndex: CLOUDFLARE_PAGES || GITHUB_ACTIONS || NETLIFY ? false : undefined,

			// 游记不走 Nuxt Content，爬虫只能靠侧栏导航和旧文内链摸过来，不够稳。
			// 显式登记：列表页 + 每篇详情页，漏链也不会静默不生成。
			//
			// 碎语详情页不在此列：碎语是运行时数据，构建期无从枚举 id，
			// 改由 ISR 按需渲染（见 routeRules 的 '/memos/**'）。
			//
			// /media 配了 ssr:false（见 routeRules），crawler 不会渲染它，显式登记才能生成
			// 那个纯客户端壳（/media/index.html）。路径是静态的，直接命中该文件。
			routes: ['/', '/travels', ...travelRoutes, '/media'],

			/**
			 * 以下两条是从 `nuxt generate` 切到 `nuxt build` 之后必须自己补上的。
			 *
			 * `nuxt generate` 做的事其实是 `prerender: true`，它会命中 nitro 的 static preset，
			 * 而那个 preset 同时设了 `static: true` 和 `crawlLinks: true`
			 * （见 nitropack/dist/presets/_static/preset.mjs）。切到 `nuxt build` 后走的是
			 * vercel preset，两样都没了：
			 *
			 *   1. crawlLinks 掉回 nitro 的默认值 false，爬虫不再顺着链接铺开；
			 *   2. 更隐蔽的是 static 也变成 false，于是 nuxt/dist/index.mjs 里那段
			 *      「static 为真时把首页塞进预渲染队列当种子」直接 return —— 队列会连起点都没有。
			 *
			 * 所以 crawlLinks 要显式打开，`/` 也要显式登记（即上面 routes 的第一项）。
			 * 少任何一条，文章页都会退化成按需 SSR：首字节变慢，函数调用量从几乎为零变成每次访问一次。
			 *
			 * 本项目需要服务端，只是为了 /api/og 这一个端点（碎语的链接预览卡要用它代取外站元数据）。
			 * 页面该静态的还是静态的，别被 `nuxt build` 这个名字误导。
			 */
			crawlLinks: true,
		},

		/**
		 * Vercel 专用。部署在 Netlify 时这段是惰性的（vercel preset 不跑就不读）。
		 *
		 * 与 Netlify 那边同样的两件事，只是换了个平台的表达方式：
		 * public/_redirects 和 netlify.toml 到了 Vercel 全是废纸 —— 前者还会被当成
		 * 普通静态文件公开发布出去，语义完全无效。
		 *
		 * 写在这里而不是 vercel.json：SSG 下 nitro 走 Vercel 的 Build Output API，
		 * 直接产出 .vercel/output/config.json 来定义路由。而 nitro 的 generateBuildConfig 是
		 *   defu(nitro.options.vercel?.config, { version: 3, routes: [...] })
		 * defu 对数组是拼接、且用户的项在前，所以这里的规则会落到 config.json 的 routes 最顶端，
		 * 稳稳排在任何兜底之前。vercel.json 与 Build Output API 的交互我没验证过，不赌。
		 */
		vercel: {
			config: {
				routes: [
					// giscus 接口的同源代理，见 app/composables/useGiscusCount.ts
					{ src: '/giscus-api/(.*)', dest: 'https://giscus.app/api/$1' },
					// 自定义 giscus 主题 CSS：方向相反，是 giscus 的 iframe 跨域来取我们的文件。
					// continue: true —— 只挂头，不截断路由，让请求继续走到静态文件
					{
						src: '/giscus/(.*)',
						headers: { 'Access-Control-Allow-Origin': 'https://giscus.app' },
						continue: true,
					},
				],
			},
		},
	},

	// @keep-sorted
	routeRules: {
		...mapValues(redirectList, to => ({ redirect: { to, statusCode: 308 as const } })),
		/**
		 * 碎语链接预览卡的取数端点（见 server/api/og.get.ts），全站唯一的运行时函数。
		 *
		 * 与 /api/stats 相反，这条**不能**预渲染 —— 它得按 query 现抓。此处只声明这件事，
		 * Cache-Control 交给 handler 自己设：成功与失败该缓存多久并不一样，
		 * 而 routeRules 的 headers 是在 handler 之前跑的中间件（nitropack 的
		 * runtime/internal/route-rules.mjs），写在这儿也会被 handler 覆盖，徒增两处真相。
		 */
		'/api/og': { prerender: false },
		'/api/stats': { prerender: true, headers: { 'Content-Type': 'application/json' } },
		'/atom.xml': { prerender: true, headers: { 'Content-Type': 'application/xml' } },
		'/favicon.ico': { redirect: { to: blogConfig.favicon } },
		/**
		 * giscus 接口的同源代理（碎语的 reaction 数走它，见 composables/useGiscusCount）。
		 *
		 * 不能让浏览器直接去 fetch giscus.app —— 那个接口对任何 Origin 都硬编码返回
		 * `Access-Control-Allow-Origin: https://giscus.app`，不回显请求方，
		 * 也就是压根不打算被第三方站点跨域调用（它只服务自己的 iframe）。
		 * 于是浏览器必拦，reaction 永远读不出来。
		 *
		 * 绕开的办法不是去调 CORS 响应头（方向反了，那是我们发给别人的头），
		 * 而是把请求收回同源：前端打 /giscus-api/*，由服务端转发到 giscus.app/api/*。
		 * 同源请求根本不触发 CORS 检查。
		 *
		 * 这份只在 dev 下生效 —— 生产走 SSG（netlify-static preset），没有服务端，
		 * nitro 会把 proxy 规则丢弃。生产的那条在 netlify.toml 里，两处要一起改。
		 *
		 * 路径避开 /giscus/*：那个留给自定义主题 CSS（见 netlify.toml），撞上会被代理劫持。
		 */
		'/giscus-api/**': { proxy: 'https://giscus.app/api/**' },
		/**
		 * 娱乐页的筛选状态写在 URL query（?category=&status=）。若预渲染，产物是不带 query 的
		 * /media，payload.path 也就是 /media；水合时路由优先采信这个 renderedPath 而非地址栏
		 * （同 /memos/_shell 的坑，且 Nuxt 还会 replaceState 到 renderedPath，把地址栏 query 也抹掉），
		 * 于是深链 /media?category=game 首帧 query 为空，会先按默认(番剧·在看)取一次数、落定后再取一次。
		 * ssr:false 让本页纯客户端渲染，产物无 path，route.query 从首帧即照地址栏，深链首取即正确。
		 * 配合 nitro.prerender.routes 里登记 /media，生成可 200 直达的客户端壳。
		 */
		'/media': { ssr: false },
		/**
		 * 碎语详情页：按需服务端渲染，产物交给 Vercel 的 ISR 缓存。
		 *
		 * 碎语是运行时数据，构建期无从枚举 id，所以这页曾经是个纯客户端的 SPA 壳
		 * （预渲染 /memos/_shell，再由平台把 /memos/* 200 重写到它身上）。代价是分享出去
		 * 只有一具空壳：爬虫不跑 JS，拿到的 <title> 连模板变量都没被替换，og:* 一个不剩。
		 * 页面级的 useSeoMeta 从未在服务端跑过。
		 *
		 * 改走 SSR 之后：HTML 里就有正文首句和首图，不存在的 id 也能回真 404 而非 200 + 壳。
		 * 本项目为 /api/og 已经带着一个运行时函数（见 server/api/og.get.ts），这里是搭它的便车。
		 *
		 * 必须是 '**' 而不是 '*'：开了 isr 的路由，renderer 会把水合用的 payload 拆出去单放
		 * （_PAYLOAD_EXTRACTION = routeOptions.isr || routeOptions.cache），页面因此还要再取一次
		 * /memos/<id>/_payload.json。而 vercel preset 把 '*' 译成 [^/]*，跨不过那个斜杠，
		 * 这一取就漏出 ISR、次次落到函数上 —— HTML 命中缓存，payload 每次现算。
		 *
		 * '**' 顺带吃下 /memos 列表页倒是无妨：Vercel 的路由表里 handle: filesystem 排在
		 * ISR 规则之前，列表页有预渲染好的 index.html 顶着，走不到这条。
		 *
		 * 600 秒是缓存窗口，也是编辑一条旧碎语后线上更新的延迟上限。往长了调更省函数调用，
		 * 但改错别字要等更久。
		 */
		'/memos/**': { isr: 600 },
		'/subscriptions.opml': { prerender: true, headers: { 'Content-Type': 'application/xml' } },
	},

	runtimeConfig: {
		// @keep-sorted
		public: {
			arch,
			buildTime: Temporal.Now.zonedDateTimeISO().toString(),
			// EdgeOne 检测暂时不可用
			ci: env.TENCENTCLOUD_RUNENV === 'SCF' ? 'EdgeOne' : ciName || '',
			nodeVersion,
			platform,
		},
	},

	/** 在生产环境启用 sourcemap */
	// sourcemap: true,

	typescript: {
		nodeTsConfig: {
			// @keep-sorted
			include: [
				'../remark-plugins/**/*.ts',
				'../scripts/**/*.ts',
			],
		},
	},

	vite: {
		css: {
			preprocessorOptions: {
				scss: {
					additionalData: '@use "@/assets/css/_variable.scss" as *;',
				},
			},
		},
		define: {
			/** 在生产环境启用 Vue DevTools */
			// __VUE_PROD_DEVTOOLS__: 'true',
			/** 在生产环境启用 Vue 水合不匹配详情 */
			// __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'true',
		},
		optimizeDeps: {
			// @keep-sorted
			include: ['@shikijs/colorized-brackets', '@shikijs/transformers', '@unhead/schema-org/vue', '@vue/devtools-core', '@vue/devtools-kit', 'embla-carousel-autoplay', 'embla-carousel-vue', 'embla-carousel-wheel-gestures', 'es-toolkit/array', 'es-toolkit/math', 'es-toolkit/object', 'es-toolkit/promise', 'es-toolkit/string', 'minisearch', 'parse-domain', 'plain-shiki', 'shiki/themes/catppuccin-latte.mjs', 'shiki/themes/one-dark-pro.mjs', 'temporal-polyfill', 'vue-tippy'],
		},
		server: {
			allowedHosts: true,
		},
	},

	// @keep-sorted
	modules: [
		'@bikariya/image-viewer',
		'@bikariya/modals',
		'@bikariya/shiki',
		'@nuxt/a11y',
		'@nuxt/content',
		'@nuxt/hints',
		'@nuxt/icon',
		'@nuxt/image',
		'@nuxtjs/color-mode',
		'@nuxtjs/seo',
		'@pinia/nuxt',
		'@vueuse/nuxt',
		'nuxt-llms',
		'unplugin-yaml/nuxt',
	],

	colorMode: {
		preference: 'system',
		fallback: 'light',
		classSuffix: '',
	},

	content: {
		build: {
			markdown: {
				highlight: false,
				// @keep-sorted
				remarkPlugins: {
					[pluginPath('remark-music')]: {},
					'remark-math': {},
					'remark-reading-time': {},
				},
				// @keep-sorted
				rehypePlugins: {
					[pluginPath('rehype-meta-slots')]: {},
					'rehype-katex': {},
				},
				toc: { depth: 4, searchDepth: 4 },
			},
		},
		experimental: {
			sqliteConnector: 'native',
		},
	},

	dxup: {
		features: {
			namedLayoutSlots: true,
		},
	},

	hooks: {
		'ready': () => {
			console.info(`
================================
${pascalCase(packageJson.name)} ${packageJson.version}
${packageJson.homepage}
================================
`)
		},
		'content:file:afterParse': (ctx) => {
			const { permalink, path } = ctx.content as Record<string, string | undefined>
			// 优先使用自定义链接（permalink/abbrlink），其次隐藏基于文件路由的 URL 中的 /posts 前缀
			if (permalink)
				ctx.content.path = permalink
			else if (blogConfig.article.hidePostPrefix && path?.startsWith('/posts/'))
				ctx.content.path = path.slice('/posts'.length)
		},
	},

	icon: {
		customCollections: [
			{ prefix: 'zi', dir: './app/assets/icons' },
		],
		clientBundle: {
			scan: {
				globInclude: ['**\/*.{vue,jsx,tsx,ts,md,mdc,mdx}'],
			},
		},
	},

	image: {
		// 尽量以这些密度点对点显示
		densities: [1, 1.5, 2],
		format: ['avif', 'webp'],
		/**
		 * 在托管平台上一律关掉 @nuxt/image 的处理器。
		 *
		 * Netlify：netlify 处理器显示不了站外图片，ipx 处理器显示不了站内图片，只能彻底禁用。
		 * https://github.com/nuxt/image/issues/1353
		 *
		 * Vercel：能用，但是**计费**的（Hobby 版每月 1000 张源图），而站内图不过是
		 * favicon、头像这种，为它们烧配额不划算。何况正文和游记的图早就走 Cloudflare
		 * 自己的 /cdn-cgi/image/ 变换了（见 utils/img.ts 的 getCfImgUrl），
		 * 尺寸和格式都已经定死，再让平台优化器过一手纯属多余。
		 *
		 * 本地开发不受影响（provider 走默认的 ipx）。
		 */
		provider: NETLIFY || VERCEL ? 'none' : undefined,
	},

	linkChecker: {
		// @keep-sorted
		skipInspections: [
			'no-baseless',
			'no-non-ascii-chars',
			'no-uppercase-chars',
		],
	},

	llms: {
		domain: blogConfig.url,
		title: blogConfig.title,
		description: blogConfig.description,
	},

	ogImage: {
		enabled: false,
	},

	robots: {
		disableNuxtContentIntegration: true,
		disallow: blogConfig.article.robotsNotIndex,
	},

	site: {
		name: blogConfig.title,
		url: blogConfig.url,
		defaultLocale: blogConfig.language,
	},

})
