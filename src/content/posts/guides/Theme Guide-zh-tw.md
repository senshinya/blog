---
title: 主題上手指南
published: 2025-01-26
updated: 2025-03-12
tags: ["部落格主題","指南"]
pin: 99
lang: zh-tw
abbrlink: theme-guide
---

Retypeset 是一款基於 [Astro](https://astro.build/) 框架的靜態部落格主題，中文名為重新編排。本主題以 [活版印字](https://astro-theme-typography.vercel.app/) 為設計靈感，通過建立全新的視覺規範，對所有頁面進行重新編排，打造紙質書頁般的閱讀體驗，再現版式之美。所見皆為細節，方寸盡顯優雅。

## 主題配置

以下為 Retypeset 的主題配置介紹。通過修改配置文件 [src/config.ts](https://github.com/radishzzz/astro-theme-retypeset/blob/master/src/config.ts) 來自定義你的部落格。

### 站點信息

```ts
site: {
  // 站點標題
  title: 'Retypeset'
  // 站點副標題
  subtitle: 'Revive the beauty of typography'
  // 站點介紹
  description: 'Retypeset is a static blog theme...'
  // 使用 src/i18n/ui.ts 中的多語言標題/副標題/站點描述，替換以上靜態配置
  i18nTitle: true // true, false
  // 作者名稱
  author: 'radishzz'
  // 站點地址
  url: 'https://retypeset.radishzz.cc'
  // 站點圖標
  // 推薦格式: svg, png, ico
  favicon: '/icon/favicon.svg' // 或 https://example.com/favicon.svg
}
```

### 主題配色

```ts
color: {
  // 默認主題
  mode: 'light' // light, dark
  // 亮色模式
  light: {
    // 高亮顏色
    // 用於站點標題、滑鼠懸停效果等
    primary: 'oklch(25% 0.005 298)'
    // 次要顏色
    // 用於普通文本
    secondary: 'oklch(40% 0.005 298)'
    // 背景色
    background: 'oklch(96% 0.005 298)'
  }
  // 暗色模式
  dark: {
    // 高亮顏色
    // 用於站點標題、滑鼠懸停效果等
    primary: 'oklch(92% 0.005 298)'
    // 次要顏色
    // 用於普通文本
    secondary: 'oklch(77% 0.005 298)'
    // 背景色
    background: 'oklch(22% 0.005 298)'
  }
}
```

### 全局設置

```ts
global: {
  // 默認語言
  // 站點根路徑 '/' 的語言
  locale: 'zh' // zh, zh-tw, ja, en, es, ru
  // 更多語言
  // 生成 '/ja/' '/en/' 等多語言路徑
  // 不要重複填寫默認語言，可以為空 []
  moreLocales: ['zh-tw', 'ja', 'en', 'es', 'ru'] // ['zh', 'zh-tw', 'ja', 'en', 'es', 'ru']
  // 字體樣式
  fontStyle: 'sans' // sans, serif
  // 文章日期格式
  dateFormat: 'YYYY-MM-DD' // YYYY-MM-DD, MM-DD-YYYY, DD-MM-YYYY, MONTH DAY YYYY, DAY MONTH YYYY
  // 標題與副標題之間的距離
  titleGap: 2 // 1, 2, 3
  // 啟用 KaTeX 數學公式渲染
  katex: true // true, false
}
```

### 評論服務

```ts
comment: {
  // 開啟評論
  enabled: true // true, false
  // waline 評論
  waline: {
    // 服務器地址
    serverURL: 'https://retypeset-comment.radishzz.cc'
    // emoji 表情地址
    emoji: [
      'https://unpkg.com/@waline/emojis@1.2.0/tw-emoji'
      // 'https://unpkg.com/@waline/emojis@1.2.0/bmoji'
      // 更多表情: https://waline.js.org/en/guide/features/emoji.html
    ]
    // gif 搜索
    search: false // true, false
    // 圖片上傳
    imageUploader: false // true, false
  }
}
```

### 搜索引擎優化

```ts
seo: {
  // @twitter ID
  twitterID: '@radishzz_'
  // 站點驗證
  verification: {
    // google 搜索控制台
    google: 'AUCrz5F1e5qbnmKKDXl2Sf8u6y0kOpEO1wLs6HMMmlM'
    // bing 網站管理員工具
    bing: '64708CD514011A7965C84DDE1D169F87'
    // yandex 網站管理員
    yandex: ''
    // baidu 站長工具
    baidu: ''
  }
  // google 網站分析
  googleAnalyticsID: ''
  // umami 網站分析
  umamiAnalyticsID: '520af332-bfb7-4e7c-9386-5f273ee3d697'
  // follow 驗證
  follow: {
    // 訂閱 ID
    feedID: ''
    // 用戶 ID
    userID: ''
  }
  // apiflash access key 訪問密鑰
  // 自動生成網站截圖用於 open graph
  // 獲取訪問密鑰: https://apiflash.com/
  apiflashKey: ''
}
```

### 自定義頁腳

```ts
footer: {
  // 社交鏈接
  links: [
    {
      name: 'RSS',
      url: '/rss.xml', // rss.xml, atom.xml
    },
    {
      name: 'GitHub',
      url: 'https://github.com/radishzzz/astro-theme-retypeset',
    },
    {
      name: 'Twitter',
      url: 'https://x.com/radishzz_',
    },
    // {
    //   name: 'Email',
    //   url: 'https://example@gmail.com',
    // }
  ]
  // 建站年份
  startYear: 2024
}
```

### 資源預加載

```ts
preload: {
  // 鏈接預加載策略
  linkPrefetch: 'viewport' // hover, tap, viewport, load
  // 評論服務器地址
  commentURL: 'https://retypeset-comment.radishzz.cc'
  // 圖床地址
  imageHostURL: 'https://image.radishzz.cc'
  // 定制 google analytics js
  // 適用於路由 google analytics js 到自定義域名的用戶
  customGoogleAnalyticsJS: ''
  // 定制 umami analytics js
  // 適用於自部署 umami，或路由 umami analytics js 到自定義域名的用戶
  customUmamiAnalyticsJS: 'https://js.radishzz.cc/jquery.min.js'
}
```

## 創建新文章

在 `src/content/posts/` 目錄中新建以 `.md` 或 `.mdx` 為後綴的文件，並在文件頂部添加 Front Matter 元數據。

### Front Matter

```markdown
---
# 必填
title: 主題上手指南
published: 2025-01-26

# 可選
description: 自動選取文章前 120 字作為描述。
updated: 2025-03-26
tags: ["部落格主題", "指南"]

# 進階，可選
draft: true/false
pin: 1-99
toc: true/false
lang: zh/zh-tw/ja/en/es/ru
abbrlink: theme-guide
---
```

### 進階配置介紹

#### draft

是否標記文章為草稿。設為 true 時無法發佈文章，僅供本地開發預覽。預設為 false。

#### pin

是否置頂文章。數字越大，文章的置頂優先級越高。預設為 0，即不置頂。

#### toc

是否生成目錄。預設為 true。

#### lang

指定文章語言。只能指定一種語言，不指定則預設顯示在所有語言路徑下。

```md
# src/config.ts
# locale: 'en'
# moreLocales: ['es', 'ru']

# lang: ''
src/content/posts/apple.md   -> example.com/posts/apple/
                             -> example.com/es/posts/apple/
                             -> example.com/ru/posts/apple/
# lang: en
src/content/posts/apple.md   -> example.com/posts/apple/
# lang: es
src/content/posts/apple.md   -> example.com/es/posts/apple/
# lang: ru
src/content/posts/apple.md   -> example.com/ru/posts/apple/
```

#### abbrlink

自定義文章 URL。

```md
# src/config.ts
# locale: 'en'
# moreLocales: ['es', 'ru']
# lang: 'es'

# abbrlink: ''
src/content/posts/apple.md           ->  example.com/es/posts/apple/
src/content/posts/guide/apple.md     ->  example.com/es/posts/guide/apple/
src/content/posts/2025/03/apple.md   ->  example.com/es/posts/2025/03/apple/

# abbrlink: 'banana'
src/content/posts/apple.md           ->  example.com/es/posts/banana/
src/content/posts/guide/apple.md     ->  example.com/es/posts/banana/
src/content/posts/2025/03/apple.md   ->  example.com/es/posts/banana/
```

### 自動化配置介紹

自動計算文章閱讀時間。自動為每篇文章生成 Open Graph 圖片。相同 abbrlink 的文章會自動共享 Waline 評論，且不受 lang 配置影響。
