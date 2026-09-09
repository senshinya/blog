import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { isTravelDraftSource } from '../../app/travels/draft.ts'

export type Manifest = Record<string, string[]>

interface ScanOptions {
	contentDir: string
	travelsDir: string
	locales: readonly string[]
	isDev: boolean
	/** 对应 blogConfig.article.hidePostPrefix：是否隐藏文章路由里的 /posts 前缀 */
	hidePostPrefix: boolean
}

function walk(dir: string): string[] {
	let out: string[] = []
	let entries: string[]
	try {
		entries = readdirSync(dir)
	}
	catch {
		return out
	}
	for (const name of entries) {
		const full = join(dir, name)
		if (statSync(full).isDirectory())
			out = out.concat(walk(full))
		else
			out.push(full)
	}
	return out
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/
// 只捕获整行，行内注释与首尾空白留给字符串方法处理，避免相邻量词互相"借位"触发
// regexp/no-super-linear-backtracking（例如 `[ \t]*` 紧跟 `.+?` 这种写法）。
const PERMALINK_LINE_RE = /^permalink:([^\r\n]*)\r?$/m

/**
 * 只在 frontmatter 块（文件开头 `---` 到下一个 `---` 之间）里找顶层 permalink，
 * 不对整份文本做匹配，避免正文里恰好出现一行 `permalink: xxx` 被误判成配置。
 */
function extractPermalink(source: string): string | undefined {
	const frontmatter = source.match(FRONTMATTER_RE)?.[1]
	if (!frontmatter)
		return undefined
	const line = frontmatter.match(PERMALINK_LINE_RE)?.[1]
	if (line === undefined)
		return undefined
	const hashIndex = line.indexOf('#')
	const raw = hashIndex === -1 ? line : line.slice(0, hashIndex)
	const value = raw.trim().replace(/^['"]|['"]$/g, '')
	return value || undefined
}

/**
 * content/<locale>/posts/daily/foo.md → /daily/foo；content/<locale>/friends.md → /friends。
 *
 * 与 nuxt.config.ts 的 content:file:afterParse hook 语义对齐：frontmatter 顶层写了
 * permalink 就整个替换掉推导出的路径，否则再按 hidePostPrefix 决定要不要剥 /posts 前缀。
 */
function contentRoutePath(localeRoot: string, file: string, hidePostPrefix: boolean): string {
	const permalink = extractPermalink(readFileSync(file, 'utf8'))
	if (permalink)
		return permalink

	const rel = relative(localeRoot, file).split(sep).join('/')
	const noExt = rel.replace(/\.md$/, '')
	const withSlash = `/${noExt}`
	return hidePostPrefix && withSlash.startsWith('/posts/') ? withSlash.slice('/posts'.length) : withSlash
}

function add(manifest: Manifest, path: string, locale: string) {
	const list = manifest[path] ??= []
	if (!list.includes(locale))
		list.push(locale)
}

export function scanLocaleTrees({ contentDir, travelsDir, locales, isDev, hidePostPrefix }: ScanOptions): Manifest {
	const manifest: Manifest = {}

	for (const locale of locales) {
		const root = join(contentDir, locale)
		for (const file of walk(root)) {
			if (!file.endsWith('.md'))
				continue
			add(manifest, contentRoutePath(root, file, hidePostPrefix), locale)
		}
	}

	for (const locale of locales) {
		const root = join(travelsDir, locale)
		for (const file of walk(root)) {
			if (!file.endsWith('.yaml'))
				continue
			if (!isDev && isTravelDraftSource(readFileSync(file, 'utf8')))
				continue
			const slug = relative(root, file).split(sep).join('/').replace(/\.yaml$/, '')
			add(manifest, `/travels/${slug}`, locale)
		}
	}

	for (const path of Object.keys(manifest))
		manifest[path]!.sort()

	return manifest
}

/** 把清单摊平成预渲染路由：默认语言不带前缀，其余带前缀。 */
export function toPrerenderRoutes(manifest: Manifest, defaultLocale: string): string[] {
	const routes: string[] = []
	for (const [path, localeList] of Object.entries(manifest)) {
		for (const locale of localeList)
			routes.push(locale === defaultLocale ? path : `/${locale}${path}`)
	}
	return routes.sort()
}
