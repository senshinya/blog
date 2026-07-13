# 游记迁移实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把旧站游记《近畿地方 2025.4》迁进 Clarity,详情页由全屏翻页重设计为滚动叙事,地图按 mapcn 方案(MapLibre + 免 key 瓦片)在 Vue 中复刻。

**Architecture:** 数据从 `archive/pocketbase-dump-2026-07-13.json` 一次性转成 `app/travels/<slug>.yaml`,由 `app/travels/index.ts` 注册为类型化数组;`pages/travels/index.vue`(列表,默认布局)与 `pages/travels/[slug].vue`(详情,`layout: false` 全屏)消费它;详情页左栏按天滚动、右栏 sticky 地图,靠 IntersectionObserver 把「当前小节」推给地图组件。全程静态,无运行时外部依赖。

**Tech Stack:** Nuxt 4 / Vue 3.5 / TypeScript / SCSS / unplugin-yaml(读)/ yaml(写,迁移脚本用)/ maplibre-gl 5 / CARTO 免 key 底图 / @vueuse/core

## Global Constraints

- **URL 不可变**:详情页必须是 `/travels/kansai-202504`。旧文内链(`content/posts/daily/one-month-using-android.md` 里的「关西行」)依赖它。
- **数据源只读存档**:迁移脚本读 `archive/pocketbase-dump-2026-07-13.json`,**不访问线上 PocketBase**,可反复重跑(沿用 `scripts/migration/pb-to-content.ts` 的约定)。
- **文件名即 slug**:`app/travels/<slug>.yaml`。`nuxt.config.ts` 的预渲染路由从文件名推导——jiti 读不了 yaml,配置期只能看目录。
- **只做中文**:存档里 zh/en/ja 三份,只取 `lang === 'zh'`。
- **本仓库无测试框架**(package.json 无 test 脚本、无 vitest/playwright)。本计划不引入测试框架:数据层用 `node -e` 断言脚本验证(有确定的期望值:6 小节 / 49 张照片 / 49 张带坐标),UI 层用 `pnpm lint` + dev server 实测 + `pnpm generate` 产物检查验证。每个任务的验证步骤都给出确切命令与期望输出。
- **代码风格**:tab 缩进、单引号、无分号(@antfu/eslint-config)。中文注释。提交信息用中文。
- 数据事实(用于断言):1 篇中文游记、6 个小节(`day` 为 0,1,1,2,2,3,即同一天可拆多节)、49 张照片、49 张全部带 lat/lng、`totaldays: 3`。

---

### Task 1: 数据层(类型 + 迁移脚本 + YAML + 注册表)

**Files:**
- Create: `app/types/travel.ts`
- Create: `scripts/migration/pb-to-travels.ts`
- Create(脚本产出): `app/travels/kansai-202504.yaml`
- Create: `app/travels/index.ts`
- Modify: `pnpm-workspace.yaml`(catalog util 加 `yaml`)
- Modify: `package.json`(devDependencies 加 `yaml`)

**Interfaces:**
- Produces:
  - `app/types/travel.ts` → `interface Travel { slug, title, subtitle, posttitle, description, published, totaldays, coverImage, days: TravelDay[] }`;`interface TravelDay { day: number, title: string, descriptions: string[], photos: TravelPhoto[] }`;`interface TravelPhoto { src: string, alt: string, caption?: string, lat?: number, lng?: number }`
  - `app/travels/index.ts` → `export default Travel[]`(按 published 倒序)、`export function getTravelBySlug(slug: string): Travel | undefined`
  - 后续任务全部只依赖这两个文件。

- [ ] **Step 1: 声明 `yaml` 依赖**

`yaml` 目前只是 unplugin-yaml 的传递依赖(靠 `shamefullyHoist` 才能 require 到),迁移脚本要用它序列化,必须显式声明。

`pnpm-workspace.yaml` 的 `catalogs.util` 中(保持字母序,插在 `strip-ansi` 之后):

```yaml
    strip-ansi: ^7.2.0
    temporal-polyfill: ^1.0.1
    yaml: ^2.9.0
```

`package.json` 的 `devDependencies` 中(保持字母序,插在末尾 `unrun` 之后):

```json
    "unrun": "catalog:framework",
    "yaml": "catalog:util"
```

- [ ] **Step 2: 安装并确认**

Run: `pnpm install`
Expected: 安装成功;`node -e "console.log(require('yaml/package.json').version)"` 输出 `2.9.x`。

- [ ] **Step 3: 写类型**

Create `app/types/travel.ts`:

```ts
export interface TravelPhoto {
	src: string
	alt: string
	caption?: string
	lat?: number
	lng?: number
}

/**
 * 行程中的一个小节。
 *
 * `day` 是第几天(从 0 起,0 是出发前夜),不是数组下标 —— 同一天可以拆成
 * 多个小节(旧站数据里 day 1 和 day 2 各有两节),故 day 会重复。
 */
export interface TravelDay {
	day: number
	title: string
	descriptions: string[]
	photos: TravelPhoto[]
}

export interface Travel {
	/** 与文件名、URL 一致:app/travels/<slug>.yaml → /travels/<slug> */
	slug: string
	title: string
	subtitle: string
	/** 用于 <title> 与列表页的完整标题 */
	posttitle: string
	description: string
	/** YYYY-MM-DD */
	published: string
	totaldays: number
	coverImage: string
	days: TravelDay[]
}
```

- [ ] **Step 4: 写迁移脚本**

Create `scripts/migration/pb-to-travels.ts`:

```ts
/**
 * 一次性迁移脚本:把 PocketBase 存档里的游记转成 app/travels/<slug>.yaml。
 *
 * 与 pb-to-content.ts 同源:只读存档,不访问线上 PocketBase,因此可反复重跑。
 *
 * 用法:node scripts/migration/pb-to-travels.ts
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

/** PB 的描述字段存的是 HTML 片段(用 <br /> 换行),落到 YAML 要还原成纯文本 */
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
		// 同一天可拆成多个小节:先按第几天,再按节内次序
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
```

- [ ] **Step 5: 跑脚本**

Run: `node scripts/migration/pb-to-travels.ts`
Expected: `✓ app/travels/kansai-202504.yaml — 6 小节 / 49 张照片`

- [ ] **Step 6: 断言产出的数据(数据层的「测试」)**

Run:

```bash
node -e "
const { parse } = require('yaml')
const t = parse(require('node:fs').readFileSync('app/travels/kansai-202504.yaml', 'utf8'))
const sections = t.days.length
const photos = t.days.flatMap(d => d.photos)
const geo = photos.filter(p => p.lat != null && p.lng != null)
const fail = m => { console.error('✗ ' + m); process.exit(1) }
t.slug === 'kansai-202504' || fail('slug 应为 kansai-202504,实为 ' + t.slug)
t.totaldays === 3 || fail('totaldays 应为 3,实为 ' + t.totaldays)
sections === 6 || fail('小节数应为 6,实为 ' + sections)
photos.length === 49 || fail('照片数应为 49,实为 ' + photos.length)
geo.length === 49 || fail('带坐标照片应为 49,实为 ' + geo.length)
t.description.includes('\n') || fail('description 的换行(原 <br />)没保住')
t.description.includes('<') && fail('description 里还残留 HTML 标签')
t.days[0].descriptions.length === 3 || fail('第一小节应有 3 段')
t.days.every(d => typeof d.day === 'number' && d.title) || fail('有小节缺 day 或 title')
photos.every(p => p.src.startsWith('https://')) || fail('有照片 src 不是 https 绝对地址')
console.log('✓ 数据校验通过:' + sections + ' 小节 / ' + photos.length + ' 张照片 / 全部带坐标')
"
```

Expected: `✓ 数据校验通过:6 小节 / 49 张照片 / 全部带坐标`

- [ ] **Step 7: 写注册表**

Create `app/travels/index.ts`:

```ts
import type { Travel } from '~/types/travel'
import kansai from './kansai-202504.yaml'

/**
 * 游记注册表。新增一篇:放一个 <slug>.yaml 进来,再在此处 import + 登记。
 *
 * 文件名必须等于 slug —— nuxt.config 的预渲染路由是从文件名推出来的
 * (jiti 读不了 yaml,配置期只能看目录)。真忘了登记,构建时那条路由会以
 * 404 炸出来,不会静默漏掉。
 *
 * unplugin-yaml 把 *.yaml 声明为 Record<string, unknown>,故此处需断言。
 */
const travels = [
	kansai,
] as unknown as Travel[]

export default travels.toSorted((a, b) => b.published.localeCompare(a.published))

export function getTravelBySlug(slug: string) {
	return travels.find(travel => travel.slug === slug)
}
```

- [ ] **Step 8: lint 并提交**

Run: `pnpm lint`
Expected: 无 error(注册表与脚本均通过)。若报未使用变量等,按提示修。

```bash
git add app/types/travel.ts app/travels scripts/migration/pb-to-travels.ts package.json pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat(travels): 游记数据从 PocketBase 存档静态入库

只读 archive/ 里的存档、不碰线上 PB,可反复重跑。
6 小节 / 49 张照片,全部带经纬度。文件名即 slug。"
```

---

### Task 2: 列表页、导航入口与预渲染路由

**Files:**
- Create: `app/pages/travels/index.vue`
- Modify: `app/app.config.ts`(nav 加「游记」)
- Modify: `nuxt.config.ts`(删 `/travels` 预渲染忽略项,加预渲染路由)

**Interfaces:**
- Consumes: `app/travels/index.ts` 的默认导出(`Travel[]`,已按 published 倒序)。
- Produces: 路由 `/travels`;导航项「游记」。

- [ ] **Step 1: 写列表页**

Create `app/pages/travels/index.vue`:

```vue
<script setup lang="ts">
import travels from '~/travels'

const appConfig = useAppConfig()

useSeoMeta({
	title: '游记',
	description: `${appConfig.title}的旅行记录:走过的地方、拍下的照片,和当时的心情。`,
})

const items = computed(() => travels.map(travel => ({
	...travel,
	photoCount: travel.days.reduce((sum, day) => sum + day.photos.length, 0),
})))
</script>

<template>
<template #aside>
	<TransitionGroup name="aside-widget">
		<WidgetBlogStats key="blog-stats" />
	</TransitionGroup>
</template>

<div class="travels proper-height">
	<header class="travels-header">
		<h1 class="text-creative">
			游记
		</h1>
		<p class="travels-desc">
			走过的地方,和当时拍下的照片。
		</p>
	</header>

	<ol class="travel-list">
		<li v-for="travel in items" :key="travel.slug">
			<NuxtLink class="travel-card" :to="`/travels/${travel.slug}`">
				<img
					class="travel-cover"
					:src="travel.coverImage"
					:alt="travel.title"
					loading="lazy"
				>
				<div class="travel-info">
					<h2 class="travel-title">{{ travel.title }}</h2>
					<p class="travel-subtitle">{{ travel.subtitle }}</p>
					<p class="travel-summary">{{ travel.description }}</p>
					<p class="travel-meta">
						<span><Icon name="tabler:calendar" /> {{ travel.published }}</span>
						<span><Icon name="tabler:route" /> {{ travel.totaldays }} 天</span>
						<span><Icon name="tabler:photo" /> {{ travel.photoCount }} 张</span>
					</p>
				</div>
			</NuxtLink>
		</li>
	</ol>
</div>
</template>

<style lang="scss" scoped>
.travels {
	padding: 1rem;
}

.travels-header {
	margin-bottom: 2rem;

	> h1 {
		font-size: 1.5rem;
	}
}

.travels-desc {
	color: var(--c-text-2);
}

.travel-list {
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
	list-style: none;
}

.travel-card {
	display: block;
	overflow: hidden;
	border: 1px solid var(--c-border);
	border-radius: 1rem;
	box-shadow: var(--box-shadow-1);
	background-color: var(--ld-bg-card);
	transition: box-shadow var(--delay), transform var(--delay);

	&:hover {
		box-shadow: var(--box-shadow-3);
		transform: translateY(-0.2rem);

		.travel-cover {
			scale: 1.03;
		}
	}
}

.travel-cover {
	aspect-ratio: 16 / 9;
	width: 100%;
	object-fit: cover;
	transition: scale var(--delay);
}

.travel-info {
	padding: 1rem 1.2rem 1.2rem;
}

.travel-title {
	font-size: 1.25rem;
}

.travel-subtitle {
	margin-bottom: 0.5rem;
	font-size: 0.9rem;
	color: var(--c-text-2);
}

.travel-summary {
	margin-bottom: 0.8rem;
	white-space: pre-line; // description 里的换行是作者排的分行,保住
	color: var(--c-text-1);
}

.travel-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 1rem;
	font-size: 0.85rem;
	color: var(--c-text-3);

	> span {
		display: flex;
		align-items: center;
		gap: 0.3em;
	}
}
</style>
```

