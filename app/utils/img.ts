import imageMeta from '~/assets/image-meta.json'

/**
 * 图床所在的 zone。只有它开了 Cloudflare Images Transformations，
 * 别处的图走不了 /cdn-cgi/image/，得原样返回。
 */
const CF_IMG_HOST = 'https://blog-img.774352199.xyz'

export interface ImgMeta {
	/** 原始宽度 */
	w: number
	/** 原始高度 */
	h: number
	/** 三个主色打包成的 8 位十六进制，见 assets/css/lqip.css */
	lqip: string
}

/** 由 scripts/gen-image-meta.ts 预生成。SVG 和站外图不在其中，取不到就是 undefined */
const META = imageMeta as Record<string, ImgMeta>

export const getImgMeta = (src: string): ImgMeta | undefined => META[src]

/**
 * LQIP 内联样式：`{ '--lqip': '#986cc921' }`。
 *
 * 光有这个还不够 —— 它画的是元素的 background，元素得先有尺寸，梯度才有地方画。
 * 所以调用处务必同时把 getImgMeta() 的 w/h 作为 width/height 属性写上去，
 * 否则图仍会在加载完成的那一刻把下文顶开（这才是 CLS 的来源，LQIP 本身修不了）。
 */
export function getLqipStyle(src: string) {
	const meta = META[src]
	return meta ? { '--lqip': `#${meta.lqip}` } : undefined
}

/**
 * 走 Cloudflare Images Transformations 取一个指定宽度的变体。
 *
 * 图床上放的是原片：游记是相机直出（最大 4284×5712 / 24.5 MP），正文里也有 6016×3384 的截图。
 * 解码耗时按**源像素数**算，不按文件大小算 —— 一张 24.5 MP 的图解码成位图是 93 MB，
 * 而它要画的可能只是个 208px 的格子。
 *
 * 变换在图床那个 zone 的边缘完成，跟博客部署在哪无关，故不走 @nuxt/image
 * （它的 provider 在 Netlify 下被整个关掉了，见 nuxt.config.ts）。
 *
 * 默认 fit 是 scale-down，小图不会被放大 —— 正文里那些本来就只有 1024 宽的截图，
 * 请求 1600 也只会原样返回。
 *
 * 计费按「唯一变换」= 图片 × 参数组合，同月重复只算一次，免费额度 5000/月。
 * 所以宽度要收敛到少数几档，别按容器像素随手生成。
 */
export function getCfImgUrl(src: string, width: number) {
	if (!src.startsWith(CF_IMG_HOST))
		return src

	return `${CF_IMG_HOST}/cdn-cgi/image/width=${width},format=auto${src.slice(CF_IMG_HOST.length)}`
}

// @keep-sorted
const services = {
	baidu: 'https://image.baidu.com/search/down?url=',
	/** https://webp.se/fly/ */
	fly: 'https://fly.webp.se/?url=',
	/** https://wsrv.nl/docs/ */
	weserv: 'https://wsrv.nl/?url=',
}

export type ImgService = keyof typeof services | boolean

// https://wsrv.nl/docs/quick-reference.html
export function getWsrvGhAvatar(name = '', options: Record<string, any> = { size: 92 }) {
	const srcUrl = `github.com/${name}.png?size=${options.size}`
	delete options.size

	const params = new URLSearchParams(srcUrl)
	Object.entries(options).forEach(([key, value]) => params.set(key, value))
	return services.weserv + params.toString()
}

// https://docs.webp.se/public-services/github-avatar/
export function getGithubAvatar(name = '', options = { size: 120 }) {
	return `https://avatars-githubusercontent-webp.webp.se/${name}?s=${options.size}`
}

export const getGithubIcon = (name = '') => getWsrvGhAvatar(name, { size: 32, mask: 'circle' })

export enum OicqAvatarSize {
	Size1080,
	Size40,
	Size40_,
	Size100,
	Size140,
	Size640,
	Size40__ = 40,
	Size100_ = 100,
	Size640_ = 640,
}

// https://users.qzone.qq.com/fcg-bin/cgi_get_portrait.fcg?uins=
export function getOicqAvatar(qq = '', size = OicqAvatarSize.Size140) {
	return `https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=${size}`
}

export enum QgroupAvatarSize {
	Size640,
	Size100 = 100,
	Size640_ = 640,
}

export function getOciqGroupAvatar(group = '', size = QgroupAvatarSize.Size100) {
	return `https://p.qlogo.cn/gh/${group}/${group}/${size}/`
}

interface FaviconOptions {
	provider?: 'google' | 'duckduckgo' | 'microlink'
	size?: number
}

// https://github.com/microlinkhq/unavatar
// https://docs.webp.se/public-services/unavatar/
export function getFavicon(domain: string, options?: FaviconOptions) {
	const { provider = 'google', size = 32 } = options || {}
	return `https://unavatar.webp.se/${provider}/${domain}?w=${size}`
}

export function getImgUrl(src: string, service?: ImgService | true) {
	if (!service)
		return src
	if (service === true)
		service = 'fly'
	if (service in services)
		return services[service] + src
	return src
}
