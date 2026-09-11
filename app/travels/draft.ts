/**
 * 运行期按解析后的字段过滤。用 `=== true` 而不是真值判断：Travel 的 draft
 * 声明就是 boolean，而 `draft: "false"` 这种写法解析出来是非空字符串，真值
 * 判断会把它当成草稿藏起来，与构建期 YAML 解析判断分歧。两处语义必须一致，
 * 见 draft.test.ts 里的一致性用例。
 */
export function getVisibleTravels<T extends { draft?: boolean }>(travels: T[], isDev: boolean) {
	return isDev ? travels : travels.filter(travel => travel.draft !== true)
}
