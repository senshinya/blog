import { Temporal } from 'temporal-polyfill'

// shared/ 下拿不到 useI18n()，单位文案交给调用方的 t 传进来；
// key 对应 i18n/locales/*.ts 的 time.units.*
type Translate = (key: string, named?: Record<string, string | number>, plural?: number) => string

// 独立成单文件、不跟 toZdtLocaleString 们放在 time.ts：那边的 toZonedTemporal
// 要读 blogConfig.timeZone，静态 import '~~/blog.config' 是 Nuxt 别名，
// 只有走 Vite/Nuxt 构建才解析得了。这个文件不碰 blogConfig，
// 才能被 shared/utils/timeElapse.test.ts 用纯 node:test 直接 import 验证。
const timeIntervals = [
	{ key: 'time.units.century', threshold: 60 * 60 * 24 * 365.2422 * 100 },
	{ key: 'time.units.year', threshold: 60 * 60 * 24 * 365.2422 },
	{ key: 'time.units.month', threshold: 60 * 60 * 24 * 30.44 },
	{ key: 'time.units.day', threshold: 60 * 60 * 24 },
	{ key: 'time.units.hour', threshold: 60 * 60 },
	{ key: 'time.units.minute', threshold: 60 },
	{ key: 'time.units.second', threshold: 1 },
]

// 部件本身用 t() 按当前语言翻译，但拼接方式不能写死成中文的无缝拼接——
// 英文要用空格分隔（"4 years 9 months"），中日又不能有可见的分隔符
// （"4年9个月"/"4年9か月"）。三种语言各自的间隔符交给 Intl.ListFormat
// 的 narrow + unit 风格判定，不在词条表里存一份「联结符」
// （中/日的联结符是空字符串，会被 parity.test.ts 的空词条检查拒绝）。
//
// locale 不给默认值：这个函数唯一的调用方（BlogStats.vue）永远显式传当前语言，
// 给个假的兜底值只会掩盖漏传，参见 timeElapse.test.ts。
export function timeElapse(date: string | Temporal.PlainDateTime, t: Translate, locale: string, maxDepth = 2) {
	const parts: string[] = []
	let secRemained = Temporal.Now.plainDateTimeISO().since(date, { largestUnit: 'second' }).seconds
	for (const interval of timeIntervals) {
		const count = Math.floor(secRemained / interval.threshold)
		if (count <= 0)
			continue
		parts.push(t(interval.key, { n: count }, count))
		secRemained -= count * interval.threshold
		if (--maxDepth <= 0)
			break
	}
	return parts.length ? new Intl.ListFormat(locale, { style: 'narrow', type: 'unit' }).format(parts) : t('time.justNow')
}
