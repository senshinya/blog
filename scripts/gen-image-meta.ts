#!/usr/bin/env node

/**
 * 为图床上的每张图预生成「原始宽高」+「LQIP 占位色」，产出 app/assets/image-meta.json。
 *
 * 为什么要宽高：正文的 37 张图和游记看图器的大图都没有任何尺寸预留，加载完会把下文顶开
 * （正文那份是真实的 CLS）。补上 width/height，浏览器就能按内在比例先占好位。
 *
 * 为什么要 LQIP：占好位之后那块地方是空的，图到位前先用三个主色渲一层渐变，别开天窗。
 * 编码沿用 retypeset / frzi 的 LQIP-CSS：把图缩到 3×3，取左上、中心、右下三个像素，
 * 打包进一个 32 位整数（11+11+10 位），写成 8 位十六进制。**每张图只要 8 个字节** ——
 * 解包由 CSS 的相对颜色语法完成，见 app/assets/css/lqip.scss。
 * https://frzi.medium.com/lqip-css-73dc6dda2529
 *
 * 宽高和缩略像素都从 Cloudflare Images Transformations 取（图床那个 zone 已开）：
 * format=json 直接给原始尺寸，width=32 给一张几百字节的小图喂 sharp —— 不必下载原片
 * （最大的一张 6016×3384、5 MB）。
 *
 * 跑法：pnpm gen:image-meta
 * 增量：已在 JSON 里的 URL 直接跳过，只处理新增的；删掉的图会从 JSON 里清掉。
 */

import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import sharp from 'sharp'

/** 只有这个 zone 开了 Transformations */
const IMG_HOST = 'https://blog-img.774352199.xyz'
const OUT = 'app/assets/image-meta.json'
/** 扫这些目录里的一切文本，正文的 Markdown、游记的 YAML 都在内 */
const SCAN_DIRS = ['content', 'app/travels']
const CONCURRENCY = 8

export interface ImageMeta {
	/** 原始宽度 */
	w: number
	/** 原始高度 */
	h: number
	/** LQIP：三个主色打包成的 8 位十六进制 */
	lqip: string
}

type MetaMap = Record<string, ImageMeta>

// ── LQIP 编码 ──────────────────────────────────────────────
// 位布局：[c0 11 位][c1 11 位][c2 10 位] = 32 位
// c0/c1 各 4+4+3 位（RGB），c2 只有 3+4+3 —— 少的那一位让给前两个色，人眼对绿最敏感故绿都给 4 位

function pack11(r: number, g: number, b: number) {
	return (Math.round((r / 255) * 15) << 7) | (Math.round((g / 255) * 15) << 3) | Math.round((b / 255) * 7)
}

function pack10(r: number, g: number, b: number) {
	return (Math.round((r / 255) * 7) << 7) | (Math.round((g / 255) * 15) << 3) | Math.round((b / 255) * 7)
}

async function lqipOf(url: string) {
	// 拉一张 32px 的小图来取色，而不是原片 —— 缩到 3×3 之后两者的结果没有肉眼可辨的差别
	const res = await fetch(`${IMG_HOST}/cdn-cgi/image/width=32,format=png${url.slice(IMG_HOST.length)}`)
	if (!res.ok)
		throw new Error(`取缩略图失败 ${res.status}`)

	const px = await sharp(Buffer.from(await res.arrayBuffer()))
		.resize(3, 3, { fit: 'fill' }) // fill：不保比例，硬拉成 3×3，只为取色
		.removeAlpha()
		.raw()
		.toBuffer()

	const at = (i: number) => [px[i * 3]!, px[i * 3 + 1]!, px[i * 3 + 2]!] as const

	const c0 = pack11(...at(0)) // 左上
	const c1 = pack11(...at(4)) // 中心
	const c2 = pack10(...at(8)) // 右下

	const packed = (BigInt(c0) << 21n) | (BigInt(c1) << 10n) | BigInt(c2)
	return packed.toString(16).padStart(8, '0')
}

