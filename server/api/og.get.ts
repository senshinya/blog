import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import blogConfig from '~~/blog.config'

/**
 * 取任意外链的 Open Graph 元数据，供碎语的链接预览卡使用（见 app/components/memo/LinkCard.vue）。
 *
 * 为什么要有这个端点：碎语是运行时数据，构建期无从枚举里头的链接；而浏览器直接去
 * fetch 别人的站必被 CORS 拦下 —— 对方没有理由给我们回 Access-Control-Allow-Origin。
 * 于是把请求收回同源，由服务端代取。
 *
 * 这也是全站唯一的运行时函数。其余页面仍是构建期预渲染的静态产物
 * （见 nuxt.config 的 nitro.prerender）。
 */

/** 只读前 64 KB：og:* 全在 <head> 里，读这么多绰绰有余，同时挡住超大响应把函数撑爆 */
const MAX_BYTES = 64 * 1024
const TIMEOUT_MS = 5000
const MAX_REDIRECTS = 3

/**
 * 按链接预览爬虫的惯例署名，而不是伪装成浏览器。
 *
 * 这既是该有的礼貌，实际成功率也更高 —— 不少站点会专门放行
 * Twitterbot / Slackbot 这类展开链接的爬虫。
 */
const USER_AGENT = `Mozilla/5.0 (compatible; ClarityLinkPreview/1.0; +${blogConfig.url})`

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])
const ALLOWED_PORTS = new Set(['', '80', '443'])
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308])

/** 私有段、环回、链路本地、组播。SSRF 的第一道闸 */
function isPrivateIp(ip: string) {
	const version = isIP(ip)

	if (version === 4) {
		const [a = 0, b = 0] = ip.split('.').map(Number)
		return a === 0 || a === 10 || a === 127
			|| (a === 169 && b === 254) // 云厂商的实例元数据就挂在 169.254.169.254
			|| (a === 172 && b >= 16 && b <= 31)
			|| (a === 192 && b === 168)
			|| a >= 224
	}

	if (version === 6) {
		const addr = ip.toLowerCase()
		return addr === '::1' || addr === '::'
			|| addr.startsWith('fc') || addr.startsWith('fd') // 唯一本地地址
			|| addr.startsWith('fe80') // 链路本地
			|| addr.startsWith('::ffff:') // IPv4 映射地址，一律拒，免得绕开上面那套判断
	}

	return false
}

/**
 * 确认目标确实在公网上。
 *
 * 域名要解析之后再判 —— 只看字符串的话，一个指向 10.x 的内网域名能大摇大摆走进来。
 *
 * 说明白：这挡不住 DNS rebinding（校验时解析一次、真连接时再解析一次，中间可以变脸）。
 * 要堵死得在 socket 层接管连接，成本远超这个功能的收益。上面这套能挡掉绝大多数，
 * 剩下的残余风险是知情接受的。
 */
async function isPublicHost(hostname: string) {
	if (isIP(hostname))
		return !isPrivateIp(hostname)

	try {
		const { address } = await lookup(hostname)
		return !isPrivateIp(address)
	}
	catch {
		// 压根解析不出来，没什么可抓的
		return false
	}
}

function toUrl(raw: string, base?: string) {
	try {
		return new URL(raw, base)
	}
	catch {
		return null
	}
}

function parseTarget(raw: string, base?: string) {
	const url = toUrl(raw, base)
	if (!url || !ALLOWED_PROTOCOLS.has(url.protocol) || !ALLOWED_PORTS.has(url.port))
		return null
	return url
}

/** 读够 MAX_BYTES 就撒手，别把整页拖回来 */
async function readCapped(response: Response) {
	const reader = response.body?.getReader()
	if (!reader)
		return new Uint8Array()

	const chunks: Uint8Array[] = []
	let size = 0
	while (size < MAX_BYTES) {
		const { done, value } = await reader.read()
		if (done)
			break
		chunks.push(value)
		size += value.length
	}
	await reader.cancel().catch(() => {})

	const bytes = new Uint8Array(size)
	let offset = 0
	for (const chunk of chunks) {
		bytes.set(chunk, offset)
		offset += chunk.length
	}
	return bytes
}

/**
 * 按页面自称的编码解码。
 *
 * 不能一律当 utf-8 —— 中文站点里 GBK 仍不少见，认错了标题就是一串乱码。
 * 先用 latin1 扫一遍找 <meta charset>：ASCII 区间在这些单字节编码下的字节值都一致，
 * 足够把编码名认出来。TextDecoder 认得 gbk / gb18030 / big5（Node 内建 ICU 就带），
 * 认不出的退回 utf-8。
 */
function decodeHtml(bytes: Uint8Array) {
	const probe = new TextDecoder('latin1').decode(bytes)
	// 引号之后不再留 \s*：那处空白既不合法，两个 \s* 隔着一个可选引号还会互相争抢，
	// 招来多项式回溯（同 utils/memo.ts 里 IMAGE_RE 的顾虑）
	const charset = probe.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]

	try {
		return new TextDecoder(charset || 'utf-8').decode(bytes)
	}
	catch {
		return new TextDecoder('utf-8').decode(bytes)
	}
}

