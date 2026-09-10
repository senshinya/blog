/**
 * 构建期从 YAML 原文判断草稿：清单扫描器在 Node 里跑，不引入 YAML 解析器。
 *
 * 大小写三种写法都认，因为 YAML 1.2 的 core schema 把 true/True/TRUE 一律
 * 解析成布尔真 —— 只认小写会让 `draft: True` 在这里判为「非草稿」而在
 * getVisibleTravels 那边判为「草稿」，两边分歧的结果是路由被预渲染、数据却
 * 取不到，构建产物里烙进一个 404 页面。加引号的 "true" 不算，那是字符串。
 */
export function isTravelDraftSource(source: string) {
	return /^draft:[ \t]*(?:true|True|TRUE)[ \t]*(?:#.*)?\r?$/m.test(source)
}

/**
 * 运行期按解析后的字段过滤。用 `=== true` 而不是真值判断：Travel 的 draft
 * 声明就是 boolean，而 `draft: "false"` 这种写法解析出来是非空字符串，真值
 * 判断会把它当成草稿藏起来，与上面只认布尔真的判断分歧。两处语义必须一致，
 * 见 draft.test.ts 里的一致性用例。
 */
export function getVisibleTravels<T extends { draft?: boolean }>(travels: T[], isDev: boolean) {
	return isDev ? travels : travels.filter(travel => travel.draft !== true)
}
