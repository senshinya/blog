import type { MessageSchema } from './zh'

const en: MessageSchema = {
	lang: { unavailable: 'Not available in this language yet' },
	nav: {
		articles: 'Posts',
		travels: 'Travels',
		memos: 'Memos',
		media: 'Media',
		archive: 'Archive',
		friends: 'Friends',
		skipToContent: 'Skip to content',
	},
	sidebar: {
		search: 'Search',
		toggleAside: 'Toggle sidebar',
		toggleMenu: 'Toggle menu',
		theme: {
			light: 'Light mode',
			system: 'System',
			dark: 'Dark mode',
		},
	},
	footer: {
		explore: 'Explore',
		social: 'Social',
		info: 'Info',
		atom: 'Atom feed',
		travellings: 'Travellings',
		travellingsTip: 'Travellings - Next Blog',
		theme: 'Theme: {name} {version}',
	},
}

export default en
