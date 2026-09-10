import { runLocaleMotion } from '~/utils/localeMotion'

/** Keep the old frame visible until Nuxt's async page has rendered. */
export function useLocaleMotion() {
	const nuxtApp = useNuxtApp()
	const router = useRouter()

	return (path: string) => runLocaleMotion(async () => {
		if (router.currentRoute.value.fullPath === path)
			return

		let finish!: () => void
		const rendered = new Promise<void>((resolve) => {
			finish = resolve
		})
		const unhook = nuxtApp.hook('page:finish', () => {
			if (router.currentRoute.value.fullPath === path)
				finish()
		})
		// A cancelled navigation or a page that reuses its instance may not emit
		// page:finish. Never leave a native snapshot blocking the page indefinitely.
		const timeout = window.setTimeout(finish, 2000)
		try {
			const failure = await router.push(path)
			if (!failure)
				await rendered
			await nextTick()
		}
		finally {
			clearTimeout(timeout)
			unhook()
		}
	})
}
