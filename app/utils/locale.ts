export type Manifest = Record<string, string[]>

export interface DecideInput {
	/** 当前路由路径，含可能的语言前缀 */
	path: string
	/** cookie 里记住的偏好，没有则 undefined */
	stored?: string
	/** navigator.languages，按优先级排列 */
	browser: readonly string[]
	manifest: Manifest
	locales: readonly string[]
	defaultLocale: string
}

/**
 * 去掉 basePath 尾部斜杠，但根路径本身保持为 '/'。
 *
 * @nuxtjs/i18n 默认 trailingSlash: false，站内链接不带尾斜杠，但外部进站
 * 的 URL（旧链接、搜索引擎、手输）可能带尾斜杠，例如 /daily/foo/。不归一化
 * 的话 basePath 是 /daily/foo/，清单里的 key 却是 /daily/foo，查不到就被
 * 当成「所有语言都有」，把读者跳去一个不存在的页面。
 */
function normalizeBasePath(basePath: string) {
	if (basePath === '/')
		return basePath
	return basePath.replace(/\/+$/, '') || '/'
}

/** Memo content is shared across languages; keep its expanded discussions alive. */
export function localePageKey(path: string, locales: readonly string[], defaultLocale: string) {
	const { basePath } = stripLocale(path, locales, defaultLocale)
	return basePath === '/memos' || basePath.startsWith('/memos/') ? basePath : normalizeBasePath(path)
}

/**
 * 把路径拆成语言码与不带前缀的基准路径。无前缀即默认语言。
 *
 * defaultLocale 显式传入，不从 locales[0] 推断 —— 那个数组的顺序
 * 同时是语言切换器的按钮顺序，会被重排。
 */
export function stripLocale(path: string, locales: readonly string[], defaultLocale: string) {
	const match = /^\/([^/]+)(?=\/|$)/.exec(path)
	const head = match?.[1]
	if (head && locales.includes(head)) {
		const rest = path.slice(head.length + 1)
		return { locale: head, basePath: normalizeBasePath(rest || '/') }
	}
	return { locale: defaultLocale, basePath: normalizeBasePath(path) }
}

/**
 * 解析偏好语言：cookie 优先，其次浏览器语言列表，允许 ja-JP → ja。
 *
 * 与「是否跳转」解耦，独立导出 —— 中间件在缺译文而不跳转时也要固化这个值。
 */
export function resolvePreferred(
	stored: string | undefined,
	browser: readonly string[],
	locales: readonly string[],
) {
	if (stored && locales.includes(stored))
		return stored
	for (const tag of browser) {
		const base = tag.toLowerCase().split('-')[0]!
		const hit = locales.find(l => l === base)
		if (hit)
			return hit
	}
	return undefined
}

/**
 * 把不带前缀的 basePath 拼上目标语言前缀。默认语言不加前缀。
 *
 * 根路径要特殊处理：非默认语言的首页是 /en，不是 /en/ —— 本站
 * trailingSlash: false，若不特殊处理，`/${locale}${basePath}` 在 basePath
 * 为 '/' 时会拼出带尾斜杠的 /en/，一个实际不存在（404 或被重定向）的 URL。
 *
 * 导出给 useLocaleAlternates 复用：它和这里的 suggestLocale 都要把 basePath
 * 拼成同一个目标 URL —— 前者用来发 hreflang，后者用来决定跳转去哪，
 * 两处拼法一旦分裂，hreflang 就可能指向一个会跳转或 404 的地址，
 * 这种问题在浏览器里不报错、任何测试都测不出来，必须靠共用同一份实现来保证一致。
 *
 * basePath 必须是不带语言前缀且已归一化的路径，即从 stripLocale 或 normalizeBasePath 得来。
 * 若传入已有前缀的路径（如 /en/archive）或带尾斜杠的路径（如 /archive/），会无声地产生错误的结果（如 /en/en/archive）。
 */
export function buildPath(basePath: string, locale: string, defaultLocale: string) {
	if (locale === defaultLocale)
		return basePath
	return basePath === '/' ? `/${locale}` : `/${locale}${basePath}`
}

