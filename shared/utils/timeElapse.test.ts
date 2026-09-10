import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Vitest is not a project dependency; use Node's built-in runner.
import test from 'node:test'
import { Temporal } from 'temporal-polyfill'

// 用 node:test 内置的 mock，而不是纯拼接字符串的假 t()：真正要守住的是
// vue-i18n 的复数选择协议——count 必须原样透传成 t() 的第三个参数，漏传
// 这个参数会让英文词条表 '{n} year | {n} years' 永远选中同一种形态。
// 断言必须落在调用参数上，落在返回值上测不出「忘记传第三个参数」这种错误
// （只要 named.n 还在，拼出来的字符串看着仍然「正确」）。
function stubTranslate() {
	return (key: string, named?: Record<string, string | number>, plural?: number) =>
		plural === undefined ? key : `${named!.n}:${key}`
}

// 表驱动：每一条只改「多久以前」和 maxDepth，断言 timeElapse 传给 t() 的
// 每一次调用参数，以及 Intl.ListFormat 拼接后的最终字符串。
// 时间差都选在阈值内侧留出安全余量的整数点上，避免年/月这类浮点阈值
// （365.2422 天、30.44 天）造成的边界抖动。
const cases: {
	name: string
	secondsAgo: number
	maxDepth?: number
	expectedResult: string
	expectedCalls: unknown[][]
}[] = [
	{
		name: 'two-unit span (day + hour)',
		secondsAgo: 3 * 86400 + 4 * 3600,
		expectedResult: '3:time.units.day 4:time.units.hour',
		expectedCalls: [
			['time.units.day', { n: 3 }, 3],
			['time.units.hour', { n: 4 }, 4],
		],
	},
	{
		name: 'one-unit span (minutes only)',
		secondsAgo: 5 * 60,
		expectedResult: '5:time.units.minute',
		expectedCalls: [
			['time.units.minute', { n: 5 }, 5],
		],
	},
	{
		name: 'maxDepth = 1 truncates to the largest unit only',
		secondsAgo: 3 * 86400 + 4 * 3600,
		maxDepth: 1,
		expectedResult: '3:time.units.day',
		expectedCalls: [
			['time.units.day', { n: 3 }, 3],
		],
	},
	{
		name: 'no unit has elapsed falls back to the justNow key',
		secondsAgo: 0,
		expectedResult: 'time.justNow',
		expectedCalls: [
			['time.justNow'],
		],
	},
]

for (const c of cases) {
	test(`timeElapse: ${c.name}`, async (t) => {
		const { timeElapse } = await import('./timeElapse.ts')
		const mockT = t.mock.fn(stubTranslate())
		const date = Temporal.Now.plainDateTimeISO().subtract({ seconds: c.secondsAgo })

		const result = c.maxDepth === undefined
			? timeElapse(date, mockT, 'en-US')
			: timeElapse(date, mockT, 'en-US', c.maxDepth)

		assert.equal(result, c.expectedResult)
		assert.deepEqual(mockT.mock.calls.map(call => call.arguments), c.expectedCalls)
	})
}

test('timeElapse: n = 1 selects the English singular form, not "1 years"', async () => {
	const { timeElapse } = await import('./timeElapse.ts')
	// 复现 vue-i18n 管道复数语法的选择规则：如果 timeElapse 忘记把 count
	// 当第三个参数传给 t()，plural 恒为 undefined，下面永远落到 pluralForm，
	// "1 year" 就会被错误渲染成 "1 years"。
	const pluralTranslate = (key: string, named?: Record<string, string | number>, plural?: number) => {
		const forms: Record<string, string> = { 'time.units.year': '{n} year | {n} years' }
		const [singular, pluralForm] = forms[key]!.split(' | ')
		const form = plural === 1 ? singular! : pluralForm!
		return form.replace('{n}', String(named!.n))
	}
	// 比一年阈值（365.2422 天）多出整整一小时的余量，且用 maxDepth 1 只取年这一档，
	// 避免余下的一小时被当成第二个单位拼进结果里
	const secondsAgo = Math.ceil(60 * 60 * 24 * 365.2422) + 3600
	const date = Temporal.Now.plainDateTimeISO().subtract({ seconds: secondsAgo })

	const result = timeElapse(date, pluralTranslate, 'en-US', 1)

	assert.equal(result, '1 year')
})