- [ ] **Step 2: 加导航入口**

Modify `app/app.config.ts`,在 `nav` 的「碎语」之后插入一行:

```ts
				{ icon: 'tabler:bubble-text', text: '碎语', url: '/memos' },
				{ icon: 'tabler:map-2', text: '游记', url: '/travels' },
				{ icon: 'tabler:archive', text: '归档', url: '/archive' },
```

- [ ] **Step 3: 改预渲染配置**

Modify `nuxt.config.ts`。先在 import 区加(`node:fs` / `node:path`):

```ts
import { readdirSync } from 'node:fs'
import { basename, resolve } from 'node:path'
```

(原本只有 `import { resolve } from 'node:path'`,合并成上面两行。)

在 `pluginPath` 函数下方加:

```ts
// 游记数据是 app/travels/*.yaml。加载 nuxt.config 的 jiti 不认 yaml,配置期读不到
// 内容,所以从文件名推路由 —— 文件名即 slug,这条约定由迁移脚本和注册表共同保证。
const travelRoutes = readdirSync(resolve('./app/travels'))
	.filter(file => file.endsWith('.yaml'))
	.map(file => `/travels/${basename(file, '.yaml')}`)
```

把 `nitro.prerender` 整段替换为:

```ts
	nitro: {
		prerender: {
			// 修复部分平台会在文章路径后添加 `/`，导致闪现 404 错误
			// https://github.com/nuxt/content/issues/2378
			autoSubfolderIndex: CLOUDFLARE_PAGES || GITHUB_ACTIONS || NETLIFY ? false : undefined,

			// 游记不在 Nuxt Content 里,列表页只有侧栏导航链过去、详情页只靠旧文内链,
			// 都不够稳。显式登记,漏链也不会静默不生成。
			routes: ['/travels', ...travelRoutes],
		},
	},
```

注意:**删掉**原来的 `ignore: ['/travels']` 及其上方那段「游记本轮未迁移」的注释——本任务正是它说的「待游记迁完后删掉」。

- [ ] **Step 4: 起 dev server 验证列表页**

Run:

```bash
pnpm dev --no-open >/tmp/travels-dev.log 2>&1 &
sleep 25
curl -s http://localhost:3000/travels | grep -o '近畿地方\|kansai-202504\|49 张' | sort -u
```

Expected: 输出包含 `近畿地方`、`kansai-202504`、`49 张`(封面、标题、照片数都渲染出来了)。

- [ ] **Step 5: lint 并提交**

Run: `pnpm lint`
Expected: 无 error。

```bash
git add app/pages/travels/index.vue app/app.config.ts nuxt.config.ts
git commit -m "feat(travels): 游记列表页与导航入口

顺带删掉 nuxt.config 里「游记未迁移」的预渲染忽略项 —— 就是它说的那个「以后」。
预渲染路由从 app/travels/*.yaml 的文件名推导(jiti 读不了 yaml)。"
```

---

### Task 3: 详情页骨架(Hero + 逐日叙事 + 照片网格 + 灯箱)

本任务先不接地图,产出一个可独立阅读、可独立验证的全屏长页。

**Files:**
- Create: `app/components/travel/PhotoCard.vue`
- Create: `app/pages/travels/[slug].vue`

**Interfaces:**
- Consumes: `getTravelBySlug()`;`~/types/travel` 的 `Travel` / `TravelPhoto`。
- Produces:
  - `<TravelPhotoCard :photo="photo" @focus="..." />` —— 一张可点开灯箱的照片;点击时 `emit('focus')`,供 Task 5 让地图飞过去。
  - `pages/travels/[slug].vue` 中的 `focusedPhoto`(被点开的照片)——Task 4/5 在此基础上接地图。

> **组件为什么叫 PhotoCard 而不是 Photo**:`app/components/travel/Photo.vue` 会被自动导入成 `<TravelPhoto>`,与 `~/types/travel` 里的 `TravelPhoto` 类型同名。详情页两者都要用(模板里用组件、script 里用类型),同名会让 SFC 编译器把模板中的 `TravelPhoto` 解析到那个被类型擦除的 import 上。改叫 `PhotoCard` 彻底绕开。

- [ ] **Step 1: 写照片组件**

`useLightbox()` 只把 `alt` 当 caption 透传,而游记照片的 `caption` 是另一段更长的图注,故仿 `app/components/content/Pic.vue` 直接用 modalStore。

Create `app/components/travel/PhotoCard.vue`:

