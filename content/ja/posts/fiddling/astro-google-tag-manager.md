---
authorship: human-only
title: "AstroにGoogle Analyticsを導入する（Tag Manager編）"
description: "ブログをAstroに移行したところ、従来のGoogle Analytics導入方法では性能面が気になるようになりました。headタグにJavaScriptを直接追加してイベントを送ることはできますが、ページの性能に影響します。そこでpartytownでスクリプトをメインスレッドから切り離し、読み込みを妨げないようにしました。サンプルコードに手を加えることでGoogle Analyticsの導入に成功し、性能とアクセス解析を両立できました。"
date: 2025-05-28 22:09:00
categories: [fiddling]
tags: ["試行錯誤", "Astro", "Google Tag Manager", "Google Analytics", "GTM", "partytown"]
image: "https://blog-img.774352199.xyz/Q0w4RN.webp"
---

### はじめに

前置きが不要な方は、解決方法の節まで飛ばしてください。

以前からGoogle Analyticsでブログのアクセス数やreferrerなどを見ていました。HexoやHugoといった静的ブログなら、headタグにJavaScriptを追加するだけで簡単に導入できます。先日ブログをAstroに移したのですが、従来どおりheadでJavaScriptを実行してイベントを送信すると、性能が落ちます。ご存じのとおり、Astroはフロントエンドの性能を追求し、JavaScriptの実行をできるだけゼロに抑える方針です。イベント送信のためにJavaScriptを動かすと、その分だけ性能を損なってしまいます。

![パフォーマンス満点！](https://blog-img.774352199.xyz/2025/e1e778992ea6b393ed763a8642db3770.png)

調べてみると、多くの解説がpartytownでスクリプトをメインスレッドの外に移し、読み込みをブロックせず性能を保つ方法を紹介していました。サンプルコードもあったので、それをもとにブログへ組み込んだ結果がこちらです。

![](https://blog-img.774352199.xyz/2025/e5005b9f2321f6946761eef52156e777.png)

計測数が見事にゼロになりました。

さすがに笑えません。長い調査が始まりましたが、原因はどうしても見つかりませんでした。ネット上の関連サンプルはどれも私と同じやり方です。解説を書いた人たちは自分で試していないのでしょうか。まったく動かないんですが。

仕方なく2か月ほど放置し、その間は一時的にumamiで計測していました。

ここ数日でまた思い出し、気になって仕方がなくなったので、再び延々と検索しました。ようやくGitHubの[片隅](https://github.com/QwikDev/partytown/issues/382#issuecomment-1667675238)で解決策を見つけました。

### 解決方法

パッケージマネージャーで`@astrojs/partytown`をインストールします。

`<head>`タグに次のコードを追加します。

```html
<script is:inline src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXX" type="text/partytown"></script>
<script is:inline type="text/partytown">
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
        dataLayer.push(arguments);
    };
  window.gtag('js', new Date());
  window.gtag('config', 'G-XXXXXXXXX');
</script>
```

注意点は次のとおりです。
- `is:inline`はスクリプトをクライアント側で実行する指定です。
- `type="text/partytown"`は、メインスレッドではなくpartytownで実行する指定です。
- `gtag`は関数宣言ではなく、windowオブジェクトの変数に関数を代入する形で定義する必要があります。妙な話ですが。

Astroの設定ファイル（通常は`astro.config.ts`や`astro.config.mjs`）に次の設定を追加します。

```js
import partytown from '@astrojs/partytown'

export default defineConfig({
  // ...
  integrations: [partytown({ config: { forward: ['dataLayer.push', 'gtag'] } })],
});
```

ほとんどの解説には、forward配列に`gtag`も追加する必要があることが書かれていません。

これで完了です！ コミットしてデプロイすると、Google Analyticsに正常にデータが送られるようになります。
