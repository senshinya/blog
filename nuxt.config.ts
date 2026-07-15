import { readdirSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { arch, env, version as nodeVersion, platform } from 'node:process'
import { pathToFileURL } from 'node:url'
import { name as ciName, CLOUDFLARE_PAGES, GITHUB_ACTIONS, NETLIFY, VERCEL } from 'ci-info'
import { mapValues } from 'es-toolkit/object'
import { pascalCase } from 'es-toolkit/string'
import { Temporal } from 'temporal-polyfill'
import blogConfig from './blog.config'
import packageJson from './package.json'
import redirectList from './redirects.json'

function pluginPath(path: string) {
	return pathToFileURL(resolve(`./remark-plugins/${path}.ts`)).href
}

// 游记数据是 app/travels/*.yaml。加载 nuxt.config 的 jiti 不认 yaml，配置期读不到内容，
// 所以从文件名推路由 —— 文件名即 slug，这条约定由迁移脚本和 app/travels/index.ts 共同保证。
const travelRoutes = readdirSync(resolve('./app/travels'))
	.filter(file => file.endsWith('.yaml'))
	.map(file => `/travels/${basename(file, '.yaml')}`)

// 此处配置无需修改
export default defineNuxtConfig({
	app: {
		head: {
			meta: [
				{ name: 'author', content: [blogConfig.author.name, blogConfig.author.email].filter(Boolean).join(', ') },
				{ name: 'color-scheme', content: 'light dark' },
				// 此处为元数据的生成器标识，不建议修改
				{ 'name': 'generator', 'content': `${pascalCase(packageJson.name)} ${packageJson.version}`, 'data-github-repo': packageJson.homepage },
				{ name: 'mobile-web-app-capable', content: 'yes' },
			],
			link: [
				{ rel: 'icon', href: blogConfig.favicon },
				{ rel: 'alternate', type: 'application/atom+xml', href: '/atom.xml' },
				{ rel: 'preconnect', href: 'https://giscus.app' },
				{ rel: 'stylesheet', href: 'https://cdnjs.snrat.com/ajax/libs/KaTeX/0.16.44/katex.min.css', media: 'print', onload: 'this.media="all"' },
				// "InterVariable", "Inter", "InterDisplay"
				{ rel: 'stylesheet', href: 'https://rsms.me/inter/inter.css', media: 'print', onload: 'this.media="all"' },
				// "JetBrains Mono", 思源宋体 "Noto Serif SC"
				{ rel: 'preconnect', href: 'https://fonts.gstatic.cn', crossorigin: '' },
				{ rel: 'stylesheet', href: 'https://fonts.googleapis.cn/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Noto+Serif+SC:wght@200..900&display=swap', media: 'print', onload: 'this.media="all"' },
				// 抖音美好体 "DOUYINSANSBOLD-GB"
				{ rel: 'stylesheet', href: 'https://fonts.bytedance.com/dfd/api/v1/css?family=DOUYINSANSBOLD-GB&display=swap', media: 'print', onload: 'this.media="all"' },
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
			// /memos/_shell 是碎语详情页的 SPA 壳。碎语是运行时数据（构建期取数只会拿到
			// 上次部署的快照），所以 /memos/<id> 无法在构建期枚举，静态产物里也就没有对应的
			// HTML 文件。办法是预渲染一个「加载态」的壳，再由各平台把 /memos/* 的请求 200 重写到
			// 它身上（Netlify 见 public/_redirects，Vercel 见下方 vercel.config.routes），
			// 剩下的交给客户端路由。
			//
			// memo 的 id 是 22 位 nanoid，撞不上 _shell 这个名字。
			// /media 配了 ssr:false（见 routeRules），crawler 不会渲染它，显式登记才能生成
			// 那个纯客户端壳（/media/index.html）。路径是静态的，直接命中该文件，无需像碎语那样重写。
			routes: ['/travels', ...travelRoutes, '/memos/_shell', '/media'],
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
					/**
					 * 碎语详情页的 SPA 回退：把 /memos/<id> 重写到预渲染出来的壳上，
					 * 由客户端路由接管（见 nitro.prerender.routes 的说明）。
					 *
					 * 用 (.+) 而非 (.*)：后者会连 /memos/ 本身一起吞掉，把列表页顶成详情页的壳。
					 * 这条排在 handle: filesystem 之前，故 dest 改写后仍会回到文件系统去取
					 * memos/_shell 那个产物；/memos（列表页）不带尾斜杠，压根不匹配。
					 */
					{ src: '/memos/(.+)', dest: '/memos/_shell' },
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
		 * 碎语详情页的壳必须是**纯客户端**的，不能被服务端渲染 —— 这是整套 SPA 回退的关键。
		 *
		 * 任何经服务端渲染的页面，payload 里都会带上它被渲染时的路径（nuxt/app/nuxt.ts 中
		 * `payload.path = ssrContext.url`）。而水合时 Nuxt 的路由插件**优先采信这个路径**，
		 * 而不是地址栏（pages/runtime/plugins/router.ts 的 createCurrentLocation：
		 * 二者不一致时取 renderedPath）。于是壳被重写到 /memos/<id> 上之后，
		 * 路由会当场跳回 /memos/_shell，页面转头去取一条叫 "_shell" 的碎语。
		 *
		 * ssr: false 之后这个壳压根不经服务端渲染，payload 里没有 path，
		 * 路由只能照地址栏办事 —— 这才是我们要的。顺带也不再有水合不匹配可言。
		 */
		'/memos/_shell': { ssr: false },
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

	sitemap: {
		// _shell 是碎语详情页的 SPA 壳（见 nitro.prerender.routes），不是一个可读的页面。
		// 它只因为被预渲染才会被 sitemap 收录，得手动摘出去。
		exclude: ['/memos/_shell'],
	},
})
