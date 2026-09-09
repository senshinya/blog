import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { isTravelDraftSource } from '../../app/travels/draft.ts'

export type Manifest = Record<string, string[]>

interface ScanOptions {
	contentDir: string
	travelsDir: string
	locales: readonly string[]
	isDev: boolean
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

/** content/<locale>/posts/daily/foo.md → /daily/foo；content/<locale>/friends.md → /friends */
function contentRoutePath(localeRoot: string, file: string) {
	const rel = relative(localeRoot, file).split(sep).join('/')
	const noExt = rel.replace(/\.md$/, '')
	const withSlash = `/${noExt}`
	return withSlash.startsWith('/posts/') ? withSlash.slice('/posts'.length) : withSlash
}

function add(manifest: Manifest, path: string, locale: string) {
	const list = manifest[path] ??= []
	if (!list.includes(locale))
		list.push(locale)
}

export function scanLocaleTrees({ contentDir, travelsDir, locales, isDev }: ScanOptions): Manifest {
	const manifest: Manifest = {}

	for (const locale of locales) {
		const root = join(contentDir, locale)
		for (const file of walk(root)) {
			if (!file.endsWith('.md'))
				continue
			add(manifest, contentRoutePath(root, file), locale)
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
