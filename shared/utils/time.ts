import { Temporal } from 'temporal-polyfill'
import blogConfig from '~~/blog.config'

// isSameUnit 和 isTimeDiffSignificant 随「更新日期」一并删除 ——
// 它们存在的唯一目的就是判断 date 和 updated 差得够不够远、值不值得两个都显示

// shared/ 下拿不到 useI18n()，单位文案交给调用方的 t 传进来；
// key 对应 i18n/locales/*.ts 的 widget.blogStats.units.*
type Translate = (key: string, named?: Record<string, string | number>, plural?: number) => string

const timeIntervals = [
	{ key: 'widget.blogStats.units.century', threshold: 60 * 60 * 24 * 365.2422 * 100 },
	{ key: 'widget.blogStats.units.year', threshold: 60 * 60 * 24 * 365.2422 },
	{ key: 'widget.blogStats.units.month', threshold: 60 * 60 * 24 * 30.44 },
	{ key: 'widget.blogStats.units.day', threshold: 60 * 60 * 24 },
	{ key: 'widget.blogStats.units.hour', threshold: 60 * 60 },
	{ key: 'widget.blogStats.units.minute', threshold: 60 },
	{ key: 'widget.blogStats.units.second', threshold: 1 },
]

// 部件本身用 t() 按当前语言翻译，但拼接方式不能写死成中文的无缝拼接——
// 英文要用空格分隔（"4 years 9 months"），中日又不能有可见的分隔符
// （"4年9个月"/"4年9か月"）。三种语言各自的间隔符交给 Intl.ListFormat
// 的 narrow + unit 风格判定，不在词条表里存一份「联结符」
// （中/日的联结符是空字符串，会被 parity.test.ts 的空词条检查拒绝）。
export function timeElapse(date: string | Temporal.PlainDateTime, t: Translate, locale: string = blogConfig.language, maxDepth = 2) {
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
	return parts.length ? new Intl.ListFormat(locale, { style: 'narrow', type: 'unit' }).format(parts) : t('widget.blogStats.justNow')
}

export function toInstantString(date: string | Temporal.ZonedDateTime) {
	return (typeof date === 'string' ? toZonedTemporal(date) : date).toInstant().toString()
}

export function toZonedTemporal(date: string) {
	try {
		return Temporal.ZonedDateTime.from(date)
	}
	catch {
		try {
			return Temporal.Instant.from(date).toZonedDateTimeISO(blogConfig.timeZone)
		}
		catch {
			return Temporal.PlainDateTime.from(date).toZonedDateTime(blogConfig.timeZone)
		}
	}
}

export const dateTimeFormat = {
	date: {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	},
	monthDay: {
		month: '2-digit',
		day: '2-digit',
	},
	full: {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		weekday: 'long',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		timeZoneName: 'long',
	},
} satisfies Record<string, Intl.DateTimeFormatOptions>

export type dateTimeFormatOptions = keyof typeof dateTimeFormat | Intl.DateTimeFormatOptions

// locale 不能留空：留空会跟着浏览器的 Accept-Language 走，同一个时间在
// 英文浏览器里变成「07/13/2026」，与页面本身的语言对不上。shared/ 下拿不到
// useI18n()，故调用方（组件）负责把当前语言传进来；不传时退回站点默认语言，
// 兜住 shared/ 内部或还没接上 i18n 的调用点。
export function toZdtLocaleString(date: string | Temporal.ZonedDateTime, format: dateTimeFormatOptions = 'full', locale: string = blogConfig.language) {
	return (typeof date === 'string' ? toZonedTemporal(date) : date)
		.toLocaleString(locale, typeof format === 'string' ? dateTimeFormat[format] : format)
}
