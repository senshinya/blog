---
title: テーマ使用ガイド
published: 2025-01-26
updated: 2025-03-12
tags: ["ブログテーマ","ガイド"]
pin: 99
lang: ja
abbrlink: theme-guide
---

Retypesetは、日本語では「再組版」と呼ばれる、[Astro](https://astro.build/) フレームワークをベースにした静的ブログテーマです。[活版印字](https://astro-theme-typography.vercel.app/) からデザインのインスピレーションを得て、新しい視覚的な規範を確立し、すべてのページのレイアウトを再構成することで、紙の書籍のような読書体験を提供し、版面の美しさを蘇らせます。見るものすべてが細部にこだわり、限られたスペースの中に優雅さを表現しています。

## テーマ設定

以下はRetypesetのテーマ設定ガイドです。設定ファイル [src/config.ts](https://github.com/radishzzz/astro-theme-retypeset/blob/master/src/config.ts) を修正してブログをカスタマイズできます。

### サイト情報

```ts
site: {
  // サイトタイトル
  title: 'Retypeset'
  // サイトサブタイトル
  subtitle: 'Revive the beauty of typography'
  // サイト説明
  description: 'Retypeset is a static blog theme...'
  // 上記の静的設定の代わりに src/i18n/ui.ts の多言語タイトル/サブタイトル/説明を使用
  i18nTitle: true // true, false
  // 著者名
  author: 'radishzz'
  // サイトURL
  url: 'https://retypeset.radishzz.cc'
  // ファビコンURL
  // 推奨フォーマット: svg, png, ico
  favicon: '/icon/favicon.svg' // または https://example.com/favicon.svg
}
```

### テーマカラー

```ts
color: {
  // デフォルトテーマモード
  mode: 'light' // light, dark
  // ライトモード
  light: {
    // プライマリカラー
    // サイトタイトル、ホバー効果などに使用
    primary: 'oklch(25% 0.005 298)'
    // セカンダリカラー
    // 通常テキストに使用
    secondary: 'oklch(40% 0.005 298)'
    // 背景色
    background: 'oklch(96% 0.005 298)'
  }
  // ダークモード
  dark: {
    // プライマリカラー
    // サイトタイトル、ホバー効果などに使用
    primary: 'oklch(92% 0.005 298)'
    // セカンダリカラー
    // 通常テキストに使用
    secondary: 'oklch(77% 0.005 298)'
    // 背景色
    background: 'oklch(22% 0.005 298)'
  }
}
```

### グローバル設定

```ts
global: {
  // デフォルト言語
  // サイトのルートパス '/' の言語
  locale: 'zh' // zh, zh-tw, ja, en, es, ru
  // その他の言語
  // '/ja/' '/en/' などの多言語パスを生成
  // デフォルト言語を重複して入力しないでください、空の配列 [] も可能です
  moreLocales: ['zh-tw', 'ja', 'en', 'es', 'ru'] // ['zh', 'zh-tw', 'ja', 'en', 'es', 'ru']
  // フォントスタイル
  fontStyle: 'sans' // sans, serif
  // 記事の日付フォーマット
  dateFormat: 'YYYY-MM-DD' // YYYY-MM-DD, MM-DD-YYYY, DD-MM-YYYY, MONTH DAY YYYY, DAY MONTH YYYY
  // タイトルとサブタイトルの間隔
  titleGap: 2 // 1, 2, 3
  // 数式表示のためのKaTeXを有効化
  katex: true // true, false
}
```

### コメントサービス

```ts
comment: {
  // コメント機能を有効にする
  enabled: true // true, false
  // waline コメント
  waline: {
    // サーバー URL
    serverURL: 'https://retypeset-comment.radishzz.cc'
    // 絵文字 URL
    emoji: [
      'https://unpkg.com/@waline/emojis@1.2.0/tw-emoji'
      // 'https://unpkg.com/@waline/emojis@1.2.0/bmoji'
      // その他の絵文字: https://waline.js.org/en/guide/features/emoji.html
    ]
    // gif 検索
    search: false // true, false
    // 画像アップローダー
    imageUploader: false // true, false
  }
}
```

### 検索エンジン最適化

```ts
seo: {
  // @twitter ID
  twitterID: '@radishzz_'
  // サイト認証
  verification: {
    // Google Search Console
    google: 'AUCrz5F1e5qbnmKKDXl2Sf8u6y0kOpEO1wLs6HMMmlM'
    // Bing ウェブマスターツール
    bing: '64708CD514011A7965C84DDE1D169F87'
    // Yandex ウェブマスター
    yandex: ''
    // Baidu 検索
    baidu: ''
  }
  // Google Analytics
  googleAnalyticsID: ''
  // Umami Analytics
  umamiAnalyticsID: '520af332-bfb7-4e7c-9386-5f273ee3d697'
  // フォロー認証
  follow: {
    // フィードID
    feedID: ''
    // ユーザーID
    userID: ''
  }
  // APIFlash アクセスキー
  // OpenGraph 用のウェブサイトスクリーンショットを自動生成
  // アクセスキーの取得: https://apiflash.com/
  apiflashKey: ''
}
```

### フッター設定

```ts
footer: {
  // ソーシャルリンク
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
  // サイト開始年
  startYear: 2024
}
```

### リソースプリロード

```ts
preload: {
  // リンクプリフェッチ戦略
  linkPrefetch: 'viewport' // hover, tap, viewport, load
  // コメントサーバー URL
  commentURL: 'https://retypeset-comment.radishzz.cc'
  // 画像ホスティング URL
  imageHostURL: 'https://image.radishzz.cc'
  // カスタム Google Analytics JS
  // アナリティクス JavaScript をカスタムドメインにルーティングするユーザー向け
  customGoogleAnalyticsJS: ''
  // カスタム Umami Analytics JS
  // Umamiを自己デプロイしたり、アナリティクス JavaScript をカスタムドメインにルーティングするユーザー向け
  customUmamiAnalyticsJS: 'https://js.radishzz.cc/jquery.min.js'
}
```

## 新しい記事の作成

`src/content/posts/` ディレクトリに `.md` または `.mdx` 拡張子を持つ新しいファイルを作成し、ファイルの先頭に Front Matter メタデータを追加します。

### Front Matter

```markdown
---
# 必須
title: テーマ使用ガイド
published: 2025-01-26

# 任意
description: 記事の最初の120文字が自動的に説明として選択されます。
updated: 2025-03-26
tags: ["ブログテーマ", "ガイド"]

# 高度な設定（任意）
draft: true/false
pin: 1-99
toc: true/false
lang: zh/zh-tw/ja/en/es/ru
abbrlink: theme-guide
---
```

### 高度な設定の説明

#### draft

記事を下書きとしてマークします。true に設定すると、記事は公開されず、ローカル開発プレビューでのみ利用可能です。デフォルトは false です。

#### pin

記事をトップに固定します。数字が大きいほど、固定された記事の優先度が高くなります。デフォルトは 0 で、固定されていないことを意味します。

#### toc

目次を自動生成するかどうか。デフォルトは true。

#### lang

記事の言語を指定します。一つの言語のみ指定できます。指定しない場合、記事はデフォルトですべての言語パスに表示されます。

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

記事のURLをカスタマイズします。

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

### 自動化機能の説明

記事の読書時間を自動的に計算します。各記事のOpen Graph画像を自動的に生成します。同じabbrlinkを持つ記事は、lang設定に関係なく、Walineコメントを自動的に共有します。
