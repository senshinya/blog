import type { MessageSchema } from './locales/zh'

declare module 'vue-i18n' {
	export interface DefineLocaleMessage extends MessageSchema {}
}

export {}
