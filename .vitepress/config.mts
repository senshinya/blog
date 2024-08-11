import { defineConfig } from 'vitepress'
import { metaData } from './config/metadata'
import { head } from './config/head'
import { nav } from './config/nav'
import { sidebar } from './config/sidebar'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: metaData.title,
  description: metaData.description,
  lang: metaData.lang,
  head: head,

  // 最后更新时间
  lastUpdated: true,

  // 简洁的url
  cleanUrls: true,

  // 输出目录
  outDir: './dist',

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: nav,

    sidebar: sidebar,

    outline: {
      label: '页面导航',
      level: 'deep'
    },

    editLink: {
      pattern: 'https://github.com/senshinya/blog/edit/main/:path',
      text: '不妥之处，敬请雅正'
    },

    lastUpdated: {
      text: '最后更新于',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'medium'
      }
    },

    docFooter: {
      prev: '上一篇',
      next: '下一篇'
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/senshinya' }
    ],

    footer: {
      message: '如有转载或 CV 请标注本站原文地址',
      copyright: 'Copyright © 2017-2024 信也のブログ | <a href="https://icp.gov.moe/?keyword=20248008" target="_blank" rel="nofollow noopener" style="text-decoration: none;">萌ICP备20248008号</a>'
    },

    // @ts-ignore
    articleMetadataConfig: {
      author: '信也', // 文章全局默认作者名称
      authorLink: '/shinya', // 点击作者名时默认跳转的链接
    },

    // 自定义扩展: 文章版权配置
    copyrightConfig: {
      license: '署名-相同方式共享 4.0 国际 (CC BY-SA 4.0)',
      licenseLink: 'https://creativecommons.org/licenses/by/4.0/legalcode.zh-hans'
    },
  },

  rewrites: {
    'posts/:categorie/:type/index.md': ':categorie/:type.md',
    'posts/:categorie/:type/:file.md': ':categorie/:type/:file.md',
    'posts/:categorie/index.md': ':categorie.md',
    'posts/:categorie/:file.md': ':categorie/:file.md',
    'pages/:categorie/index.md': ':categorie.md'
  }
})