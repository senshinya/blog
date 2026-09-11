---
authorship: human-only
title: "OPNsenseで透過プロキシとトラフィック振り分けを実現する"
description: "OPNsenseは、美しい画面と充実した機能を備えるオープンソースのファイアウォール・ルーターです。いくつかの構成を試した末に、透過プロキシやトラフィック振り分けでの可能性に気づきました。BGPベースの振り分けと組み合わせることで安全性と安定性を高められ、IPリストの自動更新で管理もしやすくなります。"
date: 2025-01-16 23:09:00
categories: [fiddling]
tags: ["OPNsense","FreeBSD","mihomo","tun2socks","透過プロキシ","トラフィック振り分け"]
image: "https://blog-img.774352199.xyz/xA8C1E.webp"
seoDescription: "OPNsenseにmihomo、AdGuard Home、tun2socksを組み込み透過プロキシを構築。IPリストを使うファイアウォール規則とDNS転送、サービス起動を設定します。"
---

### はじめに

以前は、iKuaiをメインルーター、OpenWrtをサイドルーターにして透過プロキシと振り分けを行っていました。ネット上の解説でも主流の構成です。その後、iKuaiが[裏で勝手に通信したり情報を送信したりする可能性](https://wusiyu.me/2022-ikuai-non-cloud-background-activities/)を知りました。中国製のクローズドソースOSという点でも、安全性に不安がありました。

その後、[OpenWrtをメインルーター、Debianをサイドルーターにする構成](/ja/fiddling/debian-as-bypass-router)へ移りました。さらにサイドルーター方式をやめ、[FakeIPベースの振り分け](/ja/fiddling/fake-ip-based-transparent-proxy)、[BGPベースの振り分け](/ja/fiddling/more-accurate-chnroute)を順に試し、最終的にBGP方式に落ち着きました。

最近、OPNsenseというファイアウォール・ルーターOSを知りました。まさに理想のルーターOSです。無料でオープンソース、画面もきれいで機能も充実し、振り分け用IPリストの自動更新までGUIで設定できます。今の構成を移し、検閲回避用のソフトウェアルーターを別に置かず、Clashもメインルーターへ直接統合することにしました。

調べても関連する解説は少なく、古くて動かないものもありました。いくつか落とし穴にはまったので、詳しい手順をまとめることにしました。

実現したい機能は次のとおりです。
- DNSをClashへ転送して一括で名前解決する。
- OPNsenseに入った通信をリストに基づいて振り分け、一部をClashへ送る。

OPNsense本体のインストールは、ネット上に説明が多いので省略します。
### Clashのインストール

#### バイナリと設定ファイル

DNS解決も通信の処理もClashに依存するので、まずClashを入れます。

OPNsenseへSSHで接続します。SSHを有効にする方法？ そこは自分でググってください（STFW）。バイナリ、設定、関連ファイルを置く`/usr/local/clash`を作成します。まだメインルーターで検閲回避できず直接ダウンロードが遅いので、バイナリはscpで送るのがおすすめです。バイナリと設定をこのディレクトリへアップロードし、名前をそれぞれclashと`config.yaml`にします。

Mihomoの[Releases](https://github.com/MetaCubeX/mihomo/releases)から最新コアを入手します。FreeBSD版を選び、マシンに合わせて386、amd64、arm64を選択してください。amd64で後ほどClashを実行した際に次のエラーが出たら、`amd64-compatible`版を使います。

```shell
This PROGRAM can only be run on _AMD64 processors with v3 microarchitecture_ support.
```

設定ファイルは普段使っているものでかまいませんが、次の部分を変更してください。

```yaml
mixed-port: 7890

dns:
  listen: 127.0.0.1:5353

tun:
  enable: false
```

DNSは5353番で待ち受け、OPNsense標準DNSの上流にします。またTUNを無効にし、Clash自身は通信を取り込まず、OPNsenseが選別して渡すようにします。mixed-portはSOCKS、HTTP、HTTPSプロキシの機能を兼ねます。

`pw user add clash -c "Clash" -s /usr/sbin/nologin`でログイン不可のclashユーザーを作り、`chown clash:clash /usr/local/clash`でディレクトリの所有権を与えます。その後`/usr/local/clash/clash -d /usr/local/clash`を実行し、正常に動くか確認します。

#### Clashのサービス登録

`/usr/local/etc/rc.d/clash`と`/usr/local/opnsense/service/conf/actions.d/actions_clash.conf`を作り、Clashをシステムサービスとして登録します。

```shell
#!/bin/sh
# $FreeBSD$

# PROVIDE: clash
# REQUIRE: LOGIN cleanvar
# KEYWORD: shutdown

# Add the following lines to /etc/rc.conf to enable clash:
# clash_enable (bool): Set to "NO" by default.
# Set to "YES" to enable clash.
# clash_config (path): Clash config dir.
# Defaults to "/usr/local/etc/clash"

. /etc/rc.subr

name="clash"
rcvar=clash_enable

load_rc_config $name

: ${clash_enable:="NO"}
: ${clash_config="/usr/local/clash"}

command="/usr/local/clash/clash"
#pidfile="/var/run/clash.pid"
required_files="${clash_config}"
clash_group="clash"
clash_user="clash"

command_args="-d $clash_config"

run_rc_command "$1"
```

```
[start]
command:/usr/local/etc/rc.d/clash onestart
type:script
message:starting clash

[stop]
command:/usr/local/etc/rc.d/clash stop
type:script
message:stoping clash

[status]
command:/usr/local/etc/rc.d/clash statusexit 0
type:script_output
message:get clash status

[restart]
command:/usr/local/etc/rc.d/clash onerestart
type:script
message:restarting clash
```

`chmod +x /usr/local/etc/rc.d/clash`で実行権限を付け、`service configd restart`で有効にします。

#### Clashの自動起動

次はClashの自動起動ですが、落とし穴があります。

> Clashをシステムサービスとして起動しても、起動後にバックグラウンドへ移る機能がありません。そのため再起動時にClashまで進むと止まってしまい、フォアグラウンドに居続けるClashの後ろにあるサービスが起動できません。

回り道ですが、OPNsense標準の監視機能MonitでClashを起動・監視する方法があります。`サービス → Monit`で有効にします。

Service Test Settingsにテストを2つ追加します。1つ目はClashを起動するためです。

| Setting   | Value                                    |
| --------- | ---------------------------------------- |
| Name      | Clash                                    |
| Condition | failed host 127.0.0.1 port 7890 type tcp |
| Action    | Restart                                  |

2つ目は再起動ループを防ぐためです。

| Setting   | Value                      |
| --------- | -------------------------- |
| Name      | RestartLimit4              |
| Condition | 5 restarts within 5 cycles |
| Action    | Unmonitor                  |

最後にService Settingsで次を追加します。

| Setting | Value                                 |
| ------- | ------------------------------------- |
| Name    | Clash                                 |
| Match   | clash                                 |
| Start   | /usr/local/sbin/configctl clash start |
| Stop    | /usr/local/sbin/configctl clash stop  |
| Tests   | Clash,RestartLimit4                   |

保存して少し待ち、Monit → StatusでClashが正常に動いているか確認します。

### DNS解決

OPNsense標準のUnbound DNSで上流をClashの127.0.0.1:5353にしたところ、名前解決がずっと失敗しました。何とも不思議です。

どうしても原因がわからず、結局Unbound DNSを止め、AdGuard Homeを標準DNSに戻して53番ポートを使わせました。

AdGuard HomeはOPNsense標準のプラグインリポジトリにないので、コミュニティリポジトリを手動で追加します。

OPNsenseにSSHで入り、次を実行します。

```shell
$ fetch -o /usr/local/etc/pkg/repos/mimugmail.conf https://www.routerperformance.net/mimugmail.conf
$ pkg update
```

Web GUIのシステム → ファームウェア → プラグインでadguardを検索し、os-adguardhome-maxitをインストールします。サービス → Adguardhomeから有効にできます。管理画面は3000番です。初期設定は省きますが、DNSの待受ポートは53にし、OPNsenseマシンの標準DNSサーバーとして使ってください。

AdGuard Homeの設定 → DNS設定で、上流DNSをClashの待受アドレス127.0.0.1:5353にします。

### 中国国内・国外IPの振り分け

#### バイナリと設定ファイル

OPNsenseにはプロキシ用のSquidが標準で入っていますが、HTTP/HTTPSしか扱えず、一般的なTCPやUDPは転送できません。プロキシとしては物足りないので、tun2socksでTCP/UDP通信をClashへ渡す方法を使います。

バイナリと設定用に`/usr/local/tun2socks`を作成します。[GitHub Releases](https://github.com/xjasonlyu/tun2socks/releases)から最新のFreeBSDバイナリをダウンロードし、tun2socksへ改名します。設定ファイル`/usr/local/tun2socks/config.yaml`を作成します。

```yaml
# debug / info / warning / error / silent
loglevel: info

# URL format: [protocol://]host[:port]
proxy: socks5://127.0.0.1:7890

# URL format: [driver://]name
# TUN 设备名称，避免使用 tun0
device: tun://proxytun2socks0

# Maximum transmission unit for each packet
mtu: 1500

# Timeout for each UDP session, default value: 60 seconds
udp-timeout: 120s
```

`proxy`にはClashのSOCKS5ポートのアドレスを指定します。

`/usr/local/tun2socks/`で`./tun2socks -config ./config.yaml`を実行し、設定が正しいか確認できます。

#### サービスの登録

`/usr/local/etc/rc.d/tun2socks`と`/usr/local/opnsense/service/conf/actions.d/actions_tun2socks.conf`を作成します。

```shell
#!/bin/sh

# PROVIDE: tun2socks
# REQUIRE: LOGIN
# KEYWORD: shutdown

. /etc/rc.subr

name="tun2socks"
rcvar="tun2socks_enable"

load_rc_config $name

: ${tun2socks_enable:=no}
: ${tun2socks_config:="/usr/local/tun2socks/config.yaml"}

pidfile="/var/run/${name}.pid"
command="/usr/local/tun2socks/tun2socks"
command_args="-config ${tun2socks_config} > /dev/null 2>&1 & echo \$! > ${pidfile}"

start_cmd="${name}_start"

tun2socks_start()
{
    if [ ! -f ${tun2socks_config} ]; then
        echo "${tun2socks_config} not found."
        exit 1
    fi
    echo "Starting ${name}."
    /bin/sh -c "${command} ${command_args}"
}

run_rc_command "$1"
```

```
[start]
command:/usr/local/etc/rc.d/tun2socks start
parameters:
type:script
message:starting tun2socks

[stop]
command:/usr/local/etc/rc.d/tun2socks stop
parameters:
type:script
message:stopping tun2socks

[restart]
command:/usr/local/etc/rc.d/tun2socks restart
parameters:
type:script
message:restarting tun2socks

[status]
command:/usr/local/etc/rc.d/tun2socks status; exit 0
parameters:
type:script_output
message:request tun2socks status
```

`/etc/rc.conf`を作成して次を追加します。

```
tun2socks_enable="YES"
```

`chmod +x /usr/local/etc/rc.d/tun2socks`で実行権限を付け、`service configd restart`で有効にします。

tun2socksも手動で起動します。

```shell
/usr/local/etc/rc.d/tun2socks start
```

#### 自動起動

`/usr/local/etc/rc.syshook.d/early/60-tun2socks`を作成します。

```bash
#!/bin/sh

# Start tun2socks service
/usr/local/etc/rc.d/tun2socks start
```

`chmod +x /usr/local/etc/rc.syshook.d/early/60-tun2socks`で実行権限を付ければ完了です。

#### インターフェースとゲートウェイの作成

OPNsenseのインターフェース → 割り当てで新しいインターフェースを追加し、デバイスに設定ファイルで指定したproxytun2socks0を選んで保存します。

追加したインターフェースの設定画面で有効化し、説明をTUN2SOCKS、IPv4設定タイプを静的IPv4、IPv4アドレスを`10.0.3.1/24`として保存します。

システム → ゲートウェイ → 設定で、TUN2SOCKS_MIHOMOというゲートウェイを作ります。インターフェースはTUN2SOCKS、IPアドレスは`10.0.3.2`、ほかは標準のまま保存します。

これで、このゲートウェイへ入った通信は127.0.0.1:7890へ転送され、Clashがプロキシします。
#### 中国国内・国外IPの振り分け設定

私にとってOPNsenseで特に便利なのが、ファイアウォール → エイリアスです。IPリストを定義し、そのままルールで参照できます。手動入力だけでなく、URLを登録して動的に取得することもできます。

ファイアウォール → エイリアスで、2つ追加します。

1つ目はLANのアドレス範囲を表すInternalAddressです。タイプをNetwork(s)にし、内容は次のとおりにします。

```
0.0.0.0/8
127.0.0.0/8
10.0.0.0/8
172.16.0.0/12
192.168.0.0/16
169.254.0.0/16
224.0.0.0/4
240.0.0.0/4
```

2つ目は中国国内のIP範囲を表すCN_V4です。タイプはURL Table (IPs)にし、中国国内の全ネットワーク範囲を含むリストのURLを入力します。たとえば、次のURLです：https://raw.githubusercontent.com/gaoyifan/china-operator-ip/refs/heads/ip-lists/china.txt

続いてファイアウォール → ルール → LANの先頭に2つのルールを追加します。上からの順序に注意してください。

1つ目は宛先をInternalAddressにし、ほかは標準設定にします。LAN宛てを通常のルールでルーティングする指定です。

2つ目は宛先をCN_V4にして「宛先／反転」にチェックし、ゲートウェイを先ほどのTUN2SOCKS_MIHOMOにします。中国以外のIP宛てをこのゲートウェイへ転送する指定です。

その下は既存の標準ルールです。残りの通信は通常どおりに流れ、中国国内のIPには直接接続します。

Googleにアクセスすると、DNSクエリを受けたAdGuard HomeがClashへ転送し、Googleの実IPが返ります。そのIPへの通信はファイアウォールの2つ目のルールに一致し、TUN2SOCKS_MIHOMOへ送られ、SOCKS5ポートからClashに入ります。これで検閲を回避できます。
