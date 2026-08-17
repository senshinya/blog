import type { Travel } from '~/types/travel'
import { getVisibleTravels } from './draft'
import kansai from './kansai-202504.yaml'
import korea from './korea-202510.yaml'

/**
 * 游记注册表。新增一篇：放一个 <slug>.yaml 进来，再在此处 import + 登记。
 *
 * 文件名必须等于 slug —— nuxt.config 的预渲染路由是从文件名推出来的，
 * 并通过读取文本中的顶层 `draft: true` 排除草稿。真忘了在此登记，
 * 非草稿路由会在构建时以 404 炸出来，不会静默漏掉。
 *
 * unplugin-yaml 把 *.yaml 声明为 Record<string, unknown>，故需断言。
 */
const allTravels = [
	korea,
	kansai,
] as unknown as Travel[]

const travels = getVisibleTravels(allTravels, import.meta.dev)

export default travels.toSorted((a, b) => b.published.localeCompare(a.published))

export function getTravelBySlug(slug: string) {
	return travels.find(travel => travel.slug === slug)
}