```vue
<script setup lang="ts">
import type { TravelPhoto } from '~/types/travel'
import { LazyPopoverLightbox } from '#components'

const props = defineProps<{
	photo: TravelPhoto
}>()

const emit = defineEmits<{
	focus: []
}>()

const pic = useTemplateRef<HTMLImageElement>('pic')
const modalStore = useModalStore()

// 灯箱里显示图注(caption),没有图注时退回 alt
const { open } = modalStore.use(
	() => h(LazyPopoverLightbox, {
		el: unrefElement(pic)!,
		caption: props.photo.caption || props.photo.alt,
	}),
	{ unique: true },
)

function onClick() {
	emit('focus')
	open()
}
</script>

<template>
<li class="travel-photo">
	<img
		ref="pic"
		:src="photo.src"
		:alt="photo.alt"
		loading="lazy"
		@click="onClick"
	>
	<span v-if="photo.alt" class="travel-photo-alt">{{ photo.alt }}</span>
</li>
</template>

<style lang="scss" scoped>
.travel-photo {
	position: relative;
	overflow: hidden;
	border-radius: 0.6rem;
	box-shadow: var(--box-shadow-1);
	background-color: var(--c-bg-2);
	transition: box-shadow var(--delay), transform var(--delay);

	&:hover {
		box-shadow: var(--box-shadow-3);
		transform: translateY(-0.15rem);

		> img {
			scale: 1.05;
		}

		> .travel-photo-alt {
			opacity: 1;
			translate: 0;
		}
	}

	> img {
		display: block;
		aspect-ratio: 4 / 3;
		width: 100%;
		object-fit: cover;
		cursor: zoom-in;
		transition: scale var(--delay);
	}
}

.travel-photo-alt {
	position: absolute;
	inset-inline: 0;
	bottom: 0;
	padding: 1.5em 0.6em 0.5em;
	font-size: 0.75rem;
	color: #fff;
	background: linear-gradient(transparent, #0009);
	opacity: 0;
	translate: 0 0.3rem;
	transition: all var(--delay);
	pointer-events: none;

	// 触屏没有 hover,直接常显
	@media (hover: none) {
		opacity: 1;
		translate: 0;
	}
}
</style>
```

- [ ] **Step 2: 写详情页(骨架版,地图位先留空 div)**

Create `app/pages/travels/[slug].vue`:

```vue
<script setup lang="ts">
import type { TravelPhoto } from '~/types/travel'
import { getTravelBySlug } from '~/travels'

definePageMeta({
	layout: false,
})

const route = useRoute()
const found = getTravelBySlug(route.params.slug as string)

if (!found) {
	throw createError({
		statusCode: 404,
		statusMessage: '游记不存在',
		fatal: true,
	})
}

// throw 之后类型已收窄,转存一个非空常量,省得后面到处写 travel!
const travel = found

useSeoMeta({
	title: travel.posttitle,
	description: travel.description,
	ogType: 'article',
	ogImage: travel.coverImage,
})

/** 被点开的那张照片(Task 5 里地图会飞过去);切小节时清空 */
const focusedPhoto = ref<TravelPhoto>()

function onPhotoFocus(photo: TravelPhoto) {
	focusedPhoto.value = photo
}

/** 只在「这一天的第一个小节」上打 Day 徽章 —— 同一天可能拆成好几节 */
function startsNewDay(index: number) {
	return index === 0 || travel.days[index]!.day !== travel.days[index - 1]!.day
}
</script>

<template>
<div class="travel">
	<NuxtLink class="travel-back" to="/travels">
		<Icon name="tabler:arrow-left" />
		游记
	</NuxtLink>

	<header class="travel-hero" :style="{ backgroundImage: `url(${travel.coverImage})` }">
		<div class="travel-hero-mask">
			<p class="travel-hero-badge">旅行日记</p>
			<h1 class="travel-hero-title">{{ travel.title }}</h1>
			<p class="travel-hero-subtitle">{{ travel.subtitle }}</p>
			<p class="travel-hero-desc">{{ travel.description }}</p>
			<p class="travel-hero-meta">
				<Icon name="tabler:route" />
				{{ travel.totaldays }} 天行程
			</p>
		</div>
		<Icon class="travel-hero-scroll" name="tabler:chevron-down" />
	</header>

	<div class="travel-body">
		<!-- Task 4 把 <TravelMap> 放进来 -->
		<aside class="travel-map-col" />

		<div class="travel-narrative">
			<section
				v-for="day, index in travel.days"
				:key="index"
				ref="sections"
				class="travel-section"
				:data-index="index"
			>
				<p v-if="startsNewDay(index)" class="travel-day-badge">
					Day {{ day.day }}
				</p>
				<h2 class="travel-day-title">{{ day.title }}</h2>

				<p v-for="text, i in day.descriptions" :key="i" class="travel-para">
					{{ text }}
				</p>

				<ol v-if="day.photos.length" class="travel-photos">
					<TravelPhotoCard
						v-for="photo in day.photos"
						:key="photo.src"
						:photo
						@focus="onPhotoFocus(photo)"
					/>
				</ol>
			</section>

			<footer class="travel-end">
				<p>—— 完 ——</p>
				<NuxtLink class="travel-end-link" to="/travels">
					回到游记列表
				</NuxtLink>
			</footer>
		</div>
	</div>
</div>
</template>

<style lang="scss" scoped>
.travel {
	background-color: var(--c-bg);
}

.travel-back {
	display: flex;
	align-items: center;
	gap: 0.3em;
	position: fixed;
	z-index: 3;
	top: 1rem;
	left: 1rem;
	padding: 0.4em 0.9em;
	border: 1px solid var(--c-border);
	border-radius: 2em;
	box-shadow: var(--box-shadow-1);
	font-size: 0.9rem;
	color: var(--c-text-1);
	background-color: var(--c-bg-a80);
	backdrop-filter: blur(0.5rem);

	&:hover {
		color: var(--c-primary);
	}
}

.travel-hero {
	display: flex;
	align-items: center;
	position: relative;
	height: 100vh;
	height: 100dvh;
	background-position: center;
	background-size: cover;
}

.travel-hero-mask {
	width: 100%;
	padding: 3rem clamp(1.5rem, 8vw, 8rem);
	// 底图明暗未知,统一压一层深色蒙版保证文字对比度(不随主题变)
	background: linear-gradient(90deg, #000000b3, #00000059 60%, transparent);
	color: #fff;
}

.travel-hero-badge {
	width: fit-content;
	margin-bottom: 1rem;
	padding: 0.3em 0.9em;
	border-radius: 2em;
	font-size: 0.8rem;
	letter-spacing: 0.1em;
	background-color: #ffffff26;
}

.travel-hero-title {
	font-size: clamp(2.5rem, 7vw, 5rem);
	line-height: 1.1;
}

.travel-hero-subtitle {
	margin-bottom: 1.5rem;
	font-size: clamp(1.2rem, 2.5vw, 2rem);
	color: #ffffffb3;
}

.travel-hero-desc {
	max-width: 32rem;
	white-space: pre-line; // 作者手排的分行
	line-height: 2;
	color: #ffffffe6;
}

.travel-hero-meta {
	display: flex;
	align-items: center;
	gap: 0.4em;
	margin-top: 2rem;
	font-size: 0.9rem;
	color: #ffffffb3;
}

.travel-hero-scroll {
	position: absolute;
	bottom: 2rem;
	left: 50%;
	font-size: 1.5rem;
	color: #ffffffb3;
	translate: -50%;
	animation: float 2s ease-in-out infinite;
}

.travel-body {
	display: grid;
	grid-template-columns: minmax(0, 55fr) minmax(0, 45fr);
}

.travel-map-col {
	position: sticky;
	top: 0;
	order: 2; // 叙事在左、地图在右,但 DOM 里地图在前(移动端要吸顶)
	height: 100vh;
	height: 100dvh;
}

.travel-narrative {
	padding: clamp(2rem, 5vw, 5rem) clamp(1.5rem, 4vw, 4rem);
}

.travel-section {
	padding: 3rem 0;

	& + .travel-section {
		border-top: 1px solid var(--c-border);
	}
}

.travel-day-badge {
	width: fit-content;
	margin-bottom: 0.8rem;
	padding: 0.25em 0.8em;
	border-radius: 2em;
	font-size: 0.75rem;
	letter-spacing: 0.08em;
	color: var(--c-primary);
	background-color: var(--c-primary-soft);
}

.travel-day-title {
	margin-bottom: 1.5rem;
	font-size: clamp(1.5rem, 3vw, 2.2rem);
	line-height: 1.3;
}

.travel-para {
	margin-bottom: 1.2rem;
	line-height: 2;
	color: var(--c-text-1);
}

.travel-photos {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
	gap: 0.8rem;
	margin-top: 2rem;
	list-style: none;
}

.travel-end {
	padding: 4rem 0 6rem;
	text-align: center;
	color: var(--c-text-3);
}

.travel-end-link {
	display: inline-block;
	margin-top: 1rem;
	color: var(--c-primary);

	&:hover {
		text-decoration: underline;
	}
}

@media (max-width: $breakpoint-mobile) {
	// 单列:地图改为吸顶条。注意这里必须是 block 而非 grid ——
	// grid item 的 sticky 只在自己那一行的范围内生效,一滚就跑没了
	.travel-body {
		display: block;
	}

	.travel-map-col {
		z-index: 2;
		height: 35vh;
	}

	.travel-narrative {
		padding: 1rem;
	}
}
</style>
```

