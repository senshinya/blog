---
authorship: human-only
title: "VPSの特定の通信をWARP経由のIPv6で外に出す"
description: "ある平凡な午後、Telegramの通知で魅力的なVPSプランを見つけました。中国電信CN2直結、帯域2.5Gという好条件です。IPv6付きで動画配信サービスの地域制限解除にも便利ですが、すべての通信をWARP経由にする必要はありません。以前のスクリプトは手軽な一方、速度と振り分けに不満があり、もっと柔軟な方法を探すことにしました。"
date: 2025-03-15 16:24:00
categories: [fiddling]
tags: ["試行錯誤", "検閲回避", "warp", "トラフィック振り分け"]
---

先週の何でもない午後、ずっとバックグラウンドで静かにしていたTelegramに通知が届きました。

![](https://blog-img.774352199.xyz/2025/c2dcc1d96db444256f1092fb0e15ce3d.png)​

よく見ると、中国電信CN2直結、帯域2.5G、転送量1T、クーポン適用で年間36ドル。月あたり3ドルです。

これはずっと手放したくない、家宝級のVPSです！

即座に支払いを済ませ、すぐ友人たちにも声をかけて、周りの同僚3、4人まで巻き込みました。

このプランにはIPv6が付いていて、各種動画配信サービスの地域制限解除に役立ちます。もちろんIPv6のないVPSもまだたくさんありますし、中国には「狡兎三窟」ということわざもあります。外に出るなら別の顔も持っておきたいものです。そこで、太っ腹なCloudflareのWARPの出番です。

以前は[fscarmen/warp](https://gitlab.com/fscarmen/warp)のスクリプトを使っていました。グローバルモードを起動するだけで、VPS全体の出口がWARPに切り替わります。ただし、問題が2つあります。

1. WARPを通すと速度が落ちますし、すべての通信を通す必要もありません。通常はNetflixやOpenAIのようにIPへの要求が厳しいサービスだけで十分です。
2. WARPが全通信を引き受けると、デュアルスタックでもIPv4が優先されることがあります。DNS解決はWARP内部のリモート側で行われるため、こちらから制御できません。

1つ目は、スクリプトの非グローバルモードでローカルにSOCKSプロキシを立て、プロキシソフトで振り分ければ解決します。2つ目は、プロキシソフトでDNSをローカル解決し、解決後の通信をWARPへ流せば対応できます。

非グローバルモードはインストール時に選択できます。

```shell
wget -N https://gitlab.com/fscarmen/warp/-/raw/main/menu.sh && bash menu.sh c
```

インストール後のメニューからも選べます。WARP Linux Clientでもwireproxyでもかまいません。

有効にすると、標準ではローカルの40000番ポートでSOCKSが待ち受けます。

このSOCKSサービスを出口に追加し、必要に応じて振り分ければOKです。以下はXrayの例ですが、Clashやsing-boxも同様です。

```json
{
  "outbounds": [
    {
      "tag": "warp",
      "protocol": "socks",
      "settings": {
        "servers": [
          {
            "address": "127.0.0.1",
            "port": 40000
          }
        ]
      }
    }
  ]
}
```

プロキシソフトの出口を直接SOCKS5サービスにすると、リモートDNS解決が行われ、IPv4とIPv6のどちらで出るかが安定しません。ここはローカルDNSで解決できます。

ローカルDNSを使うには、プロキシソフトのDNSモジュールを有効にします。

```json
{
  "dns": {
    "servers": [
      "2606:4700:4700::1111",
      "1.1.1.1"
    ],
    "queryStrategy": "UseIP",
    "tag": "dns_inbound"
  }
}
```

出口はプロキシチェーンとして追加します。

```json
{
  "outbounds": [
    {
      "tag": "warp",
      "protocol": "freedom",
      "settings": {
        "domainStrategy": "UseIPv6v4"
      },
      "proxySettings": {
        "tag": "warp-inner"
      }
    },
    {
      "tag": "warp-inner",
      "protocol": "socks",
      "settings": {
        "servers": [
          {
            "address": "127.0.0.1",
            "port": 40000
          }
        ]
      }
    }
  ]
}
```

まずfreedomの出口で名前解決します。UseIPv6v4は、解決されたIPv6アドレスを優先し、IPv6がなければIPv4を使う指定です。その後proxySettingsでwarp-innerへ流します。これは先ほど設定したSOCKS、つまりWARPです。

これで、アクセス先がIPv6に対応していれば、warpタグ経由のアクセスは必ずIPv6になります。
