import { AnnouncementOptions } from 'vitepress-plugin-announcement'

export const popover: AnnouncementOptions = {
    title: '牛马摸鱼吹水交流',
    duration: -1,
    mobileMinify: true,
    body: [
        {
            type: 'image',
            src: 'https://blog-img.shinya.click/2025/6e93830772b20559f7cdf19525d9f809.png',
        },
        {
            type: 'text',
            content: '或 qq 搜索群号 970196516'
        }
    ]
}