import type { FeedGroup } from '../app/types/feed'
// 友链检测 CLI 需要使用显式导入和相对路径
import { myFeed } from '../blog.config'
import { getFavicon } from './utils/img'

export default [
	{
		name: '友链',
		entries: [
			myFeed,
			{
				author: 'Oliver Chen',
				desc: '互联网新星',
				link: 'https://oliverchen12.github.io',
				avatar: 'https://blog-img.774352199.xyz/2024/5e107c1356d8cd90f1b98d170368c2df.jpg',
				icon: getFavicon('https://oliverchen12.github.io'),
			},
			{
				author: 'Sun Yushuo',
				desc: '风雨湿征衣',
				link: 'https://yyd-piren.github.io',
				avatar: 'https://blog-img.774352199.xyz/2024/a63e3e016fdaf653fde08969916830eb.JPG',
				icon: getFavicon('https://yyd-piren.github.io'),
			},
			{
				author: '子行',
				desc: '往日痕迹',
				link: 'https://www.cnblogs.com/fallingdust',
				avatar: 'https://blog-img.774352199.xyz/2024/9387729ab1b3f7f1c9a7c644d306c851.PNG',
				icon: getFavicon('https://www.cnblogs.com/fallingdust'),
			},
			{
				author: 'Ancy',
				desc: 'Coding with love!',
				link: 'https://anxcye.com',
				avatar: 'https://avatars.githubusercontent.com/u/91717732',
				icon: getFavicon('https://anxcye.com'),
			},
			{
				author: 'Zwei',
				desc: '人生如白驹过隙，历史似长河永流',
				link: 'https://zwei.de.eu.org',
				avatar: 'https://avatars.githubusercontent.com/u/110226580?v=4',
				icon: getFavicon('https://zwei.de.eu.org'),
			},
			{
				author: 'Windomoi',
				desc: '关于 AI、HVAC 与思考的数字花园',
				link: 'https://windomoi.com',
				avatar: 'https://image.windomoi.com/images/2026/05/web-app-manifest-512x512-39607f7704e056579f0a44802f3c22b7.png',
				icon: getFavicon('https://windomoi.com'),
			},
		],
	},
] satisfies FeedGroup[]
