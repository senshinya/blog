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
	post: {
		references: '参考链接',
		license: '许可协议',
		licenseNotice: '本文采用 {link} 许可协议，转载请注明出处。',
		share: '文字分享',
		createdAt: '创建于{date}',
		words: '{n} 字',
		surroundNext: '新故事即将发生',
		surroundEnd: '已抵达博客尽头',
		allCategories: '全部分类',
		slideTitle: '精选文章',
		scrollHint: '按住 Shift 横向滚动',
		prevSlide: '上一页',
		nextSlide: '下一页',
	},
	content: {
		copy: '复制',
		copied: '已复制',
		wrapText: '自动换行',
		scrollHorizontal: '横向滚动',
		fitWidth: '适应宽度',
		expandCode: '展开代码块',
		collapseCode: '折叠代码块',
		expand: '展开',
		collapse: '收起',
		noFeed: '无订阅源',
		noDescription: '暂无描述',
		shuffleTip: '点击随机排序，按住修饰键点击可取消随机排序',
		mermaidDiagram: 'Mermaid 图表',
		mermaidError: '图表渲染失败，查看错误详情',
		alert: {
			tip: '提醒',
			info: '信息',
			question: '问题',
			warning: '警告',
			error: '错误',
		},
		clickToCopy: '点击复制',
		timelineEmpty: '时间线为空',
		chatEmpty: '无会话内容',
		restoreOriginal: '恢复原始内容',
	},
}

export default zh
export type MessageSchema = typeof zh
