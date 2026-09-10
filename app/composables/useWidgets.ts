import { pascalCase } from 'es-toolkit/string'
import {
	ContentRenderer,
	LazyBlogWidget,
	LazyWidgetBlogLog,
	LazyWidgetBlogStats,
	LazyWidgetBlogTech,
	LazyWidgetEmpty,
	LazyWidgetMemos,
	WidgetToc,
} from '#components'

// @keep-sorted
const rawWidgets = {
	LazyWidgetBlogLog,
	LazyWidgetBlogStats,
	LazyWidgetBlogTech,
	LazyWidgetEmpty,
	LazyWidgetMemos,
	// 目录随页面代码加载，避免首次导航时异步占位让 #blog-aside:empty 隐藏整栏。
	LazyWidgetToc: WidgetToc,
}

type RawWidgetName = keyof typeof rawWidgets

/** 若首字母大写还需移除`-`前缀 */
type KebabCase<S extends string> = S extends `${infer First}${infer Rest}`
	? `${First extends Capitalize<First> ? '-' : ''}${Lowercase<First>}${KebabCase<Rest>}`
	: ''

type RemovePrefix<S extends string, Prefix extends string> = S extends `${Prefix}${infer Rest}` ? Rest : S

export type WidgetName = RemovePrefix<KebabCase<RawWidgetName>, '-lazy-widget-'> | `meta-aside-${string}`

export default function useWidgets(widgetList: MaybeRefOrGetter<WidgetName[]>) {
	const { metaSlots } = useArticle()
	const { t } = useI18n()

	function renderMetaSlots(widgetName: WidgetName) {
		const slotsTree = metaSlots.value?.[widgetName.slice('meta-'.length)]
		return h(
			LazyBlogWidget,
			{ card: !slotsTree, ...slotsTree?.props },
			() => slotsTree
				? h(ContentRenderer, { value: slotsTree })
				: t('widget.notFound', { name: widgetName }),
		)
	}

	const widgets = computed(() => toValue(widgetList).map(widgetName => ({
		name: widgetName,
		comp: widgetName.startsWith('meta-aside-')
			? renderMetaSlots(widgetName)
			: rawWidgets[`LazyWidget${pascalCase(widgetName)}` as RawWidgetName],
	})))

	return {
		widgets,
	}
}
