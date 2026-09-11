import { resolve } from 'node:path'
import { addTemplate, addTypeTemplate, defineNuxtModule, updateTemplates } from '@nuxt/kit'
import blogConfig from '../../blog.config'
import { generateTravelData } from './sources.ts'

export default defineNuxtModule({
	meta: { name: 'publication' },
	setup(_options, nuxt) {
		if (!nuxt.options.dev) {
			const previewFile = resolve(nuxt.options.srcDir, 'pages/preview.vue')
			nuxt.hook('pages:extend', (pages) => {
				const removePreviews = (entries: typeof pages) => {
					for (let index = entries.length - 1; index >= 0; index--) {
						const page = entries[index]!
						if (page.file && resolve(page.file) === previewFile)
							entries.splice(index, 1)
						else if (page.children)
							removePreviews(page.children)
					}
				}
				removePreviews(pages)
			})
		}

		const template = addTemplate({
			filename: 'travel-data.mjs',
			getContents: () => generateTravelData(
				resolve(nuxt.options.rootDir, 'app/travels'),
				blogConfig.locales.map(locale => locale.code),
				nuxt.options.dev,
			),
		})
		addTypeTemplate({
			filename: 'travel-data.d.ts',
			getContents: () => [
				`declare module '#build/travel-data' {`,
				`\texport const travelsByLocale: Record<string, import('~/types/travel').Travel[]>`,
				`}`,
			].join('\n'),
		})
		if (nuxt.options.dev) {
			nuxt.hook('builder:watch', async (_event, path) => {
				if (path.endsWith('.yaml'))
					await updateTemplates({ filter: item => item.filename === template.filename })
			})
		}
	},
})
