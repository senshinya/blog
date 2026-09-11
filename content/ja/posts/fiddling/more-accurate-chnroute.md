---
authorship: human-only
title: "BGPで中国国内・国外IPの振り分けをより正確にする"
seoTitle: "BGP データで中国向け IP ルーティングルールを改善する"
description: "BGPをもとに中国国内・国外のIPを振り分けることで、透過プロキシの効率と精度を高めます。国外の宛先をFakeIPで識別すれば、メインルーターでより適切に通信を振り分けられます。sing-boxのDNS設定も見直し、DNSクエリを柔軟かつ効率的に処理して、ネットワーク全体の使い勝手を改善します。"
date: 2024-10-07 16:51:00
categories: [fiddling]
tags: ["試行錯誤", "ソフトウェアルーター", "透過プロキシ", "トラフィック振り分け", "BGP"]
image: "https://blog-img.774352199.xyz/MOmM1s.webp"
seoDescription: "ドメインやGeoIPによる振り分けの精度を見直し、BGP由来の中国IPリストを採用。Bash、ipset、iptablesで通信を振り分け、リストを定期更新する構成を説明します。"
---

これまで[Debianをサイドルーターにする](/ja/fiddling/debian-as-bypass-router)と[FakeIPを使った透過プロキシの振り分け](/ja/fiddling/fake-ip-based-transparent-proxy)の2回にわたって試し、自宅の透過プロキシはひとまず使える状態になりました。FakeIP方式では、国外のIPをFakeIPで識別し、メインルーターでそれを判別して振り分けます。sing-boxのDNSモジュールの設定は次のとおりです。

```json
{
  "dns": {
    "servers": [
      ...
    ],
    "rules": [
      ...
      {
        "server": "local",
        "rewrite_ttl": 10,
        "type": "logical",
        "mode": "and",
        "rules": [
          {
            "rule_set": [
              "geosite-geolocation-!cn" // [!code highlight]
            ],
            "invert": true
          },
          {
            "rule_set": [
              "geosite-cn", // [!code highlight]
              "geosite-category-companies@cn", // [!code highlight]
              "geoip-cn" // [!code highlight]
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
  }
}
```

このDNS振り分けはルールセットに基づいています。まず、ドメインが`geosite-geolocation-!cn`に含まれないことが条件です。そのうえで、ドメインが`geosite-cn`または`geosite-category-companies@cn`に含まれるか、名前解決後のIPが`geoip-cn`に含まれていれば、中国国内向けと判断してRealIPを返します。それ以外はFakeIPを返します。

この判定はかなり大ざっぱです。ドメインのルールセットがよく使われるドメインしか網羅していないことに加え、IPルールセットの`geoip-cn`はMaxMindのGeoLite2、元をたどればWHOISのデータに基づいています。多くの場合、わかるのはどの組織がIPを登録したかだけで、実際にどこで使われているかはわかりません。特にCN-IPの精度はかなり怪しいです。

ちょうど最近BGPを知ったので、解説を少し拝借します。

> Border Gateway Protocol（BGP）は、ルーティングドメイン間でNetwork Layer Reachability Information（NLRI、ネットワーク層到達可能性情報）を交換するルーティングプロトコルです。各ドメインは異なる組織が管理するため、一般にAutonomous System（AS、自律システム）と呼ばれます。現在のインターネットは複数のASを相互接続した巨大なネットワークであり、BGPはインターネットの外部ルーティングプロトコルの事実上の標準として、ISP（インターネットサービスプロバイダー）間で広く使われています。

BGPでは、中国へ向かう通信の経路は中国国内のASが広報します。国内のすべてのASが広報するIPリストを集めれば、より正確なCN-IPリストになるはずです。

> 中国のネットワーク事情とWikipediaの情報によれば、グローバルインターネットと直接BGPセッションを確立できるのは、三大通信事業者、教育ネットワーク、科学技術ネットワークのみです。

自分でASを運用して完全なBGPテーブルを取得する解説はたくさんあります。ただ、面倒くさがりで他人の成果をありがたく使いたい私は、GitHubにBGPベースのCN-IPリストがすでにいくつもあるのを見つけました。今回はこのプロジェクトを使います：https://github.com/gaoyifan/china-operator-ip/blob/ip-lists/china.txt

リストが手に入ったので、ここからはコードの時間です！

```bash
#!/bin/bash

# 定义变量
URL="https://raw.githubusercontent.com/gaoyifan/china-operator-ip/refs/heads/ip-lists/china.txt"
IPSET_NAME="allowed_ips"

# 下载新的 IP 列表
curl -o /tmp/ip-list.txt "$URL" || { echo "下载 IP 列表失败"; exit 1; }

# 清空现有的 ipset 集合
ipset flush $IPSET_NAME

# 重新创建 ipset 集合（如果不存在则创建）
ipset create $IPSET_NAME hash:net -exist

# 添加局域网地址到集合
ipset add $IPSET_NAME 0.0.0.0/8
ipset add $IPSET_NAME 127.0.0.0/8
ipset add $IPSET_NAME 10.0.0.0/8
ipset add $IPSET_NAME 172.16.0.0/12
ipset add $IPSET_NAME 192.168.0.0/16
ipset add $IPSET_NAME 169.254.0.0/16
ipset add $IPSET_NAME 224.0.0.0/4
ipset add $IPSET_NAME 240.0.0.0/4

# 读取 IP 列表并添加到 ipset 集合
while IFS= read -r ip
do
    # 如果行为空或注释行，则跳过
    if [ -z "$ip" ] || [[ $ip == \#* ]]; then
        continue
    fi
    ipset add $IPSET_NAME $ip
done < /tmp/ip-list.txt

# 清理临时文件
rm /tmp/ip-list.txt

# 创建自定义链
iptables -t mangle -N NO_FORWARD

# 配置 iptables：将流量引导到自定义链，并基于逻辑规则返回或标记
iptables -t mangle -A PREROUTING -j NO_FORWARD

# 在自定义链中配置规则
iptables -t mangle -A NO_FORWARD -s 192.168.7.2 -j RETURN
iptables -t mangle -A NO_FORWARD -m set --match-set $IPSET_NAME dst -j RETURN
iptables -t mangle -A NO_FORWARD -j MARK --set-mark 1

# 设置路由以标记的流量转发到 192.168.7.2
ip rule add fwmark 1 table 100
ip route add default via 192.168.7.2 table 100
```

コードに詳しくコメントを書いてあるので、細かな説明は省きます。

ルーターがOpenWrtなら、bash、ipset、iptablesなどを追加でインストールしてください。OpenWrtの標準シェルはashなので、このスクリプトは実行できません。

```bash
opkg update
opkg install bash
opkg install curl
opkg install ipset
opkg install iptables
```

このCN-IPリストは1日1回更新されます。スクリプトを毎日実行する定期タスクを設定し、起動時にも実行するようにしておくとよいです。