/**
 * 手动跟重定向，而不是交给 fetch 的 redirect: 'follow'。
 *
 * 两个原因：其一，follow 最多跟 20 跳且不可配；其二 —— 更要紧 ——
 * 每一跳都得重新验一次目标是否在公网上，否则一个 302 到 127.0.0.1 就把前面的校验全绕过去了。
 */
async function fetchDocument(target: URL, signal: AbortSignal) {
	let url = target

	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		if (!await isPublicHost(url.hostname))
			return null

		const response = await fetch(url, {
			signal,
			redirect: 'manual',
			headers: {
				'user-agent': USER_AGENT,
				'accept': 'text/html,application/xhtml+xml',
				'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
			},
		})

		if (REDIRECT_STATUS.has(response.status)) {
			const location = response.headers.get('location')
			await response.body?.cancel().catch(() => {})
			if (!location)
				return null
			const next = parseTarget(location, url.href)
			if (!next)
				return null
			url = next
			continue
		}

		if (!response.ok || !response.headers.get('content-type')?.includes('html')) {
			await response.body?.cancel().catch(() => {})
			return null
		}

		return { html: decodeHtml(await readCapped(response)), url }
	}

	return null
}

const META_RE = /<meta\s[^>]*>/gi
const KEY_RE = /(?:property|name)\s*=\s*["']([^"']+)["']/i
const CONTENT_RE = /content\s*=\s*["']([^"']*)["']/i
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i

/**
 * 扫 <head> 里的 meta 标签。
 *
 * 为四个格式固定的标签装一个 HTML 解析器不划算，正则够用。property 与 content
 * 的先后顺序各站写法不一，故两个属性各扫各的，不假设它们谁在前。
 * 同名标签取第一个 —— og 规范里首个 og:image 即主图。
 */
function parseMetaTags(html: string) {
	const head = html.split(/<\/head>/i)[0] ?? html
	const tags: Record<string, string> = {}

	for (const tag of head.match(META_RE) ?? []) {
		const key = tag.match(KEY_RE)?.[1]?.toLowerCase()
		const content = tag.match(CONTENT_RE)?.[1]
		if (key && content && !(key in tags))
			tags[key] = content
	}

	return { tags, title: head.match(TITLE_RE)?.[1] }
}

/** 数字实体先于命名实体，免得 &amp;#39; 这种被连着解两次 */
function decodeEntities(text: string) {
	return text
		.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
		.replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
		.replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, (_, name) => ({
			amp: '&',
			lt: '<',
			gt: '>',
			quot: '"',
			apos: '\'',
			nbsp: ' ',
		}[name.toLowerCase()] ?? _))
		.replace(/\s+/g, ' ')
		.trim()
}

/** 卡片上只放得下两行标题一行描述，截断是为了别让某个页面回一坨几十 KB 的文本 */
function clean(text: string | undefined, max: number) {
	if (!text)
		return undefined
	const decoded = decodeEntities(text)
	return decoded ? decoded.slice(0, max) : undefined
}

export default defineEventHandler(async (event) => {
	const { url: raw } = getQuery(event)

	if (typeof raw !== 'string' || !raw)
		throw createError({ statusCode: 400, statusMessage: '缺少 url 参数' })

	const target = parseTarget(raw)
	if (!target)
		throw createError({ statusCode: 400, statusMessage: 'url 必须是 http/https 且使用默认端口' })

	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

	// 超时、连接被拒、TLS 出错 —— 对读者而言都一样，卡片停在域名打底态即可
	const document = await fetchDocument(target, controller.signal).catch(() => null)
	clearTimeout(timer)

	if (!document) {
		// 失败也缓存，只是短一些：对方可能一时抽风，别为此锁死一整周
		setHeader(event, 'Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600')
		return {}
	}

	const { tags, title } = parseMetaTags(document.html)

	const image = tags['og:image'] || tags['twitter:image']
	const result = {
		title: clean(tags['og:title'] || tags['twitter:title'] || title, 200),
		description: clean(tags['og:description'] || tags['twitter:description'] || tags.description, 400),
		// og:image 允许写相对路径，得按跟完重定向后的最终地址来解析
		image: image ? toUrl(decodeEntities(image), document.url.href)?.href : undefined,
		siteName: clean(tags['og:site_name'], 100),
	}

	/**
	 * 一周。这条同时是防滥用的主力 —— 端点是公开的，谁都能拿它去抓任意 URL，
	 * 而有了 CDN 这一层，同一个链接一周之内只会真正落到函数上一次。
	 *
	 * 刻意不做 Referer 校验：那玩意儿挡不住 curl，却会误伤关掉 Referer 的正常访客。
	 * 真被人当爬虫代理了再加限制。
	 */
	setHeader(event, 'Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=86400')
	return result
})
