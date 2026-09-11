import type { ReadTimeResults } from 'reading-time'
import { defineCollection } from '@nuxt/content'
import { defineSitemapSchema } from '@nuxtjs/sitemap/content'
import { z } from 'zod'
import blogConfig from './blog.config'

type ArticleType = keyof typeof blogConfig.article.types
// 文章类型已在 blog.config 中定义，此处使用 any 类型绕过 zod 类型验证
const articleTypes = Object.keys(blogConfig.article.types) as any

export const AUTHORSHIP_TYPES = ['human-only', 'human-ai-polished', 'ai-human-reviewed', 'ai-only'] as const
export type Authorship = typeof AUTHORSHIP_TYPES[number]

export interface ArticleSchema {
	title?: string
	description?: string
	seoDescription?: string
	date?: string
	published?: string
	categories?: string[]
	tags?: string[]
	type?: ArticleType
	/** Original authorship; translations retain the same declaration. */
	authorship?: Authorship

	image?: string
	recommend?: number
	references?: { title?: string, link?: string }[]
	/** TODO */
	draft?: boolean
	permalink?: string

	readingTime?: ReadTimeResults
}

const articleSchema = z.object({
	title: z.string().optional(),
	description: z.string().optional(),
	seoDescription: z.string().optional(),
	date: z.string().optional(),
	published: z.string().optional(),
	categories: z.array(z.string()).default([blogConfig.defaultCategory]),
	tags: z.array(z.string()).default([]),
	type: z.enum(articleTypes).optional().default(articleTypes[0]),

	authorship: z.enum(AUTHORSHIP_TYPES).default('human-only'),

	image: z.string().optional(),
	recommend: z.number().optional(),
	references: z.array(z.object({
		title: z.string().optional(),
		link: z.string().optional(),
	})).optional(),
	draft: z.boolean().default(false),
	permalink: z.string().optional(),

	readingTime: z.object({
		text: z.string(),
		minutes: z.number(),
		time: z.number(),
		words: z.number(),
	}),
}) satisfies z.ZodType<ArticleSchema>

export const LOCALES = ['zh', 'en', 'ja'] as const
export type Locale = typeof LOCALES[number]

function makeCollection(locale: Locale) {
	return defineCollection({
		source: { include: `${locale}/**`, prefix: '' },
		type: 'page',
		schema: articleSchema.extend({
			sitemap: defineSitemapSchema({
				name: `content_${locale}`,
				onUrl: (url, entry) => {
					const lastmod = (entry.published || entry.date) as string | undefined
					if (lastmod)
						url.lastmod = new Date(lastmod).toLocaleDateString('sv')
				},
				z,
			}),
		}),
	})
}

export const collections = {
	content_zh: makeCollection('zh'),
	content_en: makeCollection('en'),
	content_ja: makeCollection('ja'),
}
