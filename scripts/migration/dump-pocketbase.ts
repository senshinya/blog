/**
 * 一次性迁移脚本：把 PocketBase 全量 dump 成 JSON 存档。
 *
 * 存档是后续所有导出脚本的唯一数据源 —— 它们不再直接访问 PocketBase，
 * 因此可反复重跑，且不依赖 PocketBase 存活。
 *
 * 用法：node scripts/migration/dump-pocketbase.ts
 */
import { mkdir, writeFile } from 'node:fs/promises'
import process from 'node:process'

const PB_BASE = 'https://blog-api.shinya.click'

/** expand 参数：关系字段需要展开才能拿到关联记录的实际内容 */
const COLLECTIONS: Record<string, string | undefined> = {
	posts: 'tags',
	pages: undefined,
	tags: undefined,
	friends: undefined,
	travels: undefined,
	travel_days: 'travel',
	travel_photos: 'day',
}

async function fetchAll(collection: string, expand?: string) {
	const items: unknown[] = []
	for (let page = 1; ; page++) {
		const url = new URL(`/api/collections/${collection}/records`, PB_BASE)
		url.searchParams.set('page', String(page))
		url.searchParams.set('perPage', '200')
		if (expand)
			url.searchParams.set('expand', expand)

		const res = await fetch(url)
		if (!res.ok)
			throw new Error(`${collection} 第 ${page} 页拉取失败: ${res.status} ${res.statusText}`)

		const data = await res.json() as { items: unknown[], totalPages: number }
		items.push(...data.items)
		if (page >= data.totalPages)
			break
	}
	return items
}

const dump: Record<string, unknown[]> = {}
for (const [collection, expand] of Object.entries(COLLECTIONS)) {
	dump[collection] = await fetchAll(collection, expand)
	console.log(`${collection.padEnd(14)} ${dump[collection].length} 条`)
}

const archive = {
	source: PB_BASE,
	dumpedAt: new Date().toISOString(),
	collections: dump,
}

await mkdir('archive', { recursive: true })
const path = `archive/pocketbase-dump-${new Date().toISOString().slice(0, 10)}.json`
await writeFile(path, `${JSON.stringify(archive, null, '\t')}\n`)

const { size } = await import('node:fs').then(fs => fs.promises.stat(path))
console.log(`\n已写入 ${path} (${(size / 1024 / 1024).toFixed(1)} MB)`)

// 存档是后续导出的唯一数据源，缺失即静默丢内容，故此处硬失败
const empty = Object.entries(dump).filter(([, v]) => v.length === 0)
if (empty.length) {
	console.error(`\n以下集合为空，存档不可信: ${empty.map(([k]) => k).join(', ')}`)
	process.exit(1)
}
