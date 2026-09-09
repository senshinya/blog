/**
 * 中文是词条的唯一真源。不写 as const —— 值需要推断成 string，
 * 否则 MessageSchema 会退化成字面量类型，另外两种语言无法满足。
 */
const zh = {
	lang: { unavailable: '该页暂无此语言版本' },
}

export default zh
export type MessageSchema = typeof zh
