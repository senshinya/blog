interface UsePaginationOptions {
	initialPage?: number
	perPage?: number
	bindQuery?: string
}

export default function usePagination<T>(list: MaybeRefOrGetter<T[]>, options?: UsePaginationOptions) {
	const appConfig = useAppConfig()
	const {
		initialPage = 1,
		perPage = appConfig.pagination.perPage || 10,
		bindQuery,
	} = options || {}

	const totalPages = computed(() => Math.ceil(toValue(list).length / perPage) || initialPage)

	function transformPage(val: string) {
		const page = Number(val)
		return page >= 1 && page <= totalPages.value ? page : initialPage
	}

	// 仅从无查询参数增加 query 时 push 一次
	const mode = computed({
		get: () => bindQuery && useRoute().query[bindQuery] ? 'replace' : 'push',
		set() { },
	})

	const page = bindQuery
		? useRouteQuery(bindQuery, initialPage.toString(), { transform: transformPage, mode })
		: ref(initialPage)

	const listPaged = computed(() => {
		const start = (page.value - 1) * perPage
		return toValue(list).slice(start, start + perPage)
	})

	// 不应在此处 watch list

	// 翻页只改 query 不改 path，而 Nuxt 默认的 scrollBehavior 在 to.path === from.path
	// 时不滚动（它假定同路径的 query 变化是筛选/排序，不该打断阅读位置）。分页是例外：
	// 内容整个换掉了，视口却停在原地，用户会落在新一页的中间，故在此显式处理。
	if (import.meta.client) {
		watch(page, () => {
			// 不指定 behavior，缺省的 auto 会继承全局 CSS 的 scroll-behavior: smooth，
			// 从而与文章页切换上/下一篇时的滚动手感一致（那里是真实路由跳转，
			// Nuxt 默认 scrollBehavior 返回 { top: 0 }，同样走 CSS 的平滑）。
			// 减少动效的用户已由 CSS 里的 prefers-reduced-motion 降级为 auto。
			window.scrollTo({ top: 0 })
		})
	}

	return {
		totalPages,
		page,
		listPaged,
	}
}

/**
 * 生成分页数组
 *
 * 根据当前页码、扩展范围和总页数，生成一个用于显示的分页数组，包含起始页、结束页和省略符号位置。
 *
 * @param current 当前页码
 * @param total 总页数
 * @param expand 当前页码的扩展范围，默认值为1
 * @returns  返回一个包含可显示页码的数组。
 * 数组中的 `Number.NEGATIVE_INFINITY` 表示向前省略页码符号（...）的位置；
 * 数组中的 `Number.POSITIVE_INFINITY` 表示向后省略页码符号（...）的位置。
 *
 */
export function getPaginationIndicator(current: number, total: number, expand: number = 1) {
	const start = Math.max(2, Math.min(current - expand, total - 2 * expand))
	const end = Math.min(total, start + 2 * expand)
	const pageArr = Array.from({ length: end - start + 1 }, (_, i) => start + i)
	start > 3 && pageArr.unshift(Number.NEGATIVE_INFINITY)
	start === 3 && pageArr.unshift(2)
	start > 1 && pageArr.unshift(1)
	end < total - 2 && pageArr.push(Number.POSITIVE_INFINITY)
	end === total - 2 && pageArr.push(total - 1)
	end < total && pageArr.push(total)
	return pageArr
}
