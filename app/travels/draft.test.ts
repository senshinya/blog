import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Vitest is not a project dependency; use Node's built-in runner.
import test from 'node:test'

test('recognizes a top-level YAML draft flag', async () => {
	const { isTravelDraftSource } = await import('./draft.ts')

	assert.equal(isTravelDraftSource('slug: korea-202510\ndraft: true\ntitle: 南韩\n'), true)
})

test('ignores values that are not a top-level boolean draft flag', async () => {
	const { isTravelDraftSource } = await import('./draft.ts')

	assert.equal(isTravelDraftSource('draft: false\n'), false)
	assert.equal(isTravelDraftSource('draft: "true"\n'), false)
	assert.equal(isTravelDraftSource('metadata:\n  draft: true\n'), false)
})

test('removes draft travels outside development', async () => {
	const { getVisibleTravels } = await import('./draft.ts')
	const travels = [
		{ slug: 'korea-202510', draft: true },
		{ slug: 'kansai-202504' },
	]

	assert.deepEqual(getVisibleTravels(travels, false), [travels[1]])
})

test('keeps draft travels in development', async () => {
	const { getVisibleTravels } = await import('./draft.ts')
	const travels = [
		{ slug: 'korea-202510', draft: true },
		{ slug: 'kansai-202504' },
	]

	assert.deepEqual(getVisibleTravels(travels, true), travels)
})

/**
 * 两处草稿判断必须给出同一个结论。
 *
 * 清单扫描器读 YAML 原文（构建期，Node 里跑，不引依赖），注册表读解析后的字段
 * （运行期）。若两者分歧，扫描器判「发布」而注册表判「草稿」会让路由被预渲染、
 * 数据却取不到，构建产物里烙进一个 404 页面。
 *
 * parsed 一列是 yaml 2.8.4（unplugin-yaml 实际使用的版本）对该写法的解析结果，
 * 已实测确认。这里不 import yaml：它只是间接依赖，测试里引它等于夹带未声明依赖。
 */
test('both draft checks classify every YAML spelling the same way', async () => {
	const { isTravelDraftSource, getVisibleTravels } = await import('./draft.ts')

	const cases: { source: string, parsed: unknown, draft: boolean }[] = [
		{ source: 'draft: true', parsed: true, draft: true },
		{ source: 'draft: True', parsed: true, draft: true },
		{ source: 'draft: TRUE', parsed: true, draft: true },
		{ source: 'draft: false', parsed: false, draft: false },
		{ source: 'draft: "true"', parsed: 'true', draft: false },
		{ source: 'draft: "false"', parsed: 'false', draft: false },
		{ source: 'draft: yes', parsed: 'yes', draft: false },
		{ source: 'metadata:\n  draft: true', parsed: undefined, draft: false },
	]

	for (const { source, parsed, draft } of cases) {
		assert.equal(isTravelDraftSource(source), draft, `原文判断：${JSON.stringify(source)}`)

		const travels = [{ slug: 'x', draft: parsed as boolean | undefined }]
		const hidden = getVisibleTravels(travels, false).length === 0
		assert.equal(hidden, draft, `解析后判断：${JSON.stringify(source)}`)
	}
})
