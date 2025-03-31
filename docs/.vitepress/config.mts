import { defineConfig } from 'vitepress'
import { nav } from './config/nav'
import { head } from './config/head'
import { blogTheme } from './blog-theme'
import { withPwa } from '@vite-pwa/vitepress'

const trian_svg = '<svg fill="#000000" height="800px" width="800px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xml:space="preserve"> <g> <path fill="currentColor" d="M170.673,383.998c11.776,0,21.333-9.557,21.333-21.333s-9.557-21.333-21.333-21.333s-21.333,9.557-21.333,21.333 S158.897,383.998,170.673,383.998z"/> <path d="M341.34,383.998c11.776,0,21.333-9.557,21.333-21.333s-9.557-21.333-21.333-21.333c-11.776,0-21.333,9.557-21.333,21.333 S329.564,383.998,341.34,383.998z"/> <path fill="currentColor" d="M460.806,473.598l-55.654-41.741c13.198-11.722,21.521-28.812,21.521-47.859v-85.333V191.998v-21.333 c0-35.355-28.645-64-64-64H341.34c0-5.46-2.083-10.919-6.248-15.085c-8.331-8.331-21.839-8.331-30.17,0l-15.085,15.085h-33.83 c0-5.46-2.083-10.919-6.248-15.085c-8.331-8.331-21.839-8.331-30.17,0l-15.085,15.085H149.34c-35.355,0-64,28.645-64,64v21.333 v106.667v85.333c0,19.047,8.323,36.137,21.521,47.859l-55.654,41.741c-16.401,12.301-7.702,38.4,12.8,38.4h384 C468.508,511.998,477.208,485.899,460.806,473.598z M128.006,319.998h256v64c0,11.791-9.542,21.333-21.333,21.333H149.34 c-11.791,0-21.333-9.542-21.333-21.333V319.998z M128.006,213.331h256v64h-256V213.331z M149.34,149.331h213.333 c11.791,0,21.333,9.542,21.333,21.333h-256C128.006,158.873,137.548,149.331,149.34,149.331z M128.006,469.331l28.444-21.333 h199.111l28.444,21.333H128.006z"/> <path fill="currentColor" d="M256,0.002c-141.382,0-256,114.618-256,256c0,32.26,5.979,63.724,17.487,93.147 c4.292,10.973,16.666,16.389,27.638,12.097c10.973-4.292,16.389-16.666,12.097-27.639c-9.578-24.488-14.556-50.683-14.556-77.605 c0-117.818,95.515-213.333,213.333-213.333s213.333,95.515,213.333,213.333c0,26.927-4.966,53.1-14.534,77.563 c-4.292,10.973,1.124,23.347,12.097,27.639c10.973,4.292,23.347-1.124,27.638-12.097c11.499-29.4,17.466-60.843,17.466-93.104 C512,114.62,397.382,0.002,256,0.002z"/> </g> </svg>'
const heart_svg = '<svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.88 108.16"><title>heartbeat</title><path d="M60.78,15.09l.09-.09C67.82,7.62,73.54,1.56,85.22.21a33.65,33.65,0,0,1,18.94,3.44,35,35,0,0,1,12.46,10.42,31.37,31.37,0,0,1,6.06,15.11,30.11,30.11,0,0,1-1.46,13.25h-6.38a24.82,24.82,0,0,0,1.9-12.57,25.59,25.59,0,0,0-4.92-12.23A29.24,29.24,0,0,0,101.5,9,27.8,27.8,0,0,0,85.9,6.16C76.39,7.25,71.35,12.6,65.22,19.09L63,21.43a3,3,0,0,1-4.22.06l-2.15-2.1c-7.52-7.4-13.19-13-24.9-13.12-.47,0-.95,0-1.46,0a26.27,26.27,0,0,0-17,6.77A23.13,23.13,0,0,0,6,30c0,.44,0,.91,0,1.4A35.69,35.69,0,0,0,8.26,42.43H1.93A40.69,40.69,0,0,1,0,31.59c0-.54,0-1.1,0-1.68A28.93,28.93,0,0,1,9.16,8.69,32.11,32.11,0,0,1,30.06.32c.55,0,1.14,0,1.74,0,14.11.18,20.51,6.45,29,14.79ZM2,51.65H30.59l6.49-10.49L48.53,57.77,60,34.54,72.37,58.36l5.86-6H120.9v6H80.75L70.89,68.48,60.12,47.79,49.39,69.55l-12-17.47-3.44,5.57H2v-6ZM102.43,68.44l-.29.31c-5,5.16-10.28,10.23-15,14.79-2.78,2.66-5.38,5.15-7.58,7.33L63,107.29a3,3,0,0,1-4.18,0L45.11,94.15c-2.5-2.4-5.4-5.05-8.42-7.8C30.63,80.82,24.1,74.87,18.26,68.44H26.5c4.64,4.75,9.57,9.25,14.22,13.48,3,2.7,5.81,5.3,8.53,7.92L60.83,101,75.31,86.63c2.28-2.26,4.87-4.75,7.64-7.4,3.53-3.38,7.36-7,11.1-10.79Z"/></svg>'

// Vitepress 默认配置
// 详见文档：https://vitepress.dev/reference/site-config
export default withPwa(defineConfig({
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
  sitemap: {
    hostname: 'https://shinya.click'
  },
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

    logo: './bg.webp',
    nav: nav,
    socialLinks: [
      { icon: { svg: heart_svg }, link: 'https://bpm.shinya.click/public-dashboards/bcdf2aee203943aebb35d635019467e6?from=now-24h&to=now&timezone=browser' },
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
      include: [
        '@antv/g2plot',
      ]
    },
    ssr: {
      noExternal: [
        // '@nolebase/vitepress-plugin-enhanced-readabilities', 
        '@nolebase/ui',
        '@nolebase/vitepress-plugin-highlight-targeted-heading',
      ],
    },
  },

  pwa: {
    outDir: 'dist',
    selfDestroying: true
  }
}))
