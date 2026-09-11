export interface ContentResourceNeeds {
	math?: boolean
	serif?: boolean
	monospace?: boolean
}

interface ResourceContent {
	type?: string
	body?: unknown
}

/** Inspect rendered nodes, not markdown source: dollar signs/code examples are not math. */
export function contentResourceNeeds(content?: ResourceContent | null): Required<ContentResourceNeeds> {
	const needs = { math: false, serif: content?.type === 'story', monospace: false }
	function inspect(tag: string, props: Record<string, unknown>) {
		const classes = [props.class, props.className].flat().filter(value => typeof value === 'string').flatMap(value => value.split(/\s+/))
		needs.math ||= classes.some(value => value === 'katex' || value === 'katex-display')
		needs.serif ||= tag === 'mark' || classes.includes('text-story')
		needs.monospace ||= ['pre', 'code', 'prose-pre', 'prose-code', 'ProsePre', 'ProseCode', 'github', 'Github'].includes(tag)
	}
	function visit(node: unknown) {
		if (!node || typeof node !== 'object')
			return
		if (Array.isArray(node)) {
			if (typeof node[0] === 'string' && node[1] && typeof node[1] === 'object' && !Array.isArray(node[1])) {
				inspect(node[0], node[1])
				node.slice(2).forEach(visit)
			}
			else {
				node.forEach(visit)
			}
			return
		}
		const tree = node as { tagName?: string, props?: Record<string, unknown>, properties?: Record<string, unknown>, children?: unknown[], value?: unknown }
		if (tree.tagName)
			inspect(tree.tagName, tree.properties ?? tree.props ?? {})
		visit(tree.children)
		visit(tree.value)
	}
	visit(content?.body)
	return needs
}

function stylesheet(key: string, href: string) {
	return { key, rel: 'stylesheet' as const, href }
}

export function contentResourceLinks(needs: ContentResourceNeeds, locale: string) {
	const links = []
	if (needs.math)
		links.push(stylesheet('content-katex', 'https://s4.zstatic.net/npm/katex@0.16.44/dist/katex.min.css'))
	if (needs.monospace)
		links.push(stylesheet('font-monospace', 'https://fonts.googleapis.cn/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap'))
	if (needs.serif) {
		const family = locale === 'ja' ? 'JP' : 'SC'
		links.push(stylesheet(`font-serif-${family}`, `https://fonts.googleapis.cn/css2?family=Noto+Serif+${family}:wght@200..900&display=swap`))
	}
	return links
}

export function localeFontLinks(locale: string) {
	return locale === 'ja'
		? [stylesheet('locale-font-ja', 'https://fonts.googleapis.cn/css2?family=Noto+Sans+JP:wght@100..900&display=swap')]
		: [stylesheet('font-creative', 'https://fonts.bytedance.com/dfd/api/v1/css?family=DOUYINSANSBOLD-GB&display=swap')]
}
