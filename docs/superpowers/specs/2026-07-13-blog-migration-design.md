# 博客迁移设计：retypeset (SvelteKit + PocketBase) → Clarity (blog-v3)

日期：2026-07-13
状态：待评审

## 背景

现有博客 `~/Downloads/blog`（代号 retypeset）是一套自带 CMS 的 SvelteKit 应用，内容存在 PocketBase 数据库里。目标是迁移到 [blog-v3](https://github.com/L33Z22L11/blog-v3)（主题名 Clarity），一个 Nuxt 4 + Nuxt Content v3 的 Markdown 博客。

本次迁移的目标是**在本地跑通**：把内容导进 Clarity，`pnpm dev` 起来看效果。部署、301 重定向、PocketBase 下线均不在本次范围内。

## 现状盘点（实测）

| 项 | 实测值 |
|---|---|
| 框架 | SvelteKit 2 + Svelte 5 + UnoCSS |
| 内容存储 | PocketBase (`blog-api.shinya.click`，公开可读) |
| 集合 | `posts` `pages` `tags` `friends` `travels` `travel_days` `travel_photos` |
| 文章 | 42 篇 × 3 语言 (zh/en/ja) = 126 条，**0 草稿** |
| 分类（abbrlink 前缀） | `fiddling` 23、`projects` 11、`daily` 4、`notes` 4 |
| 时间跨度 | 2021–2026 |
| 标签 | 151 个（含各语言译名） |
| 游记 | 1 组（关西 2025.04）× 3 语言，6 天 / 约 49 张带 GPS 的照片 |
| 友链 / about | 6 条 / 1 页 |
| memos | 独立自建服务 `memos.shinya.click`，**不在 PocketBase 里** |
| 正文图片 | 全部外链 `blog-img.774352199.xyz`（37 张），**0 相对路径** |
| 封面图 | 42 篇**全空** |
| URL | `/{分类}/{slug}`，多语言为 `/en/...` `/ja/...` |
| 部署 | 后台手动打包 ZIP → Netlify；Giscus 评论、Umami 统计 |

### Markdown 方言实测

注册了 11 个自定义 remark/rehype 插件，但**实际被文章用到的只有一个**：

- `::github{...}` GitHub 仓库卡片 —— 6 篇
- B 站 `<iframe>` —— 1 篇
- 裸 `<img>` —— 1 篇
- 其余（代码块 32 篇、KaTeX 5 篇、表格 2 篇）均为标准语法，Clarity 原生支持
- **没有** `:::` 容器指令，**没有** mermaid

> `fiddling/vitepress-memos-component` 里的大量 `<div>` 是代码块内的示例代码，非活 HTML，无需处理。

## 已确认的决策

| 议题 | 决策 |
|---|---|
| 多语言 | **只保留中文**，放弃 en/ja 共 84 篇译文 |
| 写作流 | **彻底转 Git + Markdown**，PocketBase 一次性导出后废弃 |
| 分类 | **沿用 `fiddling / projects / daily / notes`**，不改用 Clarity 的中文分类体系 |
| 评论 | **继续用 Giscus**（保住 GitHub Discussions 里的历史评论） |
| 仓库 | **Fork blog-v3**，保留 upstream 以便跟进上游 |
| 部署 | 目标是 Netlify Git 自动部署，但**本次不做** |
| 游记 | **本次不迁移**，数据存档，后续重新规划 |
| memos | 迁移，但**按 Clarity 设计语言重写**，非照搬旧组件 |
| 友链页 URL | **沿用 Clarity 的 `/link`**，放弃旧站的 `/friends`（不改上游文件，零冲突；301 以后再说） |
| 友链字段 | 只导 `name/url/avatar/description` 四项，Clarity 多出的 `feed`/`archs`/`date` **留空** |

## 设计

### 1. 工作区与仓库

`~/Downloads/blog-clarity` 作为新工作区。因为该目录已有 `docs/`（本文档），不能直接 `git clone`；改用 `git init` + 添加 `upstream` remote + fetch + checkout 的方式落地 blog-v3 代码。

用 Clarity 自带的 `scripts/init-project.ts` 做个性化（作者、域名、favicon）。

**清理上游自带内容** —— fork 下来的仓库里带着纸鹿本人的数据，必须清干净，否则会混进你的站点：

| 上游资产 | 处理 |
|---|---|
| `content/posts/**`（90 篇纸鹿的文章） | 全部删除，换成导出的 42 篇 |
| `content/previews/**` + `app/pages/preview.vue` | 删除（这是纸鹿的特有功能，你没有对应内容） |
| `app/feeds.ts`（纸鹿的友链） | 覆盖为你的 6 条 |
| `content/link.md`（友链申请文案，含纸鹿的邮箱） | 改写成你的 |
| `content/theme.md` | 保留（是主题说明页，可选删） |
| `redirects.json`（纸鹿的旧链接映射） | 清空为 `{}` |
| `blog.config.ts` 里的 `myFeed`、Umami/CF 埋点、Twikoo 配置 | 全部换成你的 |

**旧仓库 `~/Downloads/blog` 全程不动**，作为参照物与回退点。

### 2. 数据存档（第 0 步，不可跳过）

脚本 `scripts/migration/dump-pocketbase.ts`：把 PocketBase 全量 dump 成 `archive/pocketbase-dump-2026-07-13.json`，**包含 en/ja 译文和完整游记数据**（travels / travel_days / travel_photos）。

理由有二：

1. en/ja 译文是花过 OpenAI 成本的产物，dump 成本近乎为零，不该跟着 PocketBase 一起消失。
2. 游记本次不迁但后续要重新规划，其数据（6 天 / 49 张带 GPS 的照片）必须先落盘，否则 PocketBase 一旦下线就没了。

后续所有导出脚本**只读这份存档**，不直接打 PocketBase。这样脚本可反复重跑，且不依赖 PocketBase 存活。

### 3. 内容导出管线

一次性脚本 `scripts/migration/pb-to-content.ts`：读存档 JSON → 产出 `content/posts/**/*.md`。

**字段映射**：

| PocketBase | Clarity frontmatter | 说明 |
|---|---|---|
| `abbrlink`（如 `fiddling/xxx`） | 文件路径 `content/posts/fiddling/xxx.md` | Clarity 路由规则为「文件路径去掉 `/posts` 前缀」，故 **URL 自动等于 `/fiddling/xxx`，与旧站完全一致** |
| `title` / `description` | `title` / `description` | 直传 |
| `published` / `updated` | `date` / `updated` | 时区按 `Asia/Shanghai` 输出 |
| `tags`（关系字段，expand 取 `name`） | `tags: [...]` | 只取中文标签 |
| abbrlink 前缀 | `categories: [fiddling]` | 推导得出，零人工分类 |
| `body` | 正文 | 见下方方言处理 |
| `lang` | — | 只取 `zh`，丢弃 |
| `pin` `toc` `coverImage` `draft` | — | **丢弃**：实测取值全为常量（pin 全 0、toc 全 true、封面全空、草稿全 false），映射过去也是死数据 |

**方言处理**（全站仅 3 处需要动）：

1. `::github{...}` → 新增 `app/components/content/Github.vue`。**新增文件，不改动上游代码，跟新时零冲突。**
2. B 站 `<iframe>`（1 篇）→ 改用 Clarity 自带的 `VideoEmbed` 组件。
3. 裸 `<img>`（1 篇）→ 原样保留，Nuxt Content 可直接渲染。

**不搬运任何静态资源** —— 图片全是外链。

### 4. 主题定制（4 处）

原则：能新增文件就不改上游文件，把跟进上游时的冲突面压到最小。

| # | 改动 | 冲突风险 |
|---|---|---|
| 1 | `blog.config.ts`：站点信息 + 分类改为 `fiddling / projects / daily / notes`（配中文显示名、图标、颜色） | 低（配置文件，本就该改） |
| 2 | 评论：Twikoo → Giscus | **中 —— 这是唯一必须改上游组件的地方，跟新时的固定冲突点** |
| 3 | 新增 `app/components/content/Github.vue` | 无（纯新增） |
| 4 | 移除纸鹿的 Umami / Cloudflare Insights 埋点，换成自己的 Umami | 低（配置） |

### 5. about 页与友链

**about 页** —— 旧站存在 `pages` 集合（`key=about`，仅中文 1 条，正文是一句题词 + GPG 公钥代码块）。导出为 `content/about.md` 即可：Clarity 的内容集合 source 为 `**`，根级 markdown 文件直接映射为路由，故 URL 为 `/about`，**与旧站一致**。零改造。

**友链** —— 旧站 6 条（5 条 `lang=zh`，1 条 `lang=''`，全部保留）。Clarity 的友链数据在 `app/feeds.ts`（TS 数组，类型 `FeedEntry`），页面申请文案在 `content/link.md`，页面组件为 `app/pages/link.vue`。

导出脚本生成 `app/feeds.ts`，字段映射：

| PocketBase `friends` | Clarity `FeedEntry` |
|---|---|
| `name` | `title` |
| `url` | `link` |
| `avatar` | `avatar` |
| `description` | `desc` |
| `sort` | 决定数组顺序 |
| — | `feed` / `archs` / `date` / `sitenick` **留空** |

友链页 URL 沿用 Clarity 的 `/link`（旧站是 `/friends`）。不改上游文件，跟新零冲突。

### 6. memos 页

新增 `app/pages/memos.vue`。**不移植旧 Svelte 组件的样式**，而是按 Clarity 的设计语言重写：复用其 SCSS 设计变量与既有组件原语（如 `Timeline.vue`、卡片样式），使 memos 页看起来像 Clarity 的原生页面，而不是一块外来补丁。

数据源不变：客户端 fetch `https://memos.shinya.click/api/v1/memos?pageSize=10`，支持 `nextPageToken` 翻页。**零数据迁移** —— Memos 是独立自建服务，PocketBase 下线不影响它。

### 7. 本次不做（明确排除）

- 游记迁移（数据已存档，后续单独规划）
- Netlify 部署与 Git 自动构建
- 重定向：`/en/*` `/ja/*` → 中文页，`/friends` → `/link`
- PocketBase 下线
- 旧站的 `/admin` CMS、OpenAI 翻译、Pagefind、satori OG 图 —— 均随旧站废弃

### 8. 验收标准

`pnpm dev` 本地起站，逐项核对：

1. 42 篇文章全部渲染，无构建报错
2. 抽查文章 URL 与旧站一致（如 `/fiddling/one-trek-twenty-stacks`）
3. 3 处方言正确渲染：6 篇 GitHub 卡片、1 篇 B 站视频、1 篇裸 `<img>`
4. KaTeX 公式（5 篇）、代码块高亮（32 篇）、表格（2 篇）正常
5. 分类页 / 标签页 / 归档页内容正确
6. `/about` 正常渲染（含 GPG 公钥代码块）
7. `/link` 显示 6 条友链
8. memos 页能拉到数据、能翻页、视觉上与 Clarity 融为一体
9. 存档 JSON 含 en/ja 译文与完整游记数据
10. **全站无纸鹿残留**：搜不到他的文章、友链、邮箱、统计埋点、redirects

## 风险

| 风险 | 应对 |
|---|---|
| Giscus 改造与上游 Twikoo 长期冲突 | 已知且接受；改动集中在单一组件，冲突面可控 |
| Clarity 分类体系被换成自定义的四个，可能与其视觉设计（图标/配色）预设不符 | 分类配置支持自定义图标与颜色，逐个配好即可 |
| 42 篇正文可能有未被扫描规则覆盖的边缘语法 | 验收标准第 1 条（全量构建无报错）+ 逐篇肉眼抽查兜底 |
