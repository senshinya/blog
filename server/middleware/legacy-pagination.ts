import { paginationPath, parsePageNumber } from '../../app/utils/pagination'

/** Runtime hosts permanently normalize legacy query pagination. */
export default defineEventHandler((event) => {
	const url = getRequestURL(event)
	const home = /^\/(en|ja)?\/?$/.exec(url.pathname)
	if (!home || !url.searchParams.has('page'))
		return
	const page = parsePageNumber(url.searchParams.get('page'))
	if (!page)
		return
	url.searchParams.delete('page')
	const query = url.searchParams.toString()
	return sendRedirect(event, `${paginationPath(page, home[1] ?? 'zh')}${query ? `?${query}` : ''}`, 301)
})
