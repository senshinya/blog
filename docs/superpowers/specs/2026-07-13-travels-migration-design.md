# 游记迁移设计:从 SvelteKit 旧站到 clarity

日期:2026-07-13
状态:已获批准

## 背景与目标

旧站(`~/Downloads/blog`,SvelteKit + PocketBase)有一个游记板块:列表页 `/travels` 与详情页 `/travels/[slug]`,详情页为全屏 bento 翻页式体验(逐日翻页 + Leaflet 地图联动 + 照片查看器,移动端无地图)。现有唯一一篇游记《近畿地方 2025.4》(中文版 6 个日程节、49 张照片,全部带经纬度与图注),照片托管在 `blog-img.774352199.xyz`。

本次是[上一轮博客迁移](./2026-07-13-blog-migration-design.md)的续作。那一轮明确决定「游记本次不迁移,数据存档,后续重新规划」,并已把 PocketBase 全量导出到 `archive/pocketbase-dump-2026-07-13.json`(含 `travels` / `travel_days` / `travel_photos`);`nuxt.config.ts` 中也留了「游记本轮未迁移」的注释与 `/travels` 预渲染忽略项。本次即是那个「后续」。

**详情页 URL 必须保持 `/travels/kansai-202504`**,旧文内链(如 one-month-using-android 中的「关西行」)依赖它。

已确认的方向性决定:

1. **数据静态入库**:不再依赖 PocketBase,数据以文件形式进仓库。
2. **详情页重设计为滚动叙事(scrollytelling)**:替代原全屏翻页式。
3. **地图改用 mapcn 方案**(https://www.mapcn.dev/)。mapcn 是 React-only 的 copy-paste 组件库,本质为「MapLibre GL + 免 key 瓦片 + 明暗自适应」;在 Vue 中按同一方案复刻,不引入 React。

## 数据层

- `app/types/travel.ts`:`Travel` / `TravelDay` / `TravelPhoto` 类型。沿用源结构,去掉 PB 特有字段(id/collectionId/…)与多语言字段:

  ```ts
  interface Travel {
    slug: string            // kansai-202504
    title: string           // 近畿地方
    subtitle: string        // 2025.4
    posttitle: string       // 游记:近畿地方(2025.4),用于 <title> 与列表
    description: string     // 多行简介
    published: string       // ISO 日期
    totaldays: number
    coverImage: string
    days: TravelDay[]
  }
  interface TravelDay {
    day: number             // 0 起,同一 day 可有多个节
    title: string
    descriptions: string[]  // 段落数组
    photos: TravelPhoto[]
  }
  interface TravelPhoto {
    src: string
    alt: string
    caption?: string
    lat?: number
    lng?: number
  }
  ```

- 数据文件:`app/travels/kansai-202504.yaml`(项目已启用 unplugin-yaml,可直接 import)。
- 注册表:`app/travels/index.ts`(仿 `app/feeds.ts` 模式),import 各 YAML、断言类型、按 `published` 倒序导出数组,并提供 `getTravelBySlug()`。
- 迁移脚本:`scripts/migration/pb-to-travels.ts`,沿用 `pb-to-content.ts` 的约定——**只读 `archive/pocketbase-dump-2026-07-13.json`,不访问线上 PocketBase,可反复重跑**。取 `lang === 'zh'` 的游记,days 按 `day` + `sort` 排序、photos 按 `sort` 排序,`<br />` 等 HTML 转为纯文本换行,产出 YAML。en/ja 不迁移(本站纯中文)。
- 照片继续使用现有 CDN URL,不搬迁。

> 为何不放 `content/`:`[...slug].vue` 会把 content 集合中的文档按文章渲染,游记的嵌套结构(days/photos)需改 `content.config.ts` 的 zod schema 并在渲染层特判类型,代价不值。放 `app/travels/` 后,slug 由 `pages/travels/[slug].vue` 的动态路由承担,与 Nuxt Content 无关。

## 路由与入口

| 路由 | 文件 | 布局 |
|---|---|---|
| `/travels` | `app/pages/travels/index.vue` | 默认布局(带侧边栏) |
| `/travels/[slug]` | `app/pages/travels/[slug].vue` | `layout: false` 全屏沉浸 |

- 路由优先级:静态段 > 动态段 > 全捕获,`/travels/*` 不会落入 `[...slug].vue`,与 Nuxt Content 无冲突。
- 左侧导航「游记」(icon `tabler:map-2`),置于「碎语」之后。
- 预渲染:`nuxt.config.ts` 中 import 注册表,把 `/travels` 与每篇 `/travels/<slug>` 显式加入 `nitro.prerender.routes`;删除现有的「忽略 /travels 前缀」临时规则。
- 详情页 404:slug 查不到时 `createError({ statusCode: 404 })`。

## 列表页

默认布局内的封面大卡片列表:封面图(16:9)、标题、副标题、简介、天数 + 发布日期,视觉贴合 clarity 现有卡片风格(CSS 变量、圆角、阴影、hover)。当前仅一篇,布局需在 1 篇时也不显空洞(单列大卡)。

## 详情页:滚动叙事

- **Hero 首屏**:满屏封面图 + 渐变遮罩,标题/副标题/描述/天数,向下滚动提示。
- **桌面端主体**:两栏。左栏(约 55%)按天滚动:Day 徽章、当日标题、段落、照片网格;右栏(约 45%)sticky 满高地图。
- **滚动联动**:IntersectionObserver 监测当前可见的天 → 地图 `flyToBounds` 至当天带坐标照片的范围,并仅显示当天标记。
- **照片交互**:点击照片 → 灯箱(复用 `PopoverLightbox`,caption 显示图注)+ 地图 flyTo 该照片坐标并打开对应标记 popup;点击地图标记 → popup 显示照片缩略卡片。
- **移动端**(补上原版没有的地图):滚过 Hero 后,地图为 sticky 顶部条(约 35vh,可一键收起),内容在其下滚动,联动逻辑相同。
- **页面镶边**:顶部极简返回条(← 游记);底部返回列表(将来有多篇时改为上一篇/下一篇)。
- 无坐标照片的天:地图保持上一次视野,不 flyTo。

## 地图组件(mapcn 方案复刻)

- 新增依赖 `maplibre-gl`,仅在详情页动态 import(不影响其余页面体积)。
- 瓦片:CARTO 免费底图(无 API key),浅色 `positron` / 深色 `dark-matter`,跟随站点 color-mode 切换(`setStyle`);样式 URL 收敛为常量,便于日后换 OpenFreeMap。
- `app/components/travel/TravelMap.vue`:封装地图实例生命周期,对外暴露「设置当天照片标记」「flyTo 单张照片」等方法;标记为自定义 DOM 元素(mapcn 风格圆点),popup 为照片缩略卡片,样式全部使用项目 CSS 变量(`--c-bg`、`--c-border` 等)以保证明暗观感一致。

## SEO 与杂项

- `useSeoMeta`:posttitle 为标题、description、og:image = 封面。
- 列表页与详情页均预渲染、进 sitemap。
- 本轮不做:评论、多语言、照片路线连线、游记进 Atom 订阅源。

## 验证

- `pnpm lint` 通过。
- `pnpm dev` 下桌面/移动两种视口人工+截图验证:滚动联动、灯箱、明暗主题切换、地图标记 popup、`/travels/kansai-202504` 旧链接可达、404 slug 行为。
- `pnpm generate` 确认两条路由进入预渲染产物。
