---
authorship: human-only
title: "FakeIPを使った透過プロキシの振り分け"
description: "FakeIPを使った透過プロキシ構成で、従来のサイドルーターの単一障害点、性能不足、複雑なポート転送を改善します。プロキシコアをsing-boxに変えることで、転送性能を高めながら設定も簡単にできます。対応プロトコルが豊富で、従来のClashより最適化も進んでいます。同じ構成はClashでも実現できますが、sing-boxは柔軟な選択肢になります。"
date: 2024-08-16 23:53:00
categories: [fiddling]
tags: ["試行錯誤", "検閲回避", "透過プロキシ", "FakeIP"]
---

### はじめに

[前の記事](/ja/fiddling/debian-as-bypass-router)では、サイドルーターでLAN内の透過プロキシを構築しました。多くの人には十分使える構成ですが、欠点もはっきりしています。

1. 単一障害点になります。DHCPで配るゲートウェイがサイドルーターを直接指すため、そこでClashが止まると検閲回避が不要なサイトまでアクセスできなくなります。
2. Clashのパケット転送性能はハードウェア転送に遠く及びません。ゲートウェイをサイドルーターにすると、iptablesの設定により、検閲回避が必要かどうかに関係なくClashが全通信を転送します。
3. サイドルーターがゲートウェイになるため、メインルーターとサイドルーターの両方でポート転送を設定する必要があります。