/**
 * 把 Content 文档的 path/id 拼上当前语言前缀，用作站内链接的 `:to`。
 *
 * content_zh/content_en/content_ja 三个 collection 用 `source: { prefix: '' }` 抹掉了
 * 各自的语言目录段（见 nuxt.config），同一篇文章在三个 collection 里的 path 完全相同——
 * 这是特意为了让 stripLocale 反查、queryCollectionItemSurroundings 等按 basePath 查询的
 * 地方不用关心语言。但也意味着这个 path 不能直接绑给 NuxtLink 当链接用：@nuxtjs/i18n
 * 不会给普通 <NuxtLink> 自动加前缀（全站唯一在用的路由帮手是 LangToggle 里的
 * useSwitchLocalePath），直接绑 path 会让英文/日文页面的文章链接全部指向中文版。
 *
 * archive.vue、index.vue、PostSurround.vue、SearchItem.vue、PostSlide.vue、preview.vue
 * 六处都要做同一次拼接，抽成一个函数以免各写一份、复用 buildPath 已验证过的拼接规则
 * （含根路径的特殊处理）。
 *
 * path 允许 undefined：PostSurround 的上一篇/下一篇在文章边界处为空，SearchItem 的
 * props 也是 Partial<>——原样透传给 UtilLink，按无链接处理。
 *
 * 同 buildPath：传入的 path 必须是不带语言前缀的 basePath，传入已带前缀的路径
 * （如 /en/daily/foo）会拼出错误的 /en/en/daily/foo，调用方需自行保证——这里的调用方
 * 全部来自 content collection 查询结果或 stem 拼接，从不带前缀，满足这个前提。
 */
export function resolveContentPath(path: string | undefined, locale: string, defaultLocale = 'zh') {
	return path === undefined ? undefined : buildPath(path, locale, defaultLocale)
}

function isLocalRedirectPath(path: string) {
	return path.startsWith('/') && !path.startsWith('//') && !/[\\\s]/.test(path)
}

/** 首屏和站内跳转共用同一个站内地址，保留原 URL 的查询参数和锚点。 */
export function localeRedirectPath(target: string, fullPath: string, origin: string): string | undefined {
	if (!isLocalRedirectPath(target))
		return undefined
	const destination = new URL(target, origin)
	if (destination.origin !== new URL(origin).origin || !isLocalRedirectPath(destination.pathname))
		return undefined
	const source = new URL(fullPath, origin)
	destination.search = source.search
	destination.hash = source.hash
	return `${destination.pathname}${destination.search}${destination.hash}`
}

/**
 * 返回可建议切换的路径；调用者必须等待用户主动选择。
 *
 * 留在原地的三种情形：没有可用偏好、偏好与当前语言一致、当前页没有偏好语言的译文。
 * 清单里查不到的路径视为所有语言都有 —— 那是应用页面（/archive 等），
 * i18n 会为每个语言生成。
 */
export function suggestLocale({ path, stored, browser, manifest, locales, defaultLocale }: DecideInput) {
	const preferred = resolvePreferred(stored, browser, locales)
	if (!preferred)
		return undefined

	const { locale: current, basePath } = stripLocale(path, locales, defaultLocale)
	if (preferred === current)
		return undefined

	const available = manifest[basePath]
	if (available && !available.includes(preferred))
		return undefined

	const target = buildPath(basePath, preferred, defaultLocale)
	// 剥掉 /en 等前缀后可能露出 //host，不能交给首屏的 location.replace。
	return isLocalRedirectPath(target) ? target : undefined
}

/**
 * 这次导航是不是「同一页换个语言」。
 *
 * 用途是入场动画。切换语言会换到另一条路由记录（/、/en、/ja 是三条），
 * NuxtPage 的 key 取自匹配到的记录路径，key 一变整个页面就卸载重建，
 * 列表卡片全成了新元素，于是把入场动画重放一遍 —— float-in 带 backwards
 * 填充又逐条延迟，看上去就是整列先消失、再一条条淡进来。换语言不是
 * 「到达一个新页面」，这段入场本就不该播。
 *
 * from 允许 undefined：首次进站时没有上一个路由（vue-router 的
 * START_LOCATION），那是真正的到达，返回 false 让动画照常播。
 */
export function isLocaleSwitch(
	from: string | undefined,
	to: string,
	locales: readonly string[],
	defaultLocale: string,
) {
	if (from === undefined)
		return false

	const a = stripLocale(from, locales, defaultLocale)
	const b = stripLocale(to, locales, defaultLocale)
	return a.basePath === b.basePath && a.locale !== b.locale
}
