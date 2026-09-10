import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Vitest is not a project dependency; use Node's built-in runner.
import test from 'node:test'
import { formatNumber } from './str.ts'

// 表驱动：中文走的是原样保留的旧算法（阈值 + toFixed(2)，固定两位小数），
// 日文、英文走 Intl compact notation（不强制补零）。三者不应该互相串味：
// 日文要出 億/兆 而不是中文的 亿/万亿，英文要出 K/M/B/T。
const cases: {
	name: string
	num: number
	expected: Record<'zh-CN' | 'en-US' | 'ja-JP', string>
}[] = [
	{
		name: 'below the smallest compact threshold stays a plain number',
		num: 9999,
		expected: { 'zh-CN': '9999', 'en-US': '10K', 'ja-JP': '9999' },
	},
	{
		name: '万 / K / 万 boundary',
		num: 89_800,
		expected: { 'zh-CN': '8.98万', 'en-US': '89.8K', 'ja-JP': '8.98万' },
	},
	{
		name: '亿 / M / 億 —— 中文固定两位小数补零，日英两个 Intl locale 不补',
		num: 150_000_000,
		expected: { 'zh-CN': '1.50亿', 'en-US': '150M', 'ja-JP': '1.5億' },
	},
	{
		name: '万亿 / T / 兆 —— 日文不应该沿用简体中文的「万亿」',
		num: 1_500_000_000_000,
		expected: { 'zh-CN': '1.50万亿', 'en-US': '1.5T', 'ja-JP': '1.5兆' },
	},
]

for (const c of cases) {
	for (const locale of ['zh-CN', 'en-US', 'ja-JP'] as const) {
		test(`formatNumber: ${c.name} (${locale})`, () => {
			assert.equal(formatNumber(c.num, locale), c.expected[locale])
		})
	}
}

test('formatNumber: non-number input returns an empty string, not "undefined"', () => {
	assert.equal(formatNumber(undefined, 'zh-CN'), '')
})

test('formatNumber: zh keeps the historical forced two-decimal trailing zero', () => {
	// 中文页面的输出必须和旧实现逐字节一致：10000 -> "1.00万"，不能因为改用 Intl
	// 就变成 "1万"。这条锁住这个行为，避免以后有人顺手把中文分支也换成纯 Intl。
	assert.equal(formatNumber(10_000, 'zh-CN'), '1.00万')
})

test('formatNumber: en/ja use natural Intl compact formatting, no forced trailing zero', () => {
	// 同一个整万的数字，日英两个 locale 走 Intl，不强制两位小数，
	// 与上面中文分支的固定两位小数行为形成对照。
	assert.equal(formatNumber(10_000, 'en-US'), '10K')
	assert.equal(formatNumber(10_000, 'ja-JP'), '1万')
})
