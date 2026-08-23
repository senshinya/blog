<script setup lang="ts">
import type { Memo } from '~/utils/memo'

const API = 'https://memos.shinya.click/api/v1/memos'

/** 落款那行时间：给到分钟。zh-CN 下形如「2026年7月13日 18:05」 */
const DETAIL_TIME = {
	year: 'numeric',
	month: 'long',
	day: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
} satisfies Intl.DateTimeFormatOptions

const route = useRoute()
const appConfig = useAppConfig()
// 取数 handler 里要用，得在 setup 阶段先抓住（理由见下面 404 那段）
const nuxtApp = useNuxtApp()

const id = computed(() => String(route.params.id))

/**
 * 单条碎语的固定链接页。按需服务端渲染，产物由 Vercel 的 ISR 缓存（见 nuxt.config 的
 * routeRules '/memos/**'）。取数必须在服务端跑完，下面 useSeoMeta 那几行才有内容可写 ——
 * 爬虫不跑 JS，客户端再漂亮的 head 它也看不见。
 *
 * key 用定值 + watch，而不是「随 id 变化的响应式 key」（useAsyncData 本身是支持后者的）：
 * 本项目开了 experimental.extractAsyncDataHandlers，它把传进来的第一个函数一律当作 handler
 * 抽进独立 chunk，于是响应式 key 会被换成一个返回 Promise 的懒加载包装函数，
 * 运行期直接抛 “key must be a non-empty string”。
 *
 * 仍用 lazy 版：lazy 只影响客户端导航（从列表点进来时不挂起 Suspense，先换页再显示加载态），
 * 服务端那一遍照样 await（nuxt/app/composables/asyncData 里 onServerPrefetch(() => promise)）。
 */
const { data, status, error } = useLazyAsyncData(
	'memo-detail',
	async () => {
		const raw = await $fetch<Memo>(`${API}/${id.value}`).catch((err) => {
			/**
			 * 删掉的、拼错的 id，接口回 404，此处翻成页面的 404（与 travels/[slug] 一致）。
			 * 两处讲究，少哪个都会退回「200 + 一句加载失败」，对爬虫而言等于这条碎语存在：
			 *
			 * 1. 在 handler 里当场处理，而不是在外面 watch(error)。SSR 下 Vue 的 watch 回调
			 *    根本不会跑 —— doWatch 见 isInSSRComponentSetup 就直接返回 NOOP，
			 *    只有 immediate 会同步触发一次，而那一刻还没开始取数。
			 *
			 * 2. 套一层 runWithContext。这个回调是在 await 之后的微任务里跑的，Nuxt 的
			 *    上下文已经断了（experimental.asyncContext 没开，服务端不走 AsyncLocalStorage），
			 *    裸调 showError 会在它内部的 useNuxtApp() 上抛出来 —— 而 showError 的
			 *    catch 分支正是「把错误 throw 出去」，于是这个 404 反被 useAsyncData
			 *    收进 error.value，成了一次普通的取数失败，HTTP 状态码仍是 200。
			 */
			if (err?.statusCode === 404) {
				nuxtApp.runWithContext(() => showError(createError({
					statusCode: 404,
					statusMessage: '碎语不存在',
					fatal: true,
				})))
			}
			throw err
		})
		return {
			memo: parseMemo(raw),
			// 纯文本仅供 title / description，正文该渲染的还是 memo.blocks
			summary: toMemoPlainText(raw.content),
		}
	},
	{ watch: [id] },
)

// 服务端渲染那一遍数据已经就位，走不到加载态；这里管的是客户端从列表点进来的那段空窗。
// idle 也算上：lazy 的首次取数被推迟到 onBeforeMount，此前 status 停在 idle
const loading = computed(() => status.value === 'idle' || status.value === 'pending')

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
	ogType: 'article',
	// 碎语多是随手截图，首图即分享卡的主图（Memos 存的是图床绝对地址，直接可用）。
	// 纯文字的那些退回头像，免得卡片上空着一块 —— 各家 IM 对没有 og:image 的链接
	// 收缩得很厉害，有张图才展得开
	ogImage: () => data.value?.memo.images[0] || appConfig.author.avatar,
	// 有真图才铺大图；退回头像时用 summary，免得一张方形头像被拉成横幅
	twitterCard: () => data.value?.memo.images.length ? 'summary_large_image' : 'summary',
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

		<!--
			page key 用 /memos/<id>，与列表卡片取计数的 key 是同一个，
			故卡片上的数字和这里的线程永远一致。
			标题没有，用正文首句 —— 站长面板和通知邮件里要靠它认出是哪条碎语。
		-->
		<CommentSection
			reactions
			reaction-label="给这条 memo 一个反馈"
			:page-key="`/memos/${data.memo.id}`"
			:title="data.summary.slice(0, 60)"
		>
			<template #react-aside>
				<UtilDate class="timestamp" :date="data.memo.createTime" :format="DETAIL_TIME" />
			</template>
		</CommentSection>
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
// 正文与反馈行之间没有分隔线了，靠这段留白划界，故比原先多给一点
:deep(.z-comment) {
	margin-block-start: 1.5rem;
}

// 与正文头部那个相对时间同一档字重字色 —— 它只是元数据，不该压过正文
.timestamp {
	font-family: var(--font-monospace);
	font-size: 0.8rem;
	color: var(--c-text-3);
}

.tip {
	font-size: 0.9em;
	text-align: center;
	color: var(--c-text-3);
}
</style>
