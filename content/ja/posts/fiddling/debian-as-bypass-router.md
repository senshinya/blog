---
authorship: human-only
title: "Debianをサイドルーターにする"
seoTitle: "Debian サブゲートウェイ：mihomo・AdGuard Home と透過プロキシ"
description: "Debianをサイドルーターに使うと、OpenWrtやLuCIに依存せず、より安定した柔軟な構成を作れます。Debianを直接設定することでシステムを細かく制御でき、GUIの制約や不安定さを避けられます。一般的なサイドルーター構成と比べて透過プロキシを安定して運用しやすく、性能や効率を重視する場合の選択肢になります。"
date: 2024-07-13 17:49:00
categories: [fiddling]
tags: ["Debian","サイドルーター","mihomo","AdGuard Home","透過プロキシ"]
image: "https://blog-img.774352199.xyz/pPRU5x.webp"
seoDescription: "Debianの小型PCをサイドルーターにし、AdGuard HomeとmihomoでDNS振り分けと透過プロキシを構成。サブネット、iptables、systemdの設定を示します。"
---

### はじめに

サイドルーター構成の多くは、独自のパッケージシステムを持つLinuxディストリビューション、OpenWrtを使っています。さらにその大半が、OpenWrt専用のWeb GUIであるLuCIを前提にし、解説でもLuCI向けのluci-app-xxxを使っています。よい方法ではありますが、まだ物足りません。

1. GUIへの依存が強すぎます。LuCIパッケージのWeb画面で設定できる項目はたいてい限られています。
2. LuCIが十分に安定していません。OpenWrt自体ではなくLuCIの話です。私の環境ではOpenClashが原因でLuCIが3回落ちました。私の問題かもしれませんが。
3. OpenWrtは自分でビルドできますが、多くの解説はビルド済みのファームウェアをそのまま使い、中には古いものもあります。
4. システムを完全には掌握できません。LuCIに実権を握られています。

私も1、2年ほどOpenWrtの透過プロキシをいじり、メインルーター構成もサイドルーター構成も試しましたが、結局は安定性に不満があってやめました。その後しばらくはSurge、Loon、Clash Verge Revなどのクライアントで何とかしのいでいました。1週間ほど前にゼンレスゾーンゼロがリリースされましたが、中国国内版の認可の関係でPS5は国際版のみ。アジアサーバーならかろうじて直接接続できても、速度と遅延は絶望的でした。NetEase UUにお金を払いたくない一心で、透過プロキシをまた思い出しました。ちょうどDebianを入れたまま遊んでいるBeelinkの小型PCがありました。開発用にするつもりが、面倒くさがってほこりをかぶらせていたものです。週末を費やして、ようやくDebianをサイドルーターにした透過プロキシ構成が完成しました。

完成したネットワーク構成は次のとおりです。

