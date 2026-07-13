import type { Travel } from '~/types/travel'
import kansai from './kansai-202504.yaml'

/**
 * 游记注册表。新增一篇：放一个 <slug>.yaml 进来，再在此处 import + 登记。
 *
 * 文件名必须等于 slug —— nuxt.config 的预渲染路由是从文件名推出来的
 * （加载 nuxt.config 的 jiti 读不了 yaml，配置期只能看目录）。真忘了在此登记，
 * 那条路由会在构建时以 404 炸出来，不会静默漏掉。
 *
 * unplugin-yaml 把 *.yaml 声明为 Record<string, unknown>，故需断言。
 */
const travels = [
	kansai,
] as unknown as Travel[]

export default travels.toSorted((a, b) => b.published.localeCompare(a.published))

export function getTravelBySlug(slug: string) {
	return travels.find(travel => travel.slug === slug)
}
