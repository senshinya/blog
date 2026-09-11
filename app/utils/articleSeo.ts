interface SeoArticle {
	title?: string
	description?: string
	seoDescription?: string
	date?: string
	published?: string
	image?: string
	tags?: string[]
}

interface SeoSite {
	url: string
	author: { name: string, homepage: string, avatar: string }
}

/** Content timestamps without an offset were authored in the blog's China timezone. */
export function publicationDate(value?: string) {
	if (!value)
		return undefined
	if (/^\d{4}-\d{2}-\d{2}$/.test(value))
		return value
	return value.replace(' ', 'T').replace(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})$/, '$1+08:00')
}

export function articleSchemaData(post: SeoArticle, path: string, language: string, site: SeoSite) {
	const url = new URL(path, site.url).href
	const personId = new URL('/#author', site.url).href
	return {
		person: {
			'@type': 'Person' as const,
			'@id': personId,
			'name': site.author.name,
			'url': 'https://shinya.click/',
			'sameAs': ['https://shinya.click/', site.author.homepage],
		},
		article: {
			'@type': 'BlogPosting' as const,
			'@id': `${url}#article`,
			'headline': post.title,
			'description': post.seoDescription || post.description,
			'image': new URL(post.image || '/icons/og-logo.png', site.url).href,
			'author': { '@id': personId },
			'datePublished': publicationDate(post.date || post.published),
			'inLanguage': language,
			'mainEntityOfPage': url,
			'keywords': post.tags,
		},
	}
}
