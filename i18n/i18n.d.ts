import type { MessageSchema } from './locales/zh'

/**
 * 这是 vue-i18n 文档给出的标准增广写法，但目前并不会让 $t() 的 key 参数
 * 被类型检查约束：vue-i18n 自带的 DefineLocaleMessage 带有一个字符串索引签名，
 * 一旦把具名属性合并进一个带索引签名的接口，keyof 就会塌缩成 string ——
 * 结果是 $t('nav.archiv') 这种拼错的 key 依然能通过类型检查，不会报错。
 * 保留这段增广是因为它是官方推荐写法，一旦上游修掉这个 keyof 塌缩问题，
 * 这里会自动开始生效，不需要额外改动。
 * 眼下真正能防住键名问题的是两处：写 en.ts / ja.ts 时 MessageSchema 会在
 * 漏键或拼错键时报类型错误；以及 i18n/locales/parity.test.ts 里的键名对齐测试。
 * 开发期运行时的兜底见 app/plugins/i18n-missing.client.ts。
 */
declare module 'vue-i18n' {
	export interface DefineLocaleMessage extends MessageSchema {}
}

export {}
