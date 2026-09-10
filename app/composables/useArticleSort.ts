import type { ArticleProps } from '~/types/article'
import { orderBy } from 'es-toolkit/array'

/** 本站文章始终按创建日期倒序，筛选与分页保留该顺序。 */
export function useArticleSort<T extends Pick<ArticleProps, 'date'>>(list: MaybeRefOrGetter<readonly T[]>) {
	return {
		listSorted: computed(() => orderBy(toValue(list), ['date'], ['desc'])),
	}
}
