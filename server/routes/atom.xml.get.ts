import type { ContentCollectionItem } from '@nuxt/content'
import { pascalCase } from 'es-toolkit/string'
import XmlBuilder from 'fast-xml-builder'
import { Temporal } from 'temporal-polyfill'
import blogConfig from '~~/blog.config'
import zhMessages from '~~/i18n/locales/zh'
import packageJson from '~~/package.json'
import { toZonedTemporal } from '~~/shared/utils/time'

const runtimeConfig = useRuntimeConfig()

const builder = new XmlBuilder({
	attributeNamePrefix: '$',
	cdataPropName: '$',
	format: true,
	ignoreAttributes: false,
	textNodeName: '_',
})

function formatIsoDate(date?: string) {
	if (!date)
		return
	try {
		return toZonedTemporal(date).toInstant().toString()
	}
	catch {
		console.error('Invalid date format', date)
		return date
	}
}

function getUrl(path: string | undefined) {
	return new URL(path ?? '', blogConfig.url).toString()
}

// term 留分类 id（机器可读），label 补上中文展示名给订阅器直接显示 ——
// 本路由只出 content_zh，故直接从 zh 词条表查名字；后续拆分三语 feed 时，
// 这里改成按各 feed 的 locale 取对应词条表即可
function getCategoryLabel(category?: string) {
	if (!category)
		return undefined
	return zhMessages.category[category as keyof typeof zhMessages.category] ?? category
}

function renderContent(post: ContentCollectionItem) {
	return [
		post.image && `<img src="${post.image}" alt="${post.title}" />`,
		post.description && `<p>${post.description}</p>`,
		`<a class="view-full" href="${getUrl(post.path)}" target="_blank">点击查看全文</a>`,
	].join(' ')
}

export default defineEventHandler(async (event) => {
	const posts = await queryCollection(event, 'content_zh')
		.where('stem', 'LIKE', 'posts/%')
		.order('date', 'DESC')
		.limit(blogConfig.feed.limit)
		.all()

	const entries = posts.map(post => ({
		id: getUrl(post.path),
		title: post.title ?? '',
		// Atom 的 <updated> 是必填元素（RFC 4287 §4.2.15），不能因为字段删了就不发。
		// 改用创建日期 —— 原先这里取的 post.updated 其实一篇文章都没写过，
		// 等于一直在给 formatIsoDate 喂 undefined，顺带上面那句 order('updated') 也是在按空列排
		updated: formatIsoDate(post.date),
		author: { name: post.author || blogConfig.author.name },
		content: {
			$type: 'html',
			$: renderContent(post),
		},
		link: { $href: getUrl(post.path) },
		summary: post.description,
		category: { $term: post.categories?.[0], $label: getCategoryLabel(post.categories?.[0]) },
		published: formatIsoDate(post.published ?? post.date),
	}))

	const feed = {
		$xmlns: 'http://www.w3.org/2005/Atom',
		id: blogConfig.url,
		title: blogConfig.title,
		updated: runtimeConfig.public.buildTime,
		description: blogConfig.description, // RSS 2.0
		author: {
			name: blogConfig.author.name,
			email: blogConfig.author.email,
			uri: blogConfig.author.homepage,
		},
		link: [
			{ $href: getUrl('atom.xml'), $rel: 'self' },
			{ $href: blogConfig.url, $rel: 'alternate' },
		],
		language: blogConfig.language, // RSS 2.0
		generator: {
			$uri: 'https://github.com/L33Z22L11/blog-v3',
			$version: packageJson.version,
			_: pascalCase(packageJson.name),
		},
		icon: blogConfig.favicon,
		logo: blogConfig.author.avatar, // Ratio should be 2:1
		rights: `© ${Temporal.Now.plainDateISO().year.toString()} ${blogConfig.author.name}`,
		subtitle: blogConfig.subtitle || blogConfig.description,
		entry: entries,
	}

	return builder.build({
		'?xml': { $version: '1.0', $encoding: 'UTF-8' },
		'?xml-stylesheet': blogConfig.feed.enableStyle ? { $type: 'text/xsl', $href: '/assets/atom.xsl' } : undefined,
		feed,
	})
})
