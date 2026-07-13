/**
 * 一次性迁移脚本：把 PocketBase 存档里的游记转成 app/travels/<slug>.yaml。
 *
 * 与 pb-to-content.ts 同源：只读存档，不访问线上 PocketBase，因此可反复重跑。
 *
 * 用法：node scripts/migration/pb-to-travels.ts
 */
import type { Travel, TravelDay, TravelPhoto } from '../../app/types/travel'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { stringify } from 'yaml'

const ARCHIVE = 'archive/pocketbase-dump-2026-07-13.json'
const OUT_DIR = 'app/travels'
const LANG = 'zh'

interface PbTravel {
	id: string
	abbrlink: string
	lang: string
	draft: boolean
	title: string
	subtitle: string
	posttitle: string
	description: string
	published: string
	totaldays: number
	coverImage: string
}
interface PbDay {
	id: string
	travel: string
	day: number
	sort: number
	title: string
	descriptions: string[]
}
interface PbPhoto {
	id: string
	day: string
	sort: number
	src: string
	alt: string
	caption?: string
	lat?: number
	lng?: number
}

/** PB 的描述字段存的是 HTML 片段（用 <br /> 换行），落到 YAML 要还原成纯文本 */
function htmlToText(html: string) {
	return (html ?? '')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.trim()
}

const archive = JSON.parse(await readFile(ARCHIVE, 'utf8'))
const { travels, travel_days: pbDays, travel_photos: pbPhotos } = archive.collections as {
	travels: PbTravel[]
	travel_days: PbDay[]
	travel_photos: PbPhoto[]
}

const mine = travels.filter(travel => travel.lang === LANG && !travel.draft)
if (!mine.length) {
	console.error(`${ARCHIVE} 里没有 lang=${LANG} 的游记`)
	process.exit(1)
}

await mkdir(OUT_DIR, { recursive: true })

for (const pbTravel of mine) {
	const slug = pbTravel.abbrlink.replace(/^travels\//, '')

	const days: TravelDay[] = pbDays
		.filter(day => day.travel === pbTravel.id)
		// 同一天可拆成多个小节：先按第几天，再按节内次序
		.sort((a, b) => (a.day - b.day) || (a.sort - b.sort))
		.map(day => ({
			day: day.day,
			title: day.title,
			descriptions: (day.descriptions ?? []).map(htmlToText),
			photos: pbPhotos
				.filter(photo => photo.day === day.id)
				.sort((a, b) => a.sort - b.sort)
				.map((photo): TravelPhoto => ({
					src: photo.src,
					alt: photo.alt,
					...photo.caption ? { caption: photo.caption } : {},
					...photo.lat != null && photo.lng != null ? { lat: photo.lat, lng: photo.lng } : {},
				})),
		}))

	const travel: Travel = {
		slug,
		title: pbTravel.title,
		subtitle: pbTravel.subtitle,
		posttitle: pbTravel.posttitle,
		description: htmlToText(pbTravel.description),
		published: pbTravel.published.slice(0, 10),
		totaldays: pbTravel.totaldays,
		coverImage: pbTravel.coverImage,
		days,
	}

	const file = `${OUT_DIR}/${slug}.yaml`
	// lineWidth: 0 关掉自动折行 —— 中文长句被折行后可读性极差
	await writeFile(file, stringify(travel, { lineWidth: 0 }))

	const photos = days.reduce((sum, day) => sum + day.photos.length, 0)
	console.log(`✓ ${file} — ${days.length} 小节 / ${photos} 张照片`)
}
