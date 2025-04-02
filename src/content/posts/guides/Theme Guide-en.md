---
title: Theme Guide
published: 2025-01-26
updated: 2025-03-12
tags: ["Blog Theme","Guide"]
pin: 99
lang: en
abbrlink: theme-guide
---

Retypeset is a static blog theme based on the [Astro](https://astro.build/) framework. Inspired by [Typography](https://astro-theme-typography.vercel.app/), Retypeset establishes a new visual standard and reimagines the layout of all pages, creating a reading experience reminiscent of paper books, reviving the beauty of typography. Details in every sight, elegance in every space.

## Theme Configuration

Below is the theme configuration guide for Retypeset. Customize your blog by modifying the configuration file [src/config.ts](https://github.com/radishzzz/astro-theme-retypeset/blob/master/src/config.ts).

### Site Information

```ts
site: {
  // site title
  title: 'Retypeset'
  // site subtitle
  subtitle: 'Revive the beauty of typography'
  // site description
  description: 'Retypeset is a static blog theme...'
  // use i18n title/subtitle/description from src/i18n/ui.ts instead of static ones above
  i18nTitle: true // true, false
  // author name
  author: 'radishzz'
  // site url
  url: 'https://retypeset.radishzz.cc'
  // favicon url
  // recommended formats: svg, png or ico
  favicon: '/icon/favicon.svg' // or https://example.com/favicon.svg
}
```

### Theme Color

```ts
color: {
  // default theme mode
  mode: 'light' // light, dark
  // light mode
  light: {
    // primary color
    // used for title, hover, etc
    primary: 'oklch(25% 0.005 298)'
    // secondary color
    // used for post text
    secondary: 'oklch(40% 0.005 298)'
    // background color
    background: 'oklch(96% 0.005 298)'
  }
  // dark mode
  dark: {
    // primary color
    // used for title, hover, etc
    primary: 'oklch(92% 0.005 298)'
    // secondary color
    // used for post text
    secondary: 'oklch(77% 0.005 298)'
    // background color
    background: 'oklch(22% 0.005 298)'
  }
}
```

### Global Settings

```ts
global: {
  // default language
  // language of the site root path '/'
  locale: 'zh' // zh, zh-tw, ja, en, es, ru
  // more languages
  // Generate multi-language paths such as '/es/' '/ru/'
  // do not include the default language again, can be an empty array []
  moreLocales: ['zh-tw', 'ja', 'en', 'es', 'ru'] // ['zh', 'zh-tw', 'ja', 'en', 'es', 'ru']
  // font style
  fontStyle: 'sans' // sans, serif
  // date format for posts
  dateFormat: 'YYYY-MM-DD' // YYYY-MM-DD, MM-DD-YYYY, DD-MM-YYYY, MONTH DAY YYYY, DAY MONTH YYYY
  // gap between title and subtitle
  titleGap: 2 // 1, 2, 3
  // enable KaTeX for mathematical formulas rendering
  katex: true // true, false
}
```

### Comment System

```ts
comment: {
  // enable comment system
  enabled: true // true, false
  // waline comment system
  waline: {
    // server url
    serverURL: 'https://retypeset-comment.radishzz.cc'
    // emoji url
    emoji: [
      'https://unpkg.com/@waline/emojis@1.2.0/tw-emoji'
      // 'https://unpkg.com/@waline/emojis@1.2.0/bmoji'
      // more emojis: https://waline.js.org/en/guide/features/emoji.html
    ]
    // gif search
    search: false // true, false
    // image uploader
    imageUploader: false // true, false
  }
}
```

### SEO

```ts
seo: {
  // @twitter ID
  twitterID: '@radishzz_'
  // site verification
  verification: {
    // google search console
    google: 'AUCrz5F1e5qbnmKKDXl2Sf8u6y0kOpEO1wLs6HMMmlM'
    // bing webmaster tools
    bing: '64708CD514011A7965C84DDE1D169F87'
    // yandex webmaster
    yandex: ''
    // baidu search
    baidu: ''
  }
  // google analytics
  googleAnalyticsID: ''
  // umami analytics
  umamiAnalyticsID: '520af332-bfb7-4e7c-9386-5f273ee3d697'
  // follow verification
  follow: {
    // feed ID
    feedID: ''
    // user ID
    userID: ''
  }
  // apiflash access key
  // automatically generate website screenshots for open graph images
  // get your access key at: https://apiflash.com/
  apiflashKey: ''
}
```

### Footer Settings

```ts
footer: {
  // social links
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
  // year of website start
  startYear: 2024
}
```

### Preload Resources

```ts
preload: {
  // link prefetch strategies
  linkPrefetch: 'viewport' // hover, tap, viewport, load
  // comment server url
  commentURL: 'https://retypeset-comment.radishzz.cc'
  // image hosting url
  imageHostURL: 'https://image.radishzz.cc'
  // custom google analytics js
  // for users who route analytics javascript to a customized domain
  customGoogleAnalyticsJS: ''
  // custom umami analytics js
  // for users who deploy umami on their own, or route analytics javascript to a customized domain
  customUmamiAnalyticsJS: 'https://js.radishzz.cc/jquery.min.js'
}
```

## Creating a New Post

Create a new file with `.md` or `.mdx` extension in the `src/content/posts/` directory, and add Front Matter metadata at the top of the file.

### Front Matter

```markdown
---
# Required
title: Theme Guide
published: 2025-01-26

# Optional
description: The first 240 characters of the article will be automatically selected as the description.
updated: 2025-03-26
tags: ["Blog Theme", "Guide"]

# Advanced, optional
draft: true/false
pin: 1-99
toc: true/false
lang: en/es/ru/zh/zh-tw/ja
abbrlink: theme-guide
---
```

### Advanced Configuration

#### draft

Marks the article as a draft. When set to true, the article cannot be published and is only available for local development preview. Default is false.

#### pin

Pins the article to the top. The higher the number, the higher the priority of the pinned article. Default is 0, which means not pinned.

#### toc

Generate table of contents. Default is true.

#### lang

Specifies the article language. Only one language can be specified. If not specified, the article will be displayed in all language paths by default.

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

Customizes the article URL.

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

### Automated Features

Automatically calculates article reading time. Automatically generates Open Graph images for each article. Articles with the same abbrlink will automatically share Waline comments, regardless of the lang configuration.
