import { Temporal } from 'temporal-polyfill'
import blogConfig from '~~/blog.config'

// isSameUnit 和 isTimeDiffSignificant 随「更新日期」一并删除 ——
// 它们存在的唯一目的就是判断 date 和 updated 差得够不够远、值不值得两个都显示

// timeElapse() 搬去了同目录下的 timeElapse.ts：它不需要 blogConfig，
// 独立出来才能被 node:test 直接 import 验证（这个文件的 toZonedTemporal
// 要用到下面的 blogConfig.timeZone，这里的 '~~/blog.config' 是 Nuxt 别名，
// 只有 Vite/Nuxt 构建才解析得了，纯 node:test 引这个文件必炸）。

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
