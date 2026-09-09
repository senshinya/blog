import { resolve } from 'node:path'
import { addTemplate, addTypeTemplate, defineNuxtModule } from '@nuxt/kit'
import blogConfig from '../../blog.config'
import { scanLocaleTrees, toPrerenderRoutes } from './scan.ts'

export interface ModuleOptions {
	locales: readonly string[]
	defaultLocale: string
}

export default defineNuxtModule<ModuleOptions>({
	meta: { name: 'i18n-manifest', configKey: 'i18nManifest' },
	setup(options, nuxt) {
		const manifest = scanLocaleTrees({
			contentDir: resolve(nuxt.options.rootDir, 'content'),
			travelsDir: resolve(nuxt.options.rootDir, 'app/travels'),
			locales: options.locales,
			isDev: nuxt.options.dev,
			hidePostPrefix: blogConfig.article.hidePostPrefix,
		})

		const prerenderRoutes = toPrerenderRoutes(manifest, options.defaultLocale)

		addTemplate({
			filename: 'i18n-manifest.mjs',
			getContents: () => [
				`export const manifest = ${JSON.stringify(manifest, null, 2)}`,
				`export const prerenderRoutes = ${JSON.stringify(prerenderRoutes, null, 2)}`,
			].join('\n'),
		})

		addTypeTemplate({
			filename: 'i18n-manifest.d.ts',
			getContents: () => [
				`declare module '#build/i18n-manifest' {`,
				`	export const manifest: Record<string, string[]>`,
				`	export const prerenderRoutes: string[]`,
				`}`,
			].join('\n'),
		})

		nuxt.options.nitro.prerender ??= {}
		nuxt.options.nitro.prerender.routes = [
			...(nuxt.options.nitro.prerender.routes ?? []),
			...prerenderRoutes,
		]
	},
})
