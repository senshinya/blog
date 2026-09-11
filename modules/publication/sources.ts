import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { parse } from 'yaml'

function filesUnder(root: string): string[] {
	return readdirSync(root, { recursive: true, withFileTypes: true })
		.filter(entry => entry.isFile())
		.map(entry => join(entry.parentPath, entry.name))
		.sort()
}

/** YAML parsing keeps quoted keys, aliases and boolean spelling consistent with travel data. */
export function isTravelDraftSource(source: string): boolean {
	return parse(source)?.draft === true
}

/** Read only frontmatter; a draft-looking line in the body is ordinary content. */
export function isPrivateContentSource(path: string, source: string): boolean {
	if (path.split(sep).join('/').startsWith('previews/'))
		return true
	// Match remark-mdc's delimiter boundaries, including trailing whitespace.
	const content = source.replace(/^\uFEFF/, '')
	if (!content.startsWith('---'))
		return false
	const end = content.indexOf('\n---')
	if (end === -1)
		return false
	const frontmatter = content.slice(4, content[end - 1] === '\r' ? end - 1 : end)
	return frontmatter ? parse(frontmatter)?.draft === true : false
}

/** Exclude sources before Nuxt Content parsing, search indexing and public SQL dumps. */
export function getContentSourceExcludes(contentDir: string, locale: string, isDev: boolean): string[] {
	if (isDev)
		return []
	const root = join(contentDir, locale)
	const drafts = filesUnder(root)
		.filter(file => file.endsWith('.md'))
		.filter(file => isPrivateContentSource(relative(root, file), readFileSync(file, 'utf8')))
		.map(file => relative(contentDir, file).split(sep).join('/'))
	return [`${locale}/previews/**`, ...drafts]
}

/** Serialize permitted travel data at build time; private YAML never becomes a bundle import. */
export function generateTravelData(travelsDir: string, locales: readonly string[], isDev: boolean): string {
	const travelsByLocale = Object.fromEntries(locales.map((locale) => {
		const travels = filesUnder(join(travelsDir, locale))
			.filter(file => file.endsWith('.yaml'))
			.map(file => parse(readFileSync(file, 'utf8')) as Record<string, unknown>)
			.filter(travel => isDev || travel.draft !== true)
		return [locale, travels]
	}))
	return `export const travelsByLocale = ${JSON.stringify(travelsByLocale)}\n`
}