ちょうど最近、新興のプロキシコアsing-boxを見つけました。新興というほどでもなく、Clashがarchiveされてから人気が出ただけかもしれません。[Wiki](https://sing-box.sagernet.org/configuration)を見ると、対応プロトコルと機能が充実し、性能の最適化もClashより進んでいます。新しい構成では、そのままsing-boxを使うことにしました。

もちろん、この構成はClashでも実現できます。

~~悲報：sing-boxのWikiを見るにも検閲回避が必要です。~~

### 構成の考え方

sing-boxとClashにはどちらもDNSサーバー機能が組み込まれていて、FakeIPに対応しています。FakeIPは次のように考えるとわかりやすいです。<mark>クライアントがDNSクエリを送ると、DNSモジュールはすぐに偽のIPを返し、裏で実際の名前解決を行って偽IPと実IPの対応を保持します。その後クライアントがFakeIPに接続してデータを送ると、ゲートウェイが対応表から実IPを引いてリクエストします。</mark>詳しくは[RFC3089](https://datatracker.ietf.org/doc/html/rfc3089)を参照してください。後のルーティングでDNS応答時に保存した対応表を使うため、DNSサーバー単独ではFakeIPの仕組み全体を実現できません。

FakeIPは通常、`198.18.0.0/15`などの予約済み範囲にあるので、見分けやすく振り分けも簡単です。ソフトウェアルーター上のプロキシのDNSに、プロキシが必要なドメインだけFakeIPを返させます。そしてメインルーターにネクストホップを設定し、FakeIP宛てだけをソフトウェアルーターのプロキシへ流し、それ以外は通常どおり転送します。具体的には次のとおりです。

 ![FakeIPによる振り分け](https://blog-img.774352199.xyz/2025/e078ffe1fe41b2cbcb04b40a55cbbc56.png)

```
1. 无须科学的域名
  1. 客户端发起 DNS 解析
  2. DNS 模块判断为无须科学，向国内 DNS 请求，返回 RealIP
  3. 客户端使用 RealIP 发起请求
  4. 主路由判断不是 FakeIP，走默认路由（直连）
  
2. 需要科学的域名
  1. 客户端发起 DNS 解析
  2. DNS 模块判断为需要科学，返回 FakeIP，并向国外 DNS 请求
  3. 客户端使用 FakeIP 发起请求
  4. 主路由判断是 FakeIP，路由流量到代理软件
  5. 代理软件根据 FakeIP 映射，通过出口节点向国外 IP 发起请求
```

これで前の記事の3つの欠点を解消できます。


1. 単一障害点の問題です。sing-boxが止まってもインターネット全体が使えなくなるのを防げます。前の記事と同じくsing-boxのDNSはAdGuard Homeの後段に置きます。AdGuardが上流の障害を検知すると、中国国内のフォールバックDNSを使います。FakeIPが返らなくなるので、全通信がメインルーターのデフォルトルートを通ります。
2. 検閲回避が不要な通信はプロキシソフトを通らず、ルーターが直接転送します。
3. メインルーターのルーティングテーブルが転送を担い、全クライアントのゲートウェイもメインルーターになります。NATが2段にならないため、メインルーターのポート転送が壊れません。

### 実装

#### メインルーターの設定

まずメインルーターにネクストホップゲートウェイを設定します。iKuaiなら流量制御・振り分け → 振り分け設定 → ポート振り分けでルールを追加し、方式をネクストホップゲートウェイにしてソフトウェアルーターのIP（私の場合は192.168.7.2）を入力します。宛先アドレスに198.18.0.0/15を追加し、ほかは標準設定のままにします。

 ![ネクストホップゲートウェイ](https://blog-img.774352199.xyz/2025/37f3bc2ebbd0f4f79e218c2a949a84c4.png)

これで198.18.0.0/15宛ての通信は、メインルーターを通るときにすべて192.168.7.2へ転送されます。

#### sing-boxのインストールと設定

[前の記事](/ja/fiddling/debian-as-bypass-router)に従ってAdGuard Homeを構築し、上流DNSは引き続き127.0.0.1:1053にします。続いてsing-boxをインストールします。Debianならコマンド1つです。

```shell
bash <(curl -fsSL https://sing-box.app/deb-install.sh)
```

ほかのディストリビューション向けの手順は[https://sing-box.sagernet.org/installation/package-manager](https://sing-box.sagernet.org/installation/package-manager/#__tabbed_2_1)にあります。

インストーラーがsystemdサービスを自動作成します。sing-boxの定義は少し変わっていて、`/lib/systemd/system/sing-box.service`にあります。このファイルを編集し、ExecStartの前に次の3行を追加します。

```shell
ExecStartPre  = +/usr/bin/bash /etc/sing-box/clean.sh
ExecStartPost = +/usr/bin/bash /etc/sing-box/iptables.sh
ExecStopPost  = +/usr/bin/bash /etc/sing-box/clean.sh
```

前の構成と同様に、起動時にルーティングを設定し、sing-box停止時に消去します。sing-boxの設定はすべて`/etc/sing-box`にあり、標準の設定ファイルも`/etc/sing-box/config.json`なので、スクリプトもそこへそろえます。

`/etc/sing-box/iptables.sh`と`/etc/sing-box/clean.sh`を次の内容で作成します。

```shell
#!/usr/bin/env bash

set -ex

# ENABLE ipv4 forward
sysctl -w net.ipv4.ip_forward=1
# ENABLE ipv6 forward
sysctl -w net.ipv6.conf.all.forwarding=1

### IPv4 Routing Rules ###
# ROUTE RULES
ip rule add fwmark 666 lookup 666
ip route add local 0.0.0.0/0 dev lo table 666

# clash 链负责处理转发流量
iptables -t mangle -N clash

# 跳过内网流量
iptables -t mangle -A clash -d 0.0.0.0/8 -j RETURN
iptables -t mangle -A clash -d 127.0.0.0/8 -j RETURN
iptables -t mangle -A clash -d 10.0.0.0/8 -j RETURN
iptables -t mangle -A clash -d 172.16.0.0/12 -j RETURN
iptables -t mangle -A clash -d 192.168.0.0/16 -j RETURN
iptables -t mangle -A clash -d 169.254.0.0/16 -j RETURN
iptables -t mangle -A clash -d 224.0.0.0/4 -j RETURN
iptables -t mangle -A clash -d 240.0.0.0/4 -j RETURN

# 需代理的 IP 转向到 7893 端口，并打上 mark
iptables -t mangle -A clash -d 198.18.0.0/15 -p tcp -j TPROXY --on-port 7893 --tproxy-mark 666
iptables -t mangle -A clash -d 198.18.0.0/15 -p udp -j TPROXY --on-port 7893 --tproxy-mark 666

# 剩余流量正常处理
iptables -t mangle -A clash -j RETURN

# 最后让所有流量通过 clash 链进行处理
iptables -t mangle -A PREROUTING -j clash

# clash_local 链负责处理网关本身发出的流量
iptables -t mangle -N clash_local

# 跳过内网流量
iptables -t mangle -A clash_local -d 0.0.0.0/8 -j RETURN
iptables -t mangle -A clash_local -d 127.0.0.0/8 -j RETURN
iptables -t mangle -A clash_local -d 10.0.0.0/8 -j RETURN
iptables -t mangle -A clash_local -d 172.16.0.0/12 -j RETURN
iptables -t mangle -A clash_local -d 192.168.0.0/16 -j RETURN
iptables -t mangle -A clash_local -d 169.254.0.0/16 -j RETURN
iptables -t mangle -A clash_local -d 224.0.0.0/4 -j RETURN
iptables -t mangle -A clash_local -d 240.0.0.0/4 -j RETURN

# 为本机发出的流量打 mark
iptables -t mangle -A clash_local -p tcp -j MARK --set-mark 666
iptables -t mangle -A clash_local -p udp -j MARK --set-mark 666

# 让本机发出的流量跳转到 clash_local
# clash_local 链会为本机流量打 mark, 打过 mark 的流量会重新回到 PREROUTING 上
iptables -t mangle -A OUTPUT -j clash_local

# 修复 ICMP(ping)
# 这并不能保证 ping 结果有效 (clash 等不支持转发 ICMP), 只是让它有返回结果而已
# --to-destination 设置为一个可达的地址即可
sysctl -w net.ipv4.conf.all.route_localnet=1
iptables -t nat -A PREROUTING -p icmp -d 198.18.0.0/16 -j DNAT --to-destination 127.0.0.1
```

```shell
#!/usr/bin/env bash

set -ex

ip rule del fwmark 666 table 666 || true
ip route del local 0.0.0.0/0 dev lo table 666 || true

iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X clash || true
iptables -t mangle -X clash_local || true
```

iptables.shは前の記事とほぼ同じです。clashチェーンの最後だけを変え、198.18.0.0/15宛てを7893番のTPROXYポートへ転送し、それ以外は標準ルールに任せます。つまりメインルーターから転送されたFakeIP通信をsing-boxへ渡しています。clean.shは変更していません。

チェーン名のclashとclash_localはそのままにしました。Clashの構成を少し直しただけなので。手抜きです。

次はsing-boxの設定ファイルです。テンプレートを載せます。

```json
{
  "log": {
    "level": "info",
    "output": "box.log",
    "timestamp": true
  },
  "dns": {
    "servers": [
      {
        "tag": "cloudflare",
        "address": "tls://1.1.1.1",
        "detour": "🌍 外网" // 改为你的代理节点 tag
      },
      {
        "tag": "local",
        "address": "223.5.5.5",
        "detour": "DIRECT"
      },
      {
        "tag": "dns-fakeip",
        "address": "fakeip"
      },
      {
        "tag": "block",
        "address": "rcode://success"
      }
    ],
    "rules": [
      {
        "server": "block",
        "query_type": [
          "HTTPS",
          "SVCB"
        ]
      },
      {
        "server": "local",
        "outbound": "any"
      },
      {
        "server": "local",
        "rewrite_ttl": 10,
        "type": "logical",
        "mode": "and",
        "rules": [
          {
            "rule_set": [
              "geosite-geolocation-!cn"
            ],
            "invert": true
          },
          {
            "rule_set": [
              "geosite-cn",
              "geosite-category-companies@cn",
              "geoip-cn"
            ]
          }
        ]
      },
      {
        "server": "dns-fakeip",
        "rewrite_ttl": 1,
        "query_type": [
          "A",
          "AAAA"
        ]
      }
    ],
    "strategy": "ipv4_only",
    "fakeip": {
      "enabled": true,
      "inet4_range": "198.18.0.0/15"
    }
  },
  "inbounds": [
    {
      "type": "tproxy",
      "tag": "tproxy-in",
      "listen": "::",
      "listen_port": 7893,
      "tcp_fast_open": true,
      "udp_fragment": true,
      "sniff": true
    },
    {
      "type": "mixed",
      "tag": "mixed-in",
      "listen": "::",
      "listen_port": 7890,
      "tcp_fast_open": true,
      "udp_fragment": true,
      "sniff": true
    },
    {
      "type": "direct",
      "tag": "dns-in",
      "listen": "::",
      "listen_port": 1053
    }
  ],
  "outbounds": [
    {
      "type": "direct",
      "tag": "DIRECT"
    },
    {
      "type": "block",
      "tag": "REJECT"
    },
    {
      "type": "dns",
      "tag": "dns-out"
    },
    // 此处填写你的代理节点
  ],
  "route": {
    "rules": [
      {
        "inbound": "dns-in",
        "outbound": "dns-out"
      },
      {
        "protocol": "dns",
        "outbound": "dns-out"
      },
      {
        "outbound": "DIRECT",
        "type": "logical",
        "mode": "and",
        "rules": [
          {
            "rule_set": [
              "geosite-geolocation-!cn"
            ],
            "invert": true
          },
          {
            "rule_set": [
              "geosite-cn",
              "geosite-category-companies@cn",
              "geoip-cn"
            ]
          }
        ]
      }
    ],
    "rule_set": [
      {
        "type": "remote",
        "tag": "geoip-cn",
        "format": "binary",
        "url": "https://cdn.jsdelivr.net/gh/SagerNet/sing-geoip@rule-set/geoip-cn.srs",
        "download_detour": "DIRECT"
      },
      {
        "type": "remote",
        "tag": "geosite-cn",
        "format": "binary",
        "url": "https://cdn.jsdelivr.net/gh/SagerNet/sing-geosite@rule-set/geosite-cn.srs",
        "download_detour": "DIRECT"
      },
      {
        "type": "remote",
        "tag": "geosite-geolocation-!cn",
        "format": "binary",
        "url": "https://cdn.jsdelivr.net/gh/SagerNet/sing-geosite@rule-set/geosite-geolocation-!cn.srs",
        "download_detour": "DIRECT"
      },
      {
        "type": "remote",
        "tag": "geosite-category-companies@cn",
        "format": "binary",
        "url": "https://cdn.jsdelivr.net/gh/SagerNet/sing-geosite@rule-set/geosite-category-companies@cn.srs",
        "download_detour": "DIRECT"
      }
    ],
    "final": "🌍 外网", // 改为你的代理节点 tag
    "auto_detect_interface": true
  },
  "experimental": {
    "clash_api": {
      "external_controller": "0.0.0.0:9090",
      "external_ui": "yacd",
      "external_ui_download_url": "https://github.com/MetaCubeX/Yacd-meta/archive/gh-pages.zip",
      "external_ui_download_detour": "🌍 外网", // 改为你的代理节点 tag
      "default_mode": "Rule"
    }
  }
}
```

コメントで示した箇所を変更してください。標準設定では、中国のドメインを223.5.5.5で直接RealIPに解決し（DNS-rules\[2\]）、ほかのドメインはFakeIPにします（DNS-rules\[3\]）。通信は中国のIPとドメインをDIRECTで直接接続し（route-rules\[2\]）、それ以外をプロキシへ流します（route-final）。

すべて設定したら、sing-boxを自動起動にし、その場で起動します。

```shell
systemctl enable --now sing-box
```

ログはDebian標準のツールで確認できます。

```shell
journalctl -efu sing-box
```

sing-boxにはClash互換APIがあるので、ClashのWeb UIで管理できます。起動後、UIのダウンロードが終わるまで少し待てば、9090番ポートでyacdを開けます。

#### Telegramの問題

欠点も明確です。DNSに基づく振り分けなので、DNSを使わずIPを直接指定する通信はメインルーターから直接出てしまい、Telegramのようなアプリを正しく振り分けられません。解決策は簡単で、そのIPをメインルーターのネクストホップのIPリスト、iptables.shの転送リスト、sing-box設定のrulesへ追加し、プロキシ経由に指定します。

現在は、ルールセット内のIPを自動処理し、対応するIPリスト、iptables.sh、そのままsing-boxで使えるconfig.jsonを生成するスクリプトを自作して使っています。もう少し整えて個人情報を除いたら公開する予定です。お楽しみに。
