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
 * 导出给 useLocaleAlternates 复用：它和这里的 decideLocale 都要把 basePath
 * 拼成同一个目标 URL —— 前者用来发 hreflang，后者用来决定跳转去哪，
 * 两处拼法一旦分裂，hreflang 就可能指向一个会跳转或 404 的地址，
 * 这种问题在浏览器里不报错、任何测试都测不出来，必须靠共用同一份实现来保证一致。
 */
export function buildPath(basePath: string, locale: string, defaultLocale: string) {
	if (locale === defaultLocale)
		return basePath
	return basePath === '/' ? `/${locale}` : `/${locale}${basePath}`
}

/**
 * 返回应当跳转到的路径，undefined 表示留在原地。
 *
 * 留在原地的三种情形：没有可用偏好、偏好与当前语言一致、当前页没有偏好语言的译文。
 * 清单里查不到的路径视为所有语言都有 —— 那是应用页面（/archive 等），
 * i18n 会为每个语言生成。
 */
export function decideLocale({ path, stored, browser, manifest, locales, defaultLocale }: DecideInput) {
	const preferred = resolvePreferred(stored, browser, locales)
	if (!preferred)
		return undefined

	const { locale: current, basePath } = stripLocale(path, locales, defaultLocale)
	if (preferred === current)
		return undefined

	const available = manifest[basePath]
	if (available && !available.includes(preferred))
		return undefined

	return buildPath(basePath, preferred, defaultLocale)
}
