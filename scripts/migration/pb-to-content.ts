/**
 * 一次性迁移脚本：把 PocketBase 存档转成 Clarity 的内容文件。
 *
 * 数据源是 dump-pocketbase.ts 产出的存档，不直接访问 PocketBase，因此可反复重跑。
 *
 * 产出：
 *   content/posts/<abbrlink>.md   42 篇中文文章（URL 与旧站一致）
 *   app/feeds.ts                  友链
 *
 * 用法：node scripts/migration/pb-to-content.ts
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import process from 'node:process'

const ARCHIVE = 'archive/pocketbase-dump-2026-07-13.json'
const LANG = 'zh'

/**
 * abbrlink 前缀 → 分类名。
 *
 * 前缀同时决定文件路径，也就决定了 URL（/fiddling/xxx，与旧站一致），
 * 故前缀保持英文；分类只用于展示，用中文。
 */
const CATEGORIES: Record<string, string> = {
	fiddling: '折腾',
	projects: '项目',
	notes: '笔记',
	daily: '日常',
}

interface Post {
	abbrlink: string
	lang: string
	title: string
	description: string
	body: string
	published: string
	updated: string
	expand?: { tags?: { name: string }[] }
}
interface Friend {
	name: string
	url: string
	avatar: string
	description: string
	sort: number

}

const archive = JSON.parse(await readFile(ARCHIVE, 'utf-8'))
const c = archive.collections as Record<string, any[]>

/** PocketBase 存 UTC（"2026-05-11 15:02:52.409Z"），Clarity 用本地时间格式 */
function toLocalTime(pbDate: string) {
	const d = new Date(pbDate.replace(' ', 'T'))
	if (Number.isNaN(d.getTime()))
		throw new Error(`无法解析日期: ${pbDate}`)
	const parts = new Intl.DateTimeFormat('sv-SE', {
		timeZone: 'Asia/Shanghai',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	}).format(d)
	return parts.replace('T', ' ')
}

/** JSON 字符串是合法的 YAML 双引号标量，用它规避引号/冒号/换行的转义问题 */
const yamlStr = (s: string) => JSON.stringify(s)

/** TS 源码里仓库统一用单引号，JSON.stringify 出的是双引号，故单独处理 */
function tsStr(s: string) {
	return `'${s
		.replace(/\\/g, '\\\\')
		.replace(/'/g, '\\\'')
		.replace(/\n/g, '\\n')}'`
}

const stats = { github: 0, bilibili: 0 }

function transformBody(body: string) {
	let out = body

	// 旧站的 ::github{repo="x/y"} 是自定义 leaf directive；
	// MDC 的块组件语法恰好同形，配上 app/components/content/Github.vue 即可直接识别。
	// 但 MDC 块组件需要闭合 ::，故补上。
	out = out.replace(/^::github\{repo="([^"]+)"\}\s*$/gm, (_, repo) => {
		stats.github++
		return `::github{repo="${repo}"}\n::`
	})

	// B 站 iframe → Clarity 自带的 VideoEmbed 组件。
	// 分两步：先整体框住 iframe 标签，再从标签里取 bvid。
	// 若写成单条正则（如 <iframe[^>]*bvid=(BV\w+)[^>]*>），两个量词会争抢同一批
	// 字符，构成多项式回溯。
	out = out.replace(/<iframe\b[^>]*>\s*<\/iframe>/g, (tag) => {
		const bvid = tag.match(/bvid=(BV[0-9a-z]+)/i)?.[1]
		if (!bvid)
			return tag

		stats.bilibili++
		return `::video-embed{type="bilibili" id="${bvid}"}\n::`
	})

	return out.trim()
}

// ---------- 文章 ----------
const posts = (c.posts as Post[]).filter(p => p.lang === LANG)
if (posts.length !== 42)
	throw new Error(`预期 42 篇中文文章，实得 ${posts.length} 篇`)

await rm('content/posts', { recursive: true, force: true })
await rm('content/previews', { recursive: true, force: true })

const categories = new Set<string>()

for (const p of posts) {
	const [prefix] = p.abbrlink.split('/')
	if (!prefix || !p.abbrlink.includes('/'))
		throw new Error(`abbrlink 缺少分类前缀: ${p.abbrlink}`)

	// 硬失败而非退回默认分类：静默归类会让新前缀悄悄消失在「笔记」里
	const category = CATEGORIES[prefix]
	if (!category)
		throw new Error(`前缀 ${prefix} 未在 CATEGORIES 中映射（${p.abbrlink}）`)
	categories.add(category)

	const tags = (p.expand?.tags ?? []).map(t => t.name)

	// 不输出 updated：PocketBase 的 updated 是「记录写入时间」，2026-05 批量导入时
	// 把 41/42 篇统统盖成了导入当天，与内容的真实修改时间无关。一篇 2021 年的文章
	// 标着「更新于 2026-05-10」是在说谎，不如不写 —— Clarity 缺该字段时不展示。
	// 真实的修改历史在导入 PocketBase 时已丢失，无从恢复。
	// 今后手工编辑文章时再自行补 updated 即可。
	const frontmatter = [
		'---',
		`title: ${yamlStr(p.title)}`,
		`description: ${yamlStr(p.description)}`,
		`date: ${toLocalTime(p.published)}`,
		`categories: [${category}]`,
		...(tags.length ? [`tags: [${tags.map(yamlStr).join(', ')}]`] : []),
		'---',
	].join('\n')

	const path = `content/posts/${p.abbrlink}.md`
	await mkdir(dirname(path), { recursive: true })
	await writeFile(path, `${frontmatter}\n\n${transformBody(p.body)}\n`)
}

console.log(`文章       ${posts.length} 篇 → content/posts/`)
console.log(`  分类     ${[...categories].join(', ')}`)
console.log(`  GitHub 卡片 ${stats.github} 处 / B 站视频 ${stats.bilibili} 处`)

// 关于页不迁移：后续会单独起一个站点。
// 内容仍在存档的 pages 集合里（key=about），需要时可取回。

// ---------- 友链 ----------
const friends = (c.friends as Friend[]).slice().sort((a, b) => a.sort - b.sort)

// PocketBase 的 friends 集合没有启用时间戳字段，无从得知订阅日期，
// 故 date 留空（FeedCard 已改为未知日期时不展示，而非伪造一个）。
// 缩进要和下方模板里的 myFeed 对齐（entries 数组内为 3 个 tab），否则 eslint 报一片 style/indent
const entries = friends.map(f => `			{
				author: ${tsStr(f.name)},
				desc: ${tsStr(f.description)},
				link: ${tsStr(f.url)},
				avatar: ${tsStr(f.avatar)},
				icon: getFavicon(${tsStr(f.url)}),
			},`).join('\n')

await writeFile('app/feeds.ts', `import type { FeedGroup } from '../app/types/feed'
// 友链检测 CLI 需要使用显式导入和相对路径
import { myFeed } from '../blog.config'
import { getFavicon } from './utils/img'

export default [
	{
		name: '友链',
		entries: [
			myFeed,
${entries}
		],
	},
] satisfies FeedGroup[]
`)
console.log(`友链       ${friends.length} 条 → app/feeds.ts`)

// 上游自带的 redirects 是纸鹿的旧链接映射，与本站无关
await writeFile('redirects.json', '{}\n')
console.log('redirects  已清空')

if (stats.github !== 6 || stats.bilibili !== 1) {
	console.error(`\n方言转换数目不符：预期 GitHub 6 处 / B 站 1 处，实得 ${stats.github} / ${stats.bilibili}`)
	process.exit(1)
}
