/**
 * 中文是词条的唯一真源。不写 as const —— 值需要推断成 string，
 * 否则 MessageSchema 会退化成字面量类型，另外两种语言无法满足。
 */
const zh = {
	lang: { unavailable: '该页暂无此语言版本' },
	nav: {
		articles: '文章',
		travels: '游记',
		memos: '碎语',
		media: '娱乐',
		archive: '归档',
		friends: '友链',
		skipToContent: '跳转到主要内容',
	},
	sidebar: {
		search: '搜索',
		toggleAside: '切换侧边栏',
		toggleMenu: '切换菜单',
		theme: {
			light: '浅色模式',
			system: '跟随系统',
			dark: '深色模式',
		},
	},
	footer: {
		explore: '探索',
		social: '社交',
		info: '信息',
		atom: 'Atom订阅',
		travellings: '开往',
		travellingsTip: '开往 - 博客下一站',
		theme: '主题: {name} {version}',
	},
}

export default zh
export type MessageSchema = typeof zh
