import type { MessageSchema } from './zh'

const ja: MessageSchema = {
	lang: { unavailable: 'この言語版はまだありません' },
	nav: {
		articles: '記事',
		travels: '旅行記',
		memos: 'つぶやき',
		media: 'エンタメ',
		archive: 'アーカイブ',
		friends: 'リンク集',
		skipToContent: 'コンテンツへスキップ',
	},
	sidebar: {
		search: '検索',
		toggleAside: 'サイドバー切替',
		toggleMenu: 'メニュー切替',
		theme: {
			light: 'ライトモード',
			system: 'システム',
			dark: 'ダークモード',
		},
	},
	footer: {
		explore: '探索',
		social: 'SNS',
		info: '情報',
		atom: 'Atomフィード',
		travellings: 'Travellings',
		travellingsTip: 'Travellings - 次のブログへ',
		theme: 'テーマ: {name} {version}',
	},
}

export default ja
