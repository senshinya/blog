import { defineConfig } from 'vitepress'
import { nav } from './config/nav'
import { head } from './config/head'
import { blogTheme } from './blog-theme'

const trian_svg = '<svg fill="#000000" height="800px" width="800px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xml:space="preserve"> <g> <path fill="currentColor" d="M170.673,383.998c11.776,0,21.333-9.557,21.333-21.333s-9.557-21.333-21.333-21.333s-21.333,9.557-21.333,21.333 S158.897,383.998,170.673,383.998z"/> <path d="M341.34,383.998c11.776,0,21.333-9.557,21.333-21.333s-9.557-21.333-21.333-21.333c-11.776,0-21.333,9.557-21.333,21.333 S329.564,383.998,341.34,383.998z"/> <path fill="currentColor" d="M460.806,473.598l-55.654-41.741c13.198-11.722,21.521-28.812,21.521-47.859v-85.333V191.998v-21.333 c0-35.355-28.645-64-64-64H341.34c0-5.46-2.083-10.919-6.248-15.085c-8.331-8.331-21.839-8.331-30.17,0l-15.085,15.085h-33.83 c0-5.46-2.083-10.919-6.248-15.085c-8.331-8.331-21.839-8.331-30.17,0l-15.085,15.085H149.34c-35.355,0-64,28.645-64,64v21.333 v106.667v85.333c0,19.047,8.323,36.137,21.521,47.859l-55.654,41.741c-16.401,12.301-7.702,38.4,12.8,38.4h384 C468.508,511.998,477.208,485.899,460.806,473.598z M128.006,319.998h256v64c0,11.791-9.542,21.333-21.333,21.333H149.34 c-11.791,0-21.333-9.542-21.333-21.333V319.998z M128.006,213.331h256v64h-256V213.331z M149.34,149.331h213.333 c11.791,0,21.333,9.542,21.333,21.333h-256C128.006,158.873,137.548,149.331,149.34,149.331z M128.006,469.331l28.444-21.333 h199.111l28.444,21.333H128.006z"/> <path fill="currentColor" d="M256,0.002c-141.382,0-256,114.618-256,256c0,32.26,5.979,63.724,17.487,93.147 c4.292,10.973,16.666,16.389,27.638,12.097c10.973-4.292,16.389-16.666,12.097-27.639c-9.578-24.488-14.556-50.683-14.556-77.605 c0-117.818,95.515-213.333,213.333-213.333s213.333,95.515,213.333,213.333c0,26.927-4.966,53.1-14.534,77.563 c-4.292,10.973,1.124,23.347,12.097,27.639c10.973,4.292,23.347-1.124,27.638-12.097c11.499-29.4,17.466-60.843,17.466-93.104 C512,114.62,397.382,0.002,256,0.002z"/> </g> </svg>'

// Vitepress 默认配置
// 详见文档：https://vitepress.dev/reference/site-config
export default defineConfig({
  // 继承博客主题(@sugarat/theme)
  extends: blogTheme,
  // base,
  lang: 'zh-CN',
  title: '信也のブログ',
  description: '一写代码的',
  lastUpdated: false,
  cleanUrls: true,
  outDir: './dist',
  // 详见：https://vitepress.dev/zh/reference/site-config#head
  head: head,
  themeConfig: {
    // 展示 2,3 级标题在目录中
    outline: {
      level: [2, 3],
      label: '目录'
    },
    // 默认文案修改
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '相关文章',
    lastUpdatedText: '上次更新于',

    logo: '/bg.png',
    nav: nav,
    socialLinks: [
      { icon: { svg: trian_svg }, link: 'https://www.travellings.cn/go.html' },
      { icon: 'github', link: 'https://github.com/senshinya' }
    ],
  },
  rewrites: {
    'posts/:categorie/:type/:file.md': ':categorie/:type/:file.md',
    'posts/:categorie/:type/:type1/:file.md': ':categorie/:type/:type1/:file.md',
    'posts/:categorie/:file.md': ':categorie/:file.md',
    'pages/:file.md': ':file.md'
  },
  vite: {
    optimizeDeps: {
      exclude: [ 
        // '@nolebase/vitepress-plugin-enhanced-readabilities/client', 
        'vitepress', 
        '@nolebase/ui', 
      ], 
    },
    ssr: { 
      noExternal: [
        // '@nolebase/vitepress-plugin-enhanced-readabilities', 
        '@nolebase/ui',
        '@nolebase/vitepress-plugin-highlight-targeted-heading',
      ], 
    },
  }
})
