<script setup lang="ts">
import type { Memo } from '~/utils/memo'

const API = 'https://memos.shinya.click/api/v1/memos'

const route = useRoute()
const appConfig = useAppConfig()

const id = computed(() => String(route.params.id))

/**
 * 单条碎语的固定链接页。
 *
 * 静态托管上 /memos/<id> 并没有对应的 HTML 文件 —— 靠平台的 200 重写，把预渲染出来的
 * /memos/_shell 顶到任意 /memos/* 上（Netlify 见 public/_redirects，Vercel 见 nuxt.config
 * 的 nitro.vercel）。所以这个页面在构建期只会以 id="_shell" 渲染一次，且必须渲染成
 * 与客户端首帧一模一样的加载态：DOM 对得上，水合才不会错位。
 *
 * 推论：加载态里不能出现 id、也不能出现任何与具体某条碎语有关的内容。
 *
 * server: false 同时也是碎语一贯的取数方式 —— 构建期取数会让页面永远停在上次部署的快照。
 *
 * key 用定值 + watch，而不是「随 id 变化的响应式 key」（useAsyncData 本身是支持后者的）：
 * 本项目开了 experimental.extractAsyncDataHandlers，它把传进来的第一个函数一律当作 handler
 * 抽进独立 chunk，于是响应式 key 会被换成一个返回 Promise 的懒加载包装函数，
 * 运行期直接抛 “key must be a non-empty string”。
 */
const { data, status, error } = useLazyAsyncData(
	'memo-detail',
	async () => {
		const raw = await $fetch<Memo>(`${API}/${id.value}`)
		return {
			memo: parseMemo(raw),
			// 纯文本仅供 title / description，正文该渲染的还是 memo.html
			summary: toMemoPlainText(raw.content),
		}
	},
	{ server: false, watch: [id] },
)

// server: false 时服务端压根不取数，status 停在 idle 而非 pending。
// 漏掉 idle 会让预渲染的壳落到「加载失败」分支上
const loading = computed(() => status.value === 'idle' || status.value === 'pending')

// 重写规则把所有 /memos/* 都收下了，删掉的、拼错的 id 一样返回 200 + 这个壳，
// 「不存在」只能等接口回话才知道，故 404 在此处补上（与 travels/[slug] 的处理一致）
watch(error, (err) => {
	if (err?.statusCode === 404) {
		showError(createError({
			statusCode: 404,
			statusMessage: '碎语不存在',
			fatal: true,
		}))
	}
})

/**
 * canonical 与 og:url 得自己来 —— seo 模块生成的那份是**小写**的。
 *
 * nuxt-seo-utils 默认会把 canonical 的路径整体转小写（canonicalLowercase），对本站其余
 * 页面无所谓（路径本来就是小写），但 memo 的 id 是大小写敏感的 nanoid：
 * /memos/QZbUFrYf8w3ac85s6g9LH7 一旦被写成 /memos/qzbufryf8w3ac85s6g9lh7，
 * 那个地址拿去请求接口是 404，等于对外公布了一个打不开的固定链接。
 *
 * 只在本页覆写，不去动全站的 canonicalLowercase。（unhead 对 canonical 去重，不会多一条。）
 */
const canonical = computed(() => new URL(`/memos/${id.value}`, appConfig.url).href)

useHead({
	link: [{ rel: 'canonical', href: canonical }],
})

useSeoMeta({
	// 碎语没有标题，用正文首句代替。中英混排按字数截断本就难看，
	// 但 title 是纯文本，没有 line-clamp 可用，只能按字数来
	title: () => data.value ? (data.value.summary.slice(0, 30) || '图片') : '碎语',
	description: () => data.value?.summary || `${appConfig.title}的碎碎念。`,
	ogUrl: canonical,
})
</script>

<template>
<template #aside>
	<TransitionGroup name="aside-widget">
		<WidgetBlogStats key="blog-stats" />
		<WidgetBlogTech key="blog-tech" />
	</TransitionGroup>
</template>

<div class="memo-detail proper-height">
	<UtilLink to="/memos" class="back">
		<Icon name="tabler:chevron-left" />
		<span>碎语</span>
	</UtilLink>

	<!-- 404 已交给 showError，走到这里的是网络错误一类 -->
	<ZError v-if="error" :message="`碎语加载失败：${error.message}`" />

	<p v-else-if="loading" class="tip">
		加载中...
	</p>

	<article v-else-if="data" class="memo">
		<MemoBody v-bind="data.memo" detail />

		<hr class="divider">

		<!-- 与列表卡片同一个 term，故进的是同一条讨论线程，历史评论不断 -->
		<UtilGiscus
			mapping="specific"
			:term="`memo/${data.memo.id}`"
			:category="appConfig.giscus.memoCategory"
			:category-id="appConfig.giscus.memoCategoryId"
		/>
	</article>
</div>
</template>

<style lang="scss" scoped>
.memo-detail {
	padding: 1rem;
}

.back {
	display: inline-flex;
	align-items: center;
	gap: 0.1em;
	margin-bottom: 1.5rem;
	font-size: 0.9em;
	color: var(--c-text-3);
	transition: color 0.2s;

	&:hover {
		color: var(--c-primary);
	}
}

// 详情页只此一条，不必再用列表那种描边把它从邻居里划出来。
// 不用 flex 的 gap：正文与分隔线之间要留白，分隔线与评论之间不留 —— 两侧不对称，
// 交给各自的 margin 更直白
.memo {
	display: flex;
	flex-direction: column;
	animation: float-in 0.3s backwards;
}

// 正文与评论是两件事，但都在这一页上，故用一道细线划开 ——
// 颜色取卡片描边那档，是这套界面里最轻的一级结构线。
// 时间是正文的落款，与线贴得近些；线与评论之间反而要留出换气的余地
.divider {
	width: 100%;
	height: 0;
	margin: 0.5rem 0 0;
	border: none;
	border-top: 1px solid var(--c-bg-soft);
}

// giscus 自带的 margin: 1em 0 叠在上面的间距里偏挤，收到 1rem 由这里统一说了算
:deep(.giscus) {
	margin-block-start: 1rem;
}

.tip {
	font-size: 0.9em;
	text-align: center;
	color: var(--c-text-3);
}
</style>
