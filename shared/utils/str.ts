import { toArray } from '@vueuse/core'
import { escape, escapeRegExp } from 'es-toolkit/string'

// @keep-sorted
const promptLanguageMap: Record<string, string> = {
	'#': 'sh',
	'$': 'sh',
	'CMD': 'bat',
	'PS': 'powershell',
}

/**
 * 大数字缩写。原先手写了一张万/亿/万亿换算表，但那是简体中文专用的单位——
 * 日语的「亿」要写成「億」、「万亿」要写成「兆」，英文则完全是另一套（K/M/B/T），
 * 复用中文表在非中文页面上要么是错别字要么是简体中文本身。日文、英文改用
 * Intl.NumberFormat 的 compact notation：单位从 CLDR 数据按 locale 出，两种语言
 * 各自地道，也不用再手写这两份表。
 *
 * 中文分支特意没有一起改掉，是实测出来的结果，不是偷懒：Intl 的 compact notation
 * 四舍五入到两位小数后会去掉末尾的 0（21012 -> "2.1万"），而旧实现固定
 * toFixed(2)（"2.10万"）。逐年字数统计里真实存在这种整十的巧合值，一旦切换，
 * 已经上线的中文页面文本会跟着变——中文页面必须逐字节不变是本次改动的硬约束，
 * 优先级高于「都用 Intl」这个理想实现，所以中文分支原样保留旧的
 * 阈值 + toFixed(2) 算法（连同原先那张只服务中文的换算表）。
 *
 * shared/ 下拿不到 useI18n()，locale 交给调用方显式传入（同 timeElapse()），
 * 不给兜底默认值——唯一称得上合理的默认值要读 blogConfig.language，而那是
 * Nuxt 别名 '~~/blog.config'，纯 node:test 一 import 就炸，参见 shared/utils/time.ts
 * 顶部注释；不给默认值也顺带杜绝了调用方漏传 locale 却看起来仍然「正常」的情况。
 */
export function formatNumber(num: number | undefined, locale: string) {
	if (typeof num !== 'number')
		return ''
	if (locale.startsWith('zh')) {
		const intervals = [
			{ label: '万亿', threshold: 1e12 },
			{ label: '亿', threshold: 1e8 },
			{ label: '万', threshold: 1e4 },
		]
		for (const interval of intervals) {
			if (num >= interval.threshold)
				return `${(num / interval.threshold).toFixed(2)}${interval.label}`
		}
		return num.toString()
	}
	return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 2 }).format(num)
}

interface FormatBytesOptions {
	decimals?: number
	binary?: boolean
	unitSeparator?: string
}

export function formatBytes(bytes: number, options: FormatBytesOptions = {}) {
	const {
		decimals = 2,
		binary = true,
		unitSeparator = ' ',
	} = options

	if (bytes === 0)
		return `0${unitSeparator}Bytes`

	const base = binary ? 1024 : 1000
	const units = binary
		? ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']
		: ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

	const i = Math.floor(Math.log(bytes) / Math.log(base))
	const value = Number.parseFloat((bytes / base ** i).toFixed(decimals))

	return `${value}${unitSeparator}${units[i]}`
}

export function getPromptLanguage(prompt: string | boolean) {
	if (typeof prompt === 'boolean')
		return 'text'
	for (const promptPrefix in promptLanguageMap) {
		if (prompt.startsWith(promptPrefix))
			return promptLanguageMap[promptPrefix] ?? 'text'
	}
	return 'text'
}

export function joinWith(strings: (string | undefined)[], separator = '\n') {
	return strings.filter(Boolean).join(separator)
}

export function highlightHtml(text: string, words: string | string[] | undefined, className?: string) {
	const validTerms = toArray(words)
		.filter((t): t is string => !!t?.trim())
		.map(t => t.toLowerCase())

	const highlightRegex = new RegExp(`(${Array.from(validTerms, escapeRegExp).join('|')})`, 'gi')

	return text
		.split(highlightRegex)
		.map(part => part && validTerms.includes(part.toLowerCase())
			? `<mark${className ? ` class="${className}"` : ''}>${escape(part)}</mark>`
			: escape(part))
		.join('')
		.replace(/\n+/g, '<br>')
}

export function removeHtmlTags(str?: string) {
	if (typeof str !== 'string')
		return ''
	return str.replace(/<[^>]+(>|$)/g, '')
}
