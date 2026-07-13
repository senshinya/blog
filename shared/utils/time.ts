import { Temporal } from 'temporal-polyfill'
import blogConfig from '~~/blog.config'

// isSameUnit 和 isTimeDiffSignificant 随「更新日期」一并删除 ——
// 它们存在的唯一目的就是判断 date 和 updated 差得够不够远、值不值得两个都显示

const timeIntervals = [
	{ label: '世纪', threshold: 60 * 60 * 24 * 365.2422 * 100 },
	{ label: '年', threshold: 60 * 60 * 24 * 365.2422 },
	{ label: '个月', threshold: 60 * 60 * 24 * 30.44 },
	{ label: '天', threshold: 60 * 60 * 24 },
	{ label: '小时', threshold: 60 * 60 },
	{ label: '分', threshold: 60 },
	{ label: '秒', threshold: 1 },
]

export function timeElapse(date: string | Temporal.PlainDateTime, maxDepth = 2) {
	let timeString = ''
	let secRemained = Temporal.Now.plainDateTimeISO().since(date, { largestUnit: 'second' }).seconds
	for (const interval of timeIntervals) {
		const count = Math.floor(secRemained / interval.threshold)
		if (count <= 0)
			continue
		timeString += `${count}${interval.label}`
		secRemained -= count * interval.threshold
		if (--maxDepth <= 0)
			break
	}
	return timeString || '刚刚'
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

export function toZdtLocaleString(date: string | Temporal.ZonedDateTime, format: dateTimeFormatOptions = 'full') {
	return (typeof date === 'string' ? toZonedTemporal(date) : date)
		.toLocaleString(undefined, typeof format === 'string' ? dateTimeFormat[format] : format)
}