async function sizeOf(url: string) {
	const res = await fetch(`${IMG_HOST}/cdn-cgi/image/width=100,format=json${url.slice(IMG_HOST.length)}`)
	if (!res.ok)
		throw new Error(`取尺寸失败 ${res.status}`)

	const { original } = await res.json() as { original: { width: number, height: number } }
	return original
}

// ── 扫描 ──────────────────────────────────────────────────

async function walk(dir: string): Promise<string[]> {
	const entries = await fs.readdir(dir, { withFileTypes: true })
	const files = await Promise.all(entries.map((entry) => {
		const full = path.join(dir, entry.name)
		return entry.isDirectory() ? walk(full) : [full]
	}))
	return files.flat()
}

async function collectUrls() {
	const urls = new Set<string>()
	// 不去分别解析 Markdown 和 YAML：正文的 ![](...)、frontmatter 的 image:、游记的 src: /
	// coverImage: 形态各异，但都是这个图床的绝对 URL。直接按 host 在原文里捞，一条正则通吃
	const pattern = new RegExp(`${IMG_HOST}/[^\\s)'"\`\\]]+`, 'g')

	for (const dir of SCAN_DIRS) {
		for (const file of await walk(dir)) {
			const text = await fs.readFile(file, 'utf-8')
			for (const url of text.match(pattern) ?? [])
				urls.add(url)
		}
	}

	return [...urls].sort()
}

// ── 主流程 ────────────────────────────────────────────────

async function main() {
	const urls = await collectUrls()
	console.log(`🔍 扫到 ${urls.length} 张图（${SCAN_DIRS.join('、')}）`)

	let cached: MetaMap = {}
	try {
		cached = JSON.parse(await fs.readFile(OUT, 'utf-8')) as MetaMap
	}
	catch {
		// 首次运行，没有这个文件
	}

	const todo = urls.filter(url => !cached[url])
	const stale = Object.keys(cached).filter(url => !urls.includes(url))

	if (stale.length)
		console.log(`🧹 清掉 ${stale.length} 张已不再引用的`)

	if (!todo.length) {
		console.log('✨ 全部命中缓存，无需重算')
	}
	else {
		console.log(`🔄 需要处理 ${todo.length} 张（其余 ${urls.length - todo.length} 张命中缓存）`)
	}

	// 只保留仍被引用的，顺带丢掉 stale
	const meta: MetaMap = {}
	for (const url of urls) {
		if (cached[url])
			meta[url] = cached[url]
	}

	let done = 0
	const failed: string[] = []

	// 分批并发：图床是 Cloudflare，别一次打太狠
	for (let i = 0; i < todo.length; i += CONCURRENCY) {
		await Promise.all(todo.slice(i, i + CONCURRENCY).map(async (url) => {
			try {
				const [{ width, height }, lqip] = await Promise.all([sizeOf(url), lqipOf(url)])
				meta[url] = { w: width, h: height, lqip }
			}
			catch (error) {
				// 单张失败不该毁掉整次运行：记下来，它只是拿不到宽高和占位色，
				// 页面上仍会照常显示（退回没有预留尺寸的老样子）
				failed.push(url)
				console.warn(`⚠️  跳过 ${url.split('/').pop()}：${(error as Error).message}`)
			}
			finally {
				done++
				if (done % 10 === 0 || done === todo.length)
					console.log(`   ${done}/${todo.length}`)
			}
		}))
	}

	// 键排序：否则每次运行的 diff 都会乱跳
	const sorted: MetaMap = {}
	for (const url of Object.keys(meta).sort())
		sorted[url] = meta[url]!

	// 2 空格、结尾不留换行：仓库的 eslint 会 lint JSON，这是它认的格式。
	// 别改成制表符或补上末尾换行，否则每次重跑都会把 pnpm lint 弄挂
	await fs.mkdir(path.dirname(OUT), { recursive: true })
	await fs.writeFile(OUT, JSON.stringify(sorted, null, 2))

	console.log(`✅ 写入 ${OUT}：${Object.keys(sorted).length} 张${failed.length ? `，${failed.length} 张失败` : ''}`)
}

main().catch((error) => {
	console.error('❌ 生成失败：', error)
	process.exit(1)
})
