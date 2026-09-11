import { buildPath } from './locale.ts'

export function parsePageNumber(value: unknown): number | undefined {
	if (value === undefined)
		return 1
	if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value))
		return undefined
	const page = Number(value)
	return Number.isSafeInteger(page) ? page : undefined
}

export function paginationPath(page: number, locale: string) {
	return buildPath(page === 1 ? '/' : `/page/${page}`, locale, 'zh')
}
