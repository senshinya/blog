/**
 * 语言偏好存储。在 prefix_except_default 下「设置语言」等同于「导航」，
 * 所以这个 cookie 是纯粹的偏好记录，不参与路由，与 i18n 的职责不重叠。
 */
export function useLocalePreference() {
	const stored = useCookie<string | null>('blog_locale', {
		default: () => null,
		maxAge: 60 * 60 * 24 * 365,
		sameSite: 'lax',
		path: '/',
	})

	function persist(code: string) {
		stored.value = code
	}

	return { stored, persist }
}