![topo](https://blog-img.774352199.xyz/2025/c4347103c787f3d28b50a679e80aa0fe.png)

LANを192.168.6.0/24と192.168.7.0/24の2つに分けています。6.0/24は検閲回避が不要な端末用の標準サブネットです。必要な端末は7.0/24に置き、通信をすべてサイドルーターの小型PC経由で転送します。

中心となるのはAdGuard Home + Clashです。AdGuard Homeが広告フィルタリングなどを担当し、ClashがDNSの振り分けと通信のプロキシを担当します。

### メインルーターの設定

現在のLANは192.168.6.0/24なので、新たに192.168.7.0/24を追加します。

メインルーターはiKuaiなので、以下はiKuaiでサブネットを追加する方法です。OpenWrtなどの場合は検索してください。

iKuaiのネットワーク設定 → 内外ネットワーク設定 → lan1を開き、詳細設定で拡張IPを追加します。IPは192.168.7.1、サブネットマスクは255.255.255.0です。

![iKuaiの設定](https://blog-img.774352199.xyz/2025/9fc87b145274f1fb0cba1ed0d2329ac0.png)

DHCP設定で192.168.7.0/24用の設定を追加します。

![DHCPの設定](https://blog-img.774352199.xyz/2025/2de91498b256d08c92a3c8844ca14dbe.png)

ゲートウェイは、あとで設定するサイドルーターのアドレス192.168.7.2にします。このサブネットのDNSはすべてサイドルーターで処理するので、優先DNSと代替DNSも両方192.168.7.2にします。

### Debianの設定

特に断りがなければ、以下の操作はサイドルーター上で行います。

#### IPアドレスの設定

`sudo nano /etc/network/interfaces`でDebianのネットワーク設定を開き、次の内容に編集して保存・終了します。

```
# This file describes the network interfaces available on your system
# and how to activate them. For more information, see interfaces(5).

source /etc/network/interfaces.d/*

# The loopback network interface
auto lo
iface lo inet loopback

# The primary network interface
allow-hotplug enp1s0
iface enp1s0 inet static
address 192.168.7.2
netmask 255.255.255.0
gateway 192.168.7.1
dns-nameservers 127.0.0.1
```

この設定では、次の点に注意してください。
- `enp1s0`は私のネットワークインターフェース名です。`ip a`で確認して、自分のものに置き換えてください。
- IPv4は`inet static`で固定し、アドレスを`192.168.7.2/24`、ゲートウェイをメインルーターの`192.168.7.1`にします。設定中にインターネットへ接続できなくならないよう、DNSは最初は利用可能なサーバーを指定し、ローカルのAdGuard Homeが設定できてから`127.0.0.1`へ変更します。

保存したら、次のコマンドでネットワークを再起動できます。

```shell
sudo systemctl restart networking.service
```

IPアドレスが変わるので、SSH接続が切れることがあります。新しいIPの`192.168.7.2`にSSHで接続し直してください。

`ip a`で設定結果を確認します。

```shell
ip a
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host noprefixroute
       valid_lft forever preferred_lft forever
2: enp1s0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000
    link/ether 70:70:fc:00:e3:36 brd ff:ff:ff:ff:ff:ff
    inet 192.168.7.2/24 brd 192.168.7.255 scope global enp1s0
       valid_lft forever preferred_lft forever
    inet6 ■■■:■■■■:■■■■:■■■:■■■■:■■■■/64 scope global dynamic mngtmpaddr
       valid_lft 1741sec preferred_lft 1741sec
    inet6 fe80::7270:fcff:fe00:e336/64 scope link
       valid_lft forever preferred_lft forever
```

LAN内のIPアドレスが192.168.7.2/24になりました。

#### 転送の設定

ルーターやゲートウェイとして動作するには、通信の転送機能が必要です。

```shell
sudo echo "net.ipv4.ip_forward = 1" >> /etc/sysctl.conf
sudo sysctl -p
```

### AdGuard Homeの設定

DNSの構成を説明します。

![DNSの経路](https://blog-img.774352199.xyz/2025/bb62d86943fdce26364eea909c4621a9.png)

クライアントが名前解決すると、53番ポートのAdGuard Homeが上流のClashへクエリを転送します。Clashは設定に従って振り分け、中国本土向けは中国国内のパブリックDNS、それ以外はプロキシ経由で中国国外のパブリックDNSに問い合わせます。

Clashに異常があると、AdGuard Homeは中国国内のパブリックDNSへ直接問い合わせます。ただ、名前解決できても通信はClashを通る必要があるので、実際にはあまり意味がありません。

#### AdGuard Homeのインストール

以下はrootで実行します。

```shell
## 检查最新稳定版的版本号，如果获取不到请检查网络
remote_ver=$(curl -sS https://api.github.com/repos/AdguardTeam/AdGuardHome/releases/latest | jq -r .tag_name | sed 's|v||' | grep -v "null"); echo $remote_ver

## 下载最新稳定版（前一句有输出这一句才能正常执行）
cd /tmp
wget -q --progress=bar:dot --show-progress -O "AdGuardHome_linux_amd64.tar.gz" "https://github.com/AdguardTeam/AdGuardHome/releases/download/v${remote_ver}/AdGuardHome_linux_amd64.tar.gz"

## 解压
tar --no-same-owner -xf "AdGuardHome_linux_amd64.tar.gz" --strip-components 2 --directory=.

## 安装
install -ps AdGuardHome /usr/local/bin/adguardhome
```

#### サービスの作成

作業ディレクトリ`/var/lib/adguardhome`を作成します。

```shell
mkdir -p /var/lib/adguardhome
```

次の内容で`/etc/systemd/system/adguardhome.service`を作成します。設定ファイルは`/var/lib/adguardhome/AdGuardHome.yaml`になります。

```ini
[Unit]
Description = Network-wide ads & trackers blocking DNS server.
Wants       = network-online.target mosdns.service
After       = network-online.target mosdns.service

[Service]
Type               = simple
Restart            = always
StartLimitInterval = 5
StartLimitBurst    = 10
ExecStart          = /usr/local/bin/adguardhome -w /var/lib/adguardhome
RestartSec         = 10

[Install]
WantedBy = multi-user.target
```

保存後、`systemctl enable --now adguardhome.service`で自動起動を有効にし、その場で起動します。ログはDebian標準のツールで確認できます。

```shell
journalctl -efu adguardhome.service
```

再起動する場合はこちらです。

```shell
systemctl restart adguardhome.service
```

#### 初期設定

`http://192.168.7.2:3000`で初期設定を開きます。Web管理画面のポートは3000のままでよく、DNSサーバーのポートは53にします。

設定 → DNS設定で、上流DNSをまだ設定していないClashの`127.0.0.1:1053`にします。フォールバックDNSには中国国内のDNSをいくつか指定できます。たとえば次のとおりです。

```
223.5.5.5
119.29.29.29
```

適用を忘れずにクリックしてください。

続いてDNSサービス設定 → レート制限を0にします。

広告をブロックするなら、フィルター → DNSブロックリストから追加します。中国本土で使いやすいルールセットを2つ紹介します。

```
easylist:  https://anti-ad.net/easylist.txt
half-life: https://adguard.yojigen.tech/HalfLifeList.txt
```

### Clashの設定

Clashは中国国内・国外のDNS解決の振り分けと、本業の検閲回避を担当します。元のClashはリポジトリが削除され、開発者も姿を消したため、その後をMihomoが継ぎました。（miHoYoめ、何もかもお前のせいだ。）

#### Clashのインストール

以下はrootで実行します。

```shell
## 检查最新稳定版的版本号，如果获取不到请检查网络
remote_ver=$(curl -sS https://api.github.com/repos/MetaCubeX/mihomo/releases/latest | jq -r .tag_name | sed 's|v||' | grep -v "null"); echo $remote_ver

## 下载最新稳定版（前一句有输出这一句才能正常执行）
cd /tmp
wget -q --progress=bar:dot --show-progress -O "mihomo-linux-amd64-v${remote_ver}.gz" "https://github.com/MetaCubeX/mihomo/releases/download/v${remote_ver}/mihomo-linux-amd64-v${remote_ver}.gz"

## 解压
gzip -d "mihomo-linux-amd64-v${remote_ver}.gz"

## 安装
install -ps mihomo-linux-amd64-v${remote_ver} /usr/local/bin/clash
```

#### サービスの作成

作業ディレクトリ`/var/lib/clash`を作成します。

```shell
mkdir -p /var/lib/clash
```

clashユーザーを作成します。

```shell
useradd -M -s /usr/sbin/nologin clash
```

次の内容で`/etc/systemd/system/clash.service`を作成します。Clashの設定ファイルは`/var/lib/clash/config.yaml`です。

```ini
[Unit]
Description = Clash-Meta tproxy daemon.
Wants       = network-online.target
After       = network-online.target

[Service]
Environment   = PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/b>
Type          = simple
User          = clash
Group         = clash

CapabilityBoundingSet = CAP_NET_ADMIN CAP_NET_BIND_SERVICE CAP_NET_RAW
AmbientCapabilities   = CAP_NET_ADMIN CAP_NET_BIND_SERVICE CAP_NET_RAW

Restart       = always
ExecStartPre  = +/usr/bin/bash /var/lib/clash/clean.sh
ExecStart     = clash -d /var/lib/clash
ExecStartPost = +/usr/bin/bash /var/lib/clash/iptables.sh

ExecStopPost  = +/usr/bin/bash /var/lib/clash/clean.sh
```

このファイルのとおり、Clashバイナリはclash:clashとして実行します。Clash自身が生成する通信と、Clashが転送する通信を区別しやすくするためです。

ExecStartPostとExecStopPostではiptables.shとclean.shを実行し、ルーティングルールの設定と消去を行っています。

iptables.shとclean.shの内容は次のとおりです。

```sh
#!/usr/bin/env bash

set -ex

# ENABLE ipv4 forward
sysctl -w net.ipv4.ip_forward=1

# ROUTE RULES
ip rule add fwmark 666 lookup 666
ip route add local 0.0.0.0/0 dev lo table 666

# clash 链负责处理转发流量
iptables -t mangle -N clash

# 目标地址为局域网或保留地址的流量跳过处理
# 保留地址参考：https://zh.wikipedia.org/wiki/%E5%B7%B2%E5%88%86%E9%85%8D%E7%9A%84/8_IPv4%E5%9C%B0%E5%9D%80%E5%9D%97%E5%88%97%E8%A1%A8
iptables -t mangle -A clash -d 0.0.0.0/8 -j RETURN
iptables -t mangle -A clash -d 127.0.0.0/8 -j RETURN
iptables -t mangle -A clash -d 10.0.0.0/8 -j RETURN
iptables -t mangle -A clash -d 172.16.0.0/12 -j RETURN
iptables -t mangle -A clash -d 192.168.0.0/16 -j RETURN
iptables -t mangle -A clash -d 169.254.0.0/16 -j RETURN

iptables -t mangle -A clash -d 224.0.0.0/4 -j RETURN
iptables -t mangle -A clash -d 240.0.0.0/4 -j RETURN

# 其他所有流量转向到 7893 端口，并打上 mark
iptables -t mangle -A clash -p tcp -j TPROXY --on-port 7893 --tproxy-mark 666
iptables -t mangle -A clash -p udp -j TPROXY --on-port 7893 --tproxy-mark 666

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

# 跳过 clash 程序本身发出的流量，防止死循环 (clash 程序需要使用 "clash" 用户启动)
iptables -t mangle -A OUTPUT -p tcp -m owner --uid-owner clash -j RETURN
iptables -t mangle -A OUTPUT -p udp -m owner --uid-owner clash -j RETURN

# 让本机发出的流量跳转到 clash_local
# clash_local 链会为本机流量打 mark, 打过 mark 的流量会重新回到 PREROUTING 上
iptables -t mangle -A OUTPUT -j clash_local

# 修复 ICMP(ping)
# 这并不能保证 ping 结果有效 (clash 等不支持转发 ICMP), 只是让它有返回结果而已
# --to-destination 设置为一个可达的地址即可
sysctl -w net.ipv4.conf.all.route_localnet=1
iptables -t nat -A PREROUTING -p icmp -d 198.18.0.0/16 -j DNAT --to-destination 127.0.0.1
```

```sh
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

各行に詳しいコメントを書いてあります。さらに知りたければChatGPTに聞いてください。

#### Clashの設定ファイル

Clashの設定ファイルは各プロキシサービスから入手でき、形式はYAMLのはずです。`/var/lib/clash/config.yaml`へ保存し、次の部分を変更します。

```yaml
tproxy-port: 7893   # iptables.sh 将所有流量转发到了 7893 端口
mixed-port: 7890
allow-lan: true
find-process-mode: off
bind-address: "*"
mode: rule
log-level: debug
ipv6: false # 不进行 IPv6 流量代理

external-controller: 0.0.0.0:9090
secret: # 登陆 ui 的密码
external-ui: ui # webui 的基础路径
external-ui-name: xd # webui 的下级路径
external-ui-url: https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip
unified-delay: true
tcp-concurrent: true
experimental:
  sniff-tls-sni: true
geodata-mode: true
geodata-loader: standard
geox-url:
  geoip: https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat
  geosite: https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat
  mmdb: https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/country.mmdb
profile:
  tracing: true
  store-selected: true
  store-fake-ip: true
sniffer:
  enable: true
  parse-pure-ip: true
  override-destination: true

dns:
  enable: true
  ipv6: false
  listen: 0.0.0.0:1053 # DNS 监听端口
  use-hosts: true
  enhanced-mode: fake-ip
  default-nameserver: # 建议修改为国内 DNS 服务器
    - 223.5.5.5
    - 119.29.29.29
  nameserver:
    - https://doh.pub/dns-query
    - tls://dot.pub
    - tls://dns.alidns.com
    - https://dns.alidns.com/dns-query
  fallback:
    - https://dns.cloudflare.com/dns-query
    - tls://dns.google:853
    - https://1.1.1.1/dns-query
    - tls://1.1.1.1:853
    - tls://8.8.8.8:853
  fake-ip-filter:
    - '+.lan'
    - '+.cluster.local'
    - 'time.*.com'
    - 'time.*.gov'
    - 'time.*.edu.cn'
    - 'time.*.apple.com'
    - 'ntp.*.com'
    - 'localhost.ptlogin2.qq.com'
    - '+.ntp.org.cn'
    - '+.pool.ntp.org'
    - '+.localhost'
  fallback-filter:
    geoip: true
    geoip-code: CN
    geosite:
      - gfw
    ipcidr:
      - 224.0.0.0/4
      - 240.0.0.0/4
      - 169.254.0.0/16
      - 0.0.0.0/8
      - 127.0.0.1/32
    domain:
      - '+.google.com'
      - '+.facebook.com'
      - '+.youtube.com'

proxies:  # 以下为你的代理节点、分组及代理规则
proxy-groups:
rules:
```

DNS部分を少し詳しく説明します。DNSサーバーは2つのグループに分かれています。
- nameserverは中国国内のパブリックDNSです。
- fallbackは中国国外のパブリックDNSです。

fallback-filterは、どの条件でfallback側の名前解決結果を使うかを決めます。
- geoip-codeは否定条件です。nameserverの結果がgeoip-codeに一致しない場合、fallbackの結果を使います。
- geositeは肯定条件で、一致するドメインはfallbackを使います。
- ipcidrは肯定条件です。nameserverがこれらの汚染されたIPを返す場合、fallbackを使います。
- domainは肯定条件で、一致するドメインは直接fallbackを使います。

これでDNS解決の振り分けができました。

#### Clashの関連ファイル

Clashには関連ファイルも必要なので、起動前にダウンロードします。

```shell
cd /var/lib/clash
wget -q --progress=bar:dot --show-progress -O country.mmdb https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/country.mmdb
wget -q --progress=bar:dot --show-progress -O geosite.dat  https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat
wget -q --progress=bar:dot --show-progress -O GeoIP.dat    https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.dat

mkdir -p ui
cd ui
wget -q --progress=bar:dot --show-progress -O xd.zip https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip
unzip -oqq xd.zip
mv metacubexd-gh-pages xd
```

最終的な`/var/lib/clash`は次のようになります。

```shell
/var/lib/clash
├── clean.sh
├── config.yaml
├── country.mmdb
├── GeoIP.dat
├── geosite.dat
├── iptables.sh
└── ui
```

Clashはclashユーザーで起動するので、所有者を変更します。

```shell
chown -R clash:clash /var/lib/clash
```

iptables.shとclean.shに実行権限も付けます。

```shell
chmod +x iptables.sh
chmod +x clean.sh
```

#### サービスの起動

設定がすべて終わったら、`/etc/systemd/system/clash.service`を自動起動にし、その場で起動します。

```shell
systemctl enable --now clash.service
```

ログを見るにはDebian標準のツールを使います。

```shell
journalctl -efu clash.service
```

Web UIはこちらです：`http://192.168.7.2:9090/ui/xd`。

Web UIの設定は皆さんおなじみだと思います。問題なく動いたら、先述のとおりこのマシンのDNSを127.0.0.1に変更し、LAN内の端末のゲートウェイとDNSを両方192.168.7.2へ向けます。

### ポート転送

メインルーターにポート転送を設定していて、転送先マシンがサイドルーターをゲートウェイにしている場合、転送が効かなくなっているはずです。解決方法は[サイドルーター環境でポート転送が効かない問題を解決する](/ja/fiddling/fix-port-forward-in-bypass-router)を参照してください。