> `float` 动画来自 `app/assets/css/animation.scss`。若该文件里没有 `float`,把 `.travel-hero-scroll` 的 `animation` 一行删掉即可(纯装饰)。Step 3 会验证。

- [ ] **Step 3: 确认 `float` 动画存在**

Run: `grep -n "@keyframes float" app/assets/css/animation.scss`
Expected: 有输出。若无输出,删掉 `.travel-hero-scroll` 里的 `animation: float 2s ease-in-out infinite;` 这一行。

- [ ] **Step 4: 实测详情页**

Run:

```bash
pnpm dev --no-open >/tmp/travels-dev.log 2>&1 &
sleep 25
curl -s http://localhost:3000/travels/kansai-202504 > /tmp/travel-detail.html
grep -c 'travel-section' /tmp/travel-detail.html
grep -o '浦东机场的不眠之夜\|若草山上便便多\|当归' /tmp/travel-detail.html | sort -u
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/travels/not-exist
```

Expected:
- `travel-section` 出现次数 ≥ 6(6 个小节都渲染了)
- 三个小节标题都出现
- 不存在的 slug 返回 `404`

- [ ] **Step 5: lint 并提交**

Run: `pnpm lint`
Expected: 无 error。

```bash
git add app/components/travel/PhotoCard.vue app/pages/travels/\[slug\].vue
git commit -m "feat(travels): 详情页滚动叙事骨架

全屏 Hero + 逐日长文 + 照片网格 + 灯箱(带图注)。地图位先留空,下一步接。"
```

---

### Task 4: 地图组件(MapLibre + CARTO 免 key 底图 + 明暗跟随)

**Files:**
- Create: `app/components/travel/Map.vue`
- Modify: `pnpm-workspace.yaml`(catalog ui 加 `maplibre-gl`)
- Modify: `package.json`(dependencies 加 `maplibre-gl`)
- Modify: `app/pages/travels/[slug].vue`(把地图放进 `.travel-map-col`)

**Interfaces:**
- Consumes: `~/types/travel` 的 `TravelPhoto`。
- Produces: `<TravelMap :photos="TravelPhoto[]" :focus="TravelPhoto | undefined" />`
  - `photos`:当前该显示的照片(变化时重建标记并 `fitBounds`)。
  - `focus`:要聚焦的单张照片(变化时 `flyTo` 并打开该标记的 popup);为 `undefined` 时不动。

- [ ] **Step 1: 加 maplibre-gl 依赖**

`pnpm-workspace.yaml` 的 `catalogs.ui` 中(字母序,插在 `embla-carousel-wheel-gestures` 之后):

```yaml
    embla-carousel-wheel-gestures: ^8.1.0
    maplibre-gl: ^5.24.0
    vue-tippy: ^6.7.1
```

`package.json` 的 `dependencies` 中(字母序,插在 `marked` 之前):

```json
    "es-toolkit": "catalog:util",
    "maplibre-gl": "catalog:ui",
    "marked": "^18.0.6",
```

Run: `pnpm install`
Expected: 安装成功。

- [ ] **Step 2: 写地图组件**

Create `app/components/travel/Map.vue`:

```vue
<script setup lang="ts">
import type { Map as MapLibreMap, Marker } from 'maplibre-gl'
import type { TravelPhoto } from '~/types/travel'

const props = defineProps<{
	photos: TravelPhoto[]
	focus?: TravelPhoto
}>()

/**
 * 底图沿用 mapcn 的思路:MapLibre + 免 key 瓦片 + 明暗两套样式。
 * CARTO 的 positron / dark-matter 无需 API key。想换 OpenFreeMap 只改这两行。
 */
const STYLE = {
	light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
	dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
}

const container = useTemplateRef<HTMLElement>('container')
const colorMode = useColorMode()

let maplibre: typeof import('maplibre-gl') | undefined
let map: MapLibreMap | undefined
/** 照片 → 标记,focus 时要按照片反查标记来开 popup */
let markers = new Map<TravelPhoto, Marker>()

const ready = ref(false)

function styleUrl() {
	return colorMode.value === 'dark' ? STYLE.dark : STYLE.light
}

function geoPhotos() {
	return props.photos.filter(photo => photo.lat != null && photo.lng != null)
}

/** popup 里是一张缩略图 + 图题,用 DOM 拼(MapLibre 只吃 DOM 节点) */
function popupContent(photo: TravelPhoto) {
	const figure = document.createElement('figure')
	figure.className = 'travel-popup'

	const img = document.createElement('img')
	img.src = photo.src
	img.alt = photo.alt
	img.loading = 'lazy'

	const caption = document.createElement('figcaption')
	caption.textContent = photo.alt

	figure.append(img, caption)
	return figure
}

function clearMarkers() {
	markers.forEach(marker => marker.remove())
	markers = new Map()
}

/** 换一批照片:重建标记,并把视野收到这批照片的范围 */
function renderPhotos() {
	if (!map || !maplibre)
		return

	clearMarkers()

	const photos = geoPhotos()
	if (!photos.length)
		return // 这一节没有带坐标的照片,保持上一次的视野,不乱飞

	const bounds = new maplibre.LngLatBounds()

	for (const photo of photos) {
		const element = document.createElement('button')
		element.type = 'button'
		element.className = 'travel-marker'
		element.setAttribute('aria-label', photo.alt)

		const popup = new maplibre.Popup({
			offset: 14,
			closeButton: false,
			maxWidth: '15rem',
		}).setDOMContent(popupContent(photo))

		const marker = new maplibre.Marker({ element })
			.setLngLat([photo.lng!, photo.lat!])
			.setPopup(popup)
			.addTo(map)

		markers.set(photo, marker)
		bounds.extend([photo.lng!, photo.lat!])
	}

	map.fitBounds(bounds, { padding: 72, maxZoom: 15, duration: 1200 })
}

/** 聚焦单张照片:飞过去并开 popup */
function focusPhoto(photo: TravelPhoto) {
	if (!map || photo.lat == null || photo.lng == null)
		return

	map.flyTo({
		center: [photo.lng, photo.lat],
		zoom: 16,
		duration: 1200,
	})

	const marker = markers.get(photo)
	if (marker && !marker.getPopup()?.isOpen())
		marker.togglePopup()
}

onMounted(async () => {
	// 只在详情页动态加载,不让 maplibre 进其它页面的首屏包
	maplibre = await import('maplibre-gl')
	await import('maplibre-gl/dist/maplibre-gl.css')

	map = new maplibre.Map({
		container: container.value!,
		style: styleUrl(),
		center: [135.7681, 35.0116], // 京都,首帧兜底(随即被 fitBounds 覆盖)
		zoom: 9,
		attributionControl: { compact: true },
	})

	map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'bottom-right')
	map.on('load', () => ready.value = true)
})

onBeforeUnmount(() => {
	clearMarkers()
	map?.remove()
	map = undefined
})

// 地图就绪前 props 就可能变过,故把 ready 一并纳入依赖
watch([ready, () => props.photos], () => {
	if (ready.value)
		renderPhotos()
})

watch(() => props.focus, (photo) => {
	if (ready.value && photo)
		focusPhoto(photo)
})

// 标记是 DOM 覆盖物,不随 setStyle 销毁,故换肤后无需重建
watch(() => colorMode.value, () => map?.setStyle(styleUrl()))
</script>

<template>
<div ref="container" class="travel-map" />
</template>

<style lang="scss" scoped>
.travel-map {
	width: 100%;
	height: 100%;
	background-color: var(--c-bg-2);
}

// 标记与 popup 是 MapLibre 用 DOM API 塞进来的,不带 scoped 属性,故用 :deep
.travel-map :deep(.travel-marker) {
	width: 0.9rem;
	height: 0.9rem;
	padding: 0;
	border: 2px solid var(--c-bg);
	border-radius: 50%;
	box-shadow: var(--box-shadow-1);
	background-color: var(--c-primary);
	cursor: pointer;
	transition: scale var(--delay);

	&:hover {
		scale: 1.4;
	}
}

.travel-map :deep(.maplibregl-popup-content) {
	padding: 0.4rem;
	border: 1px solid var(--c-border);
	border-radius: 0.6rem;
	box-shadow: var(--box-shadow-2);
	background-color: var(--ld-bg-card);
}

.travel-map :deep(.travel-popup) {
	> img {
		display: block;
		aspect-ratio: 4 / 3;
		width: 100%;
		border-radius: 0.4rem;
		object-fit: cover;
	}

	> figcaption {
		padding: 0.4em 0.2em 0.1em;
		font-size: 0.75rem;
		text-align: center;
		color: var(--c-text-1);
	}
}

// popup 小三角的颜色按锚点方向分别给,不然浅色卡片上会露出白尖
.travel-map :deep(.maplibregl-popup-anchor-bottom .maplibregl-popup-tip) {
	border-top-color: var(--ld-bg-card);
}

.travel-map :deep(.maplibregl-popup-anchor-top .maplibregl-popup-tip) {
	border-bottom-color: var(--ld-bg-card);
}

.travel-map :deep(.maplibregl-popup-anchor-left .maplibregl-popup-tip) {
	border-right-color: var(--ld-bg-card);
}

.travel-map :deep(.maplibregl-popup-anchor-right .maplibregl-popup-tip) {
	border-left-color: var(--ld-bg-card);
}
</style>
```

