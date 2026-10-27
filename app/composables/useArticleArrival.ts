import type { ArticleProps } from '~/types/article'

export interface ArticleArrival {
	path: string
	post: ArticleProps
	resolved?: ArticleProps
	cover?: string
	visible: boolean
	moving: boolean
	loading: boolean
	failed: boolean
}

/** Only display metadata crosses the navigation boundary; full content keeps its own lifecycle. */
function preview(post: ArticleProps): ArticleProps {
	return {
		path: post.path,
		title: post.title,
		description: post.description,
		image: post.image,
		date: post.date,
		type: post.type,
		categories: post.categories ? [...post.categories] : undefined,
		readingTime: post.readingTime ? { ...post.readingTime } : undefined,
		meta: post.meta ? { coverDim: post.meta.coverDim, coverFilter: post.meta.coverFilter, hideInfo: post.meta.hideInfo } : undefined,
	}
}

export function useArticleArrival() {
	const arrival = useState<ArticleArrival | null>('article-arrival', () => null)

	function begin(event: MouseEvent, post: ArticleProps) {
		if (!import.meta.client || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
			return
		const link = event.currentTarget as HTMLAnchorElement
		if (!post.title || link.origin !== window.location.origin || link.hash || link.target === '_blank')
			return
		const image = link.querySelector('img')
		document.querySelectorAll<HTMLElement>('[data-article-trigger]').forEach(element => delete element.dataset.articleTrigger)
		link.dataset.articleTrigger = ''
		arrival.value = {
			path: normalizeContentPath(link.pathname),
			post: preview(post),
			cover: image?.complete && image.naturalWidth ? image.currentSrc || image.src : undefined,
			visible: false,
			moving: false,
			loading: true,
			failed: false,
		}
	}

	function resolve(path: string, post: ArticleProps | null | undefined) {
		const current = arrival.value
		if (!current?.visible || current.path !== normalizeContentPath(path))
			return
		current.failed = !post
		if (post)
			current.resolved = preview(post)
	}

	return { arrival, begin, resolve }
}
