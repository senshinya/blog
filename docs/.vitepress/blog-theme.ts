// 主题独有配置
import { getThemeConfig } from '@sugarat/theme/node'

// 开启RSS支持（RSS配置）
import type { Theme } from '@sugarat/theme'

const baseUrl = 'https://shinya.click'
const RSS: Theme.RSSOptions = {
  title: '信也のブログ',
  baseUrl,
  copyright: 'Copyright © 2017-present 信也のブログ',
  language: 'zh-CN',
  filename: 'feed.xml',
  ignoreHome: false,
}

// 所有配置项，详见文档: https://theme.sugarat.top/
const blogTheme = getThemeConfig({
  // 开启RSS支持
  RSS,

  backToTop: false,

  // 文章全局设置
  article: {
    readingTime: true,
    hiddenCover: true,
    readingTimePosition: 'inline',
  },

  // 精选文章
  hotArticle: false,

  // 页脚
  footer: {
    // message 字段支持配置为HTML内容，配置多条可以配置为数组
    // message: '下面 的内容和图标都是可以修改的噢（当然本条内容也是可以隐藏的）',
    copyright: 'Copyright © 2017-present 信也のブログ',
    icpRecord: {
      name: '萌ICP备20248008号',
      link: 'https://icp.gov.moe/?keyword=20248008'
    },
    version: false
  },

  recommend: {
    style: 'sidebar',
    sort(a, b) {
      if (a.route.includes('notes') || a.route.includes('projects'))
        return +new Date(a.meta.date) - +new Date(b.meta.date)
      return +new Date(b.meta.date) - +new Date(a.meta.date)
    },
    pageSize: 50,
    showNum: false
  },

  comment: {
    type: 'giscus',
    options: {
      repo: "senshinya/blog",
      repoId: "R_kgDOLAV3QQ",
      category: "Announcements",
      categoryId: "DIC_kwDOLAV3Qc4CcKlC",
      mapping: "pathname",
      inputPosition: "top",
      lang: "zh-CN",
      loading: "lazy",
    },
    mobileMinify: true
  },

  // 主题色修改
  themeColor: 'el-blue',

  // 文章默认作者
  author: 'shinya',
})

export { blogTheme }