- [ ] **Step 3: 把地图放进详情页**

Modify `app/pages/travels/[slug].vue`,把占位的 `<aside class="travel-map-col" />` 换成:

```vue
		<aside class="travel-map-col">
			<ClientOnly>
				<TravelMap :photos="mapPhotos" :focus="focusedPhoto" />
			</ClientOnly>
		</aside>
```

并在 `<script setup>` 里加(暂时先喂全程照片,Task 5 再改成跟着滚动走):

```ts
/** 喂给地图的照片。Task 5 会改成「当前小节」;现在先给全程,保证地图有内容 */
const mapPhotos = computed(() => travel.days.flatMap(day => day.photos))
```

- [ ] **Step 4: 实测地图渲染**

Run:

```bash
pnpm dev --no-open >/tmp/travels-dev.log 2>&1 &
sleep 25
curl -s http://localhost:3000/travels/kansai-202504 | grep -c 'travel-map'
grep -i 'error\|failed' /tmp/travels-dev.log | grep -vi 'no error' | head
```

Expected: `travel-map` 有输出(≥1);dev 日志无 error。

浏览器人工确认(必做,地图是纯客户端的,curl 看不出来):打开 `http://localhost:3000/travels/kansai-202504`,
- 地图出现在右栏且铺满整个视口高度
- 能看到 49 个圆点标记,视野自动收到关西一带
- 点标记弹出照片缩略卡片
- 切换站点明暗主题,底图在 positron / dark-matter 之间跟着换

- [ ] **Step 5: lint 并提交**

Run: `pnpm lint`
Expected: 无 error。

```bash
git add app/components/travel/Map.vue app/pages/travels/\[slug\].vue package.json pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat(travels): 地图组件(MapLibre + CARTO 免 key 底图)

按 mapcn 的路子在 Vue 里复刻:免 key 瓦片、明暗两套样式跟随站点主题、
标记与 popup 全用主题 CSS 变量。maplibre 只在详情页动态加载。"
```

---

### Task 5: 滚动联动与照片↔地图互动

**Files:**
- Modify: `app/pages/travels/[slug].vue`

**Interfaces:**
- Consumes: Task 4 的 `<TravelMap :photos :focus />`;Task 3 的 `focusedPhoto` / `@focus` / 各小节上的 `ref="sections"` 与 `:data-index`。
- Produces: 滚到哪一节,地图就收到哪一节的照片;点哪张照片,地图就飞到哪张。

- [ ] **Step 1: 接上 IntersectionObserver**

Modify `app/pages/travels/[slug].vue` 的 `<script setup>`,把 Task 4 那个临时的 `mapPhotos` 换成下面这整段(`activeIndex` 到这一步才有人读,故在此声明——放 Task 3 会被 ESLint 判成未使用变量):

```ts
/** 当前在读的小节下标;-1 表示还停留在封面 */
const activeIndex = ref(-1)

const sections = useTemplateRef<HTMLElement[]>('sections')

// rootMargin 把观察区压成视口中间的一条窄带:谁穿过这条带子,谁就是「当前小节」。
// 比调 threshold 稳 —— 各小节高矮悬殊(有的两段字,有的十几张图),
// 用比例阈值会出现「高的那节永远到不了阈值」。
useIntersectionObserver(
	sections,
	(entries) => {
		for (const entry of entries) {
			if (!entry.isIntersecting)
				continue

			// 不能用 indexOf(sections) 反查:v-for 的 ref 数组不保证与源数组同序
			const index = Number((entry.target as HTMLElement).dataset.index)
			if (Number.isNaN(index) || index === activeIndex.value)
				continue

			activeIndex.value = index
			focusedPhoto.value = undefined // 换节了,取消上一节遗留的单张聚焦
		}
	},
	{ rootMargin: '-45% 0px -45% 0px' },
)

/**
 * 喂给地图的照片:还在封面时给全程(先让读者看到整趟路线的轮廓),
 * 进入正文后只给当前小节。
 */
const mapPhotos = computed(() => activeIndex.value < 0
	? travel.days.flatMap(day => day.photos)
	: travel.days[activeIndex.value]?.photos ?? [],
)
```

`onPhotoFocus` 已在 Task 3 写好(把照片存进 `focusedPhoto`),`<TravelPhotoCard @focus>` 已接上,无需再改模板。

- [ ] **Step 2: 确认 vueuse 的 useIntersectionObserver 是自动导入的**

Run: `grep -rn "useIntersectionObserver\|@vueuse/nuxt" nuxt.config.ts package.json | head -3`
Expected: `@vueuse/nuxt` 在依赖与 modules 里 —— 该 composable 由 vueuse 的 Nuxt 模块自动导入,无需手写 import。

- [ ] **Step 3: 实测联动(浏览器人工验证,必做)**

Run: `pnpm dev --no-open >/tmp/travels-dev.log 2>&1 & sleep 25 && open http://localhost:3000/travels/kansai-202504`

逐条确认:
1. 停在封面时,地图显示全程 49 个点。
2. 向下滚动,进入「浦东机场的不眠之夜」→ 地图收到该节照片范围(上海浦东)。
3. 继续滚到奈良那两节 → 地图飞到奈良,标记只剩当节的。
4. 点任意一张照片 → 灯箱打开(带图注),同时地图飞到该照片坐标并弹出它的 popup。
5. 关掉灯箱、继续滚到下一节 → 地图恢复成整节视野(单张聚焦被清掉)。
6. dev 日志无 error:`grep -i error /tmp/travels-dev.log | head`

- [ ] **Step 4: lint 并提交**

Run: `pnpm lint`
Expected: 无 error。

```bash
git add app/pages/travels/\[slug\].vue
git commit -m "feat(travels): 滚动叙事与地图联动

滚到哪节,地图就飞到哪节;点哪张照片,地图就聚焦哪张并开 popup。
用 rootMargin 压出的中线带判定当前小节,避免小节高矮悬殊导致阈值失灵。"
```

---

### Task 6: 移动端收尾与全量验证

**Files:**
- Modify: `app/pages/travels/[slug].vue`(移动端地图吸顶条的可折叠开关)

**Interfaces:**
- Consumes: 前五个任务的全部产出。
- Produces: 可交付的游记板块。

- [ ] **Step 1: 移动端地图加折叠开关**

窄屏上地图占 35vh 会一直压着正文,给一个收起按钮。Modify `app/pages/travels/[slug].vue`:

`<script setup>` 加:

```ts
/** 窄屏上地图是吸顶条,会一直占着 35vh,给个收起开关 */
const mapCollapsed = ref(false)
```

模板里把 `<aside class="travel-map-col">` 整段换成:

```vue
		<aside class="travel-map-col" :class="{ collapsed: mapCollapsed }">
			<ClientOnly>
				<TravelMap :photos="mapPhotos" :focus="focusedPhoto" />
			</ClientOnly>
			<button
				class="travel-map-toggle mobile-only"
				:aria-label="mapCollapsed ? '展开地图' : '收起地图'"
				@click="mapCollapsed = !mapCollapsed"
			>
				<Icon :name="mapCollapsed ? 'tabler:map' : 'tabler:chevron-up'" />
			</button>
		</aside>
```

样式里,把移动端那段 `@media (max-width: $breakpoint-mobile)` 补成:

```scss
@media (max-width: $breakpoint-mobile) {
	// 单列:地图改为吸顶条。注意这里必须是 block 而非 grid ——
	// grid item 的 sticky 只在自己那一行的范围内生效,一滚就跑没了
	.travel-body {
		display: block;
	}

	.travel-map-col {
		z-index: 2;
		height: 35vh;
		border-bottom: 1px solid var(--c-border);
		transition: height var(--delay);

		&.collapsed {
			height: 2.5rem;
		}
	}

	.travel-map-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		position: absolute;
		z-index: 3;
		right: 0.6rem;
		bottom: 0.6rem;
		width: 2rem;
		height: 2rem;
		border: 1px solid var(--c-border);
		border-radius: 50%;
		box-shadow: var(--box-shadow-1);
		color: var(--c-text-1);
		background-color: var(--c-bg-a80);
		backdrop-filter: blur(0.5rem);
	}

	.travel-narrative {
		padding: 1rem;
	}
}
```

并给 `.travel-map-col` 的基础样式加 `position: sticky` 所需的定位上下文(桌面端不显示按钮,`mobile-only` 已由主题提供):

```scss
.travel-map-col {
	position: sticky;
	top: 0;
	order: 2;
	height: 100vh;
	height: 100dvh;
}
```

(即在 Task 3 的基础上保持不变,按钮用 `position: absolute` 挂在它内部。)

- [ ] **Step 2: 确认 `mobile-only` 工具类存在**

Run: `grep -rn "mobile-only" app/assets/css/*.scss | head -2`
Expected: 有输出(`link.vue` 已在用)。若无,改用 `@media (min-width: $breakpoint-mobile) { .travel-map-toggle { display: none; } }`。

- [ ] **Step 3: 移动端人工验证**

Run: `pnpm dev --no-open >/tmp/travels-dev.log 2>&1 & sleep 25 && open http://localhost:3000/travels/kansai-202504`

浏览器切到手机视口(如 iPhone 14,390×844):
1. Hero 满屏,文字不溢出。
2. 滚下去,地图吸在顶部(35vh),正文在其下滚动 —— **地图不会滚走**(这是 `display: block` 那条注释在防的坑)。
3. 点收起按钮,地图缩成 2.5rem 细条,正文占满。
4. 照片网格每行 2 张,点开灯箱正常。
5. 滚动切节时地图仍然跟着飞。

- [ ] **Step 4: 全量验证 —— lint**

Run: `pnpm lint`
Expected: 无 error、无 warning。

- [ ] **Step 5: 全量验证 —— 预渲染产物**

Run:

```bash
pnpm generate 2>&1 | tail -20
ls dist/travels/ dist/travels/kansai-202504/ 2>/dev/null || ls dist/travels*
grep -o '近畿地方' dist/travels/kansai-202504/index.html | head -1
grep -o '/travels[^<]*' dist/sitemap.xml | sort -u
```

Expected:
- 构建成功,无 prerender 报错(尤其不能再出现 `/travels` 相关 404 —— Task 2 删掉的那条 ignore 就是为它加的)。
- `dist/travels/index.html` 与 `dist/travels/kansai-202504/index.html` 都存在。
- 详情页 HTML 里能 grep 到 `近畿地方`(说明内容是静态生成的,不靠客户端取数)。
- sitemap 里同时有 `/travels` 与 `/travels/kansai-202504`(@nuxtjs/seo 收录预渲染路由;若 sitemap 文件名不同,用 `ls dist/*.xml` 找)。

- [ ] **Step 6: 全量验证 —— 旧文内链没断**

Run:

```bash
grep -rn "/travels/" content/posts/ | head
```

Expected:找到 `one-month-using-android.md` 里指向 `/travels/kansai-202504` 的链接;确认该路径与 Step 5 生成的目录一致(即链接不再 404)。

- [ ] **Step 7: 提交**

```bash
git add app/pages/travels/\[slug\].vue
git commit -m "feat(travels): 移动端地图吸顶条与折叠开关

窄屏原本没有地图(旧站直接砍掉了),这里补上:吸顶 35vh,可一键收起。"
```

---

## 完成标准

- `/travels` 列表页、`/travels/kansai-202504` 详情页均可访问且被预渲染进 `dist/`。
- 旧文内链 `/travels/kansai-202504` 不再 404。
- 滚动叙事与地图三种联动(滚动切节、点照片聚焦、切节清聚焦)在桌面与移动端均可用。
- 明暗主题下底图、标记、popup 观感一致。
- `pnpm lint` 与 `pnpm generate` 均通过。
- 全程无运行时外部依赖:PocketBase 已彻底脱钩。
