---
authorship: ai-human-reviewed
title: "中国本土向けMacでApple Intelligenceを使う：地域変更からChatGPTの取り出しまで"
description: "今年もWWDCでmacOS 27の新しいApple Intelligenceが登場しました。macOS 26時代の回避方法はもう使えず、引き続きAppleとの知恵比べです。"
date: 2026-06-11 10:00:00
categories: [fiddling]
tags: ["試行錯誤", "macOS", "Apple Intelligence", "ChatGPT"]
---

今年もテック界の年越し番組、WWDCがやってきて、macOS 27も予定どおり登場しました。見た目は変わり、バージョン番号も上がりましたが、最大の更新であるApple Intelligenceだけは、中国本土向け端末で依然使えません。またも中国本土を避けて一周する更新で、相変わらず二等市民扱いです。

昨年の[macOS 26](/ja/fiddling/macos-26-trial)ではあまり気にしませんでしたが、今年は手元に端末があるのだし、いじってみることにしました。中国本土向けMacBook Air M5、macOS 27（26A5353q）です。まずカーネル拡張でApple Intelligenceを有効にし、その後ChatGPT拡張を有効にします。後者には独自のジオフェンスがあり、Apple Intelligence全体の地域制限よりずっと厳しいのです。

## 仕組み

Apple Intelligence全体の地域制限は、次のように単純化できます。

```
MGGetStringAnswer("RegionCode") == "CH"  →  Apple 智能关闭
```

`RegionCode`はIORegistryの`IOPlatformExpertDevice`にある`region-info`をリアルタイムで読み取ります。中国本土向け端末の値は`CH/A`です。macOS 27の`eligibilityd`はSwiftDataで資格を随時再計算するため、plistを書き換えて`uchg`で固定する従来の方法はすべて効かなくなりました。変更しても再起動で戻ります。

根本的にはIORegistry側の`region-info`を変える必要があります。GitHubの[RegionSpoof](https://github.com/SkyBlue997/enableMacosAI)はこの仕組みで、`IOPlatformExpertDevice`にマッチするkextを読み込み、`start()`で`region-info`を`LL/A`（米国版）、`country-of-origin`を`USA`にします。すべてのプロセスが情報源から米国地域として読むため、利用資格、モデル配信、UIがまとめて有効になります。各プロセスへの個別注入は不要です。

::github{repo="SkyBlue997/enableMacosAI"}
::

簡潔で徹底した方法ですが、カーネル拡張を読み込む必要があります。そのためにはSIPを無効にしなければなりません。

## 避けられないSIP

Apple Siliconで第三者製kextを読み込むには、システム整合性保護（SIP）を無効にし、Permissiveセキュリティモードへ切り替え、第三者製カーネル拡張を許可します。復旧モードに入る必要があります。

電源を切ってから電源ボタンを長押しして復旧モードに入り、ターミナルで次を入力します。

```bash
csrutil disable
```

再起動して通常のシステムに戻り、プロジェクト内で次を実行します。

```bash
sudo ./install.sh
```

スクリプトがSIPとApple Siliconの状態を確認し、kextを入れ、自動起動用LaunchDaemonを設定して、Apple Intelligence関連のデーモンを更新します。初回のkext読み込みはOSに止められるので、「システム設定 → プライバシーとセキュリティ」で許可して再起動します。

ここに落とし穴があります。

::alert{type="warning" title="ついでにAMFIまで無効にしない"}
SIPを切る際、`amfi_get_out_of_my_way=1`をboot-argに追加するよう勧める解説が多くあります。AMFIを無効にするとSEPがPrivate Cloud Computeへのハードウェア証明を拒否し、クラウドAIが使えず、端末内処理だけになります。文体の書き換えやImage Playgroundなど、PCCを使う機能はすべて動きません。
::

導入後は次のコマンドで状態を確認できます。

```bash
sudo ./install.sh status     # SIP / AMFI / region / kext / 资格 一览
ioreg -ard1 -c IOPlatformExpertDevice | plutil -p - | grep region-info   # 应为 0x4c4c2f41 即 "LL/A"
```

`region-info`が`LL/A`、資格ドメインGREYMATTERが4（eligible）ならOKです。再起動して設定を開くとApple Intelligenceの項目が現れ、作文ツール、Genmoji、Image Playground、Foundation Modelsが正常に使えました。

完璧です！

## ChatGPT拡張

問題はSiriのChatGPT拡張でした。Siri設定にはChatGPT拡張のスイッチとログイン項目が出るはずなのに、Siriは「ChatGPT用のApple Intelligenceサポートをダウンロード中」とも表示します。

最初は本当にダウンロードが詰まったのだと思い、`generativeexperiencesd`のログを取りました。しかし原因はダウンロードではなく、次のproviderが非表示と判定されていました。

```
Retrieved provider status for ChatGPT: .forciblyHidden, info:
  partnerNotSelected,
  useCaseDoesNotAllowCurrentIPCountryCode,
  useCaseDoesNotAllowUserLocaleRegion
```

理由は3つです。`partnerNotSelected`はスイッチが出ないことによるものなのでひとまず置いておきます。本題は残る2つで、現在のIPの国コードとシステムの地域設定が条件に合っていません。

面白い話です。kextで端末の地域は米国版になり、`RegionCode`もUSです。しかしChatGPT拡張はそれを読まず、`countryd`がリアルタイムで計算する「今どの国にいるか」を使っています。

## countrydを攻略する

日本のプロキシにつなぎ、出口IPが日本であることを確認しました。Apple自身のGeoIP APIもJPを返します。

```bash
curl -s https://gspe1-ssl.ls.apple.com/pep/gcc   # 返回 JP
```

これで制限が解けるはずですが、`generativeexperiencesd`を再起動しても`isDisabled`は`true`のままでした。`countryd`を見ると、かなり複雑な仕組みがありました。

`countryd`は次の優先順位で国を判定します。

```
WiFiAP (优先级 1)  >  Location 定位 (优先级 4)  >  GeoIP (优先级 5)
```

プロキシが変えるのはIP、つまり最下位のGeoIPだけです。その上にWi-Fiアクセスポイント測位と、位置情報サービスからの緯度・経度があり、どちらも私を中国本土と判定していました。

位置情報サービスは無効にすればよく、`LatLonLocation`の信号が消えます。地域設定も中国本土から日本へ変更するだけです。`AppleLocale`が`zh_CN`から`zh-Hans_JP`になり、`useCaseDoesNotAllowUserLocaleRegion`は通りました。

厄介なのはWi-Fiです。スマートフォンのテザリングならBSSIDはAppleの位置データベースにないだろうと考えました。接続してログを取ると、前半は予想どおりです。

```
21:49:42  "WiFi AP update", "countryCode":""     ← 热点本身查不到国家，是空的
21:49:51  "WiFi AP update", "countryCode":"CN"   ← 9 秒后又变回 CN
```

そのホットスポットのBSSIDは空を返しました。しかし9秒後にはまたCNになります。AppleのWi-Fi測位は接続先だけでなく、周囲の**すべて**のWi-Fi信号を調べるからです。テザリング中でも、自宅や隣家、建物中の中国国内ルーターが私の居場所を教えてしまいます。

Wi-Fiが有効な限り、どこにつないでも無駄です。周囲の中国国内APが次々に居場所をばらします。

~~Only Apple Can Do~~

## Wi-Fiを切る

Wi-Fiを切って有線接続にすれば、`countryd`は物理的な位置の信号を取れず、GeoIPだけで判断するしかありません。

私はiPhoneのUSBテザリングを使い、Mac側ではすべての通信を日本のプロキシ経由にして、Wi-Fiは切ったままにしました。`countryd`を見ると、GeoIPはついに日本です。

```
"CACHE: Geo IP country code changing", "from":"CN", "to":"JP, priority = 5 (GeoIP)"
```

それでもoverallはCNでした。調べると、Wi-Fiを切っても「クリア」イベントは送られず、`countryd`は最後の`WiFiAP=CN`をディスクにキャッシュして、再起動のたびに読み戻します。最優先なので、GeoIPが反映されません。

ならばキャッシュを削除します。

```bash
sudo plutil -p /var/db/com.apple.countryd/countryCodeCache.plist
```

サービスを止め、キャッシュを削除し、Wi-Fiを切った状態で`countryd`を再起動します。

```bash
sudo launchctl bootout system/com.apple.countryd
sudo rm -f /var/db/com.apple.countryd/countryCodeCache.plist   # [!code highlight]
sudo launchctl bootstrap system /System/Library/LaunchDaemons/com.apple.countryd.plist
```

ここまで来て、ついに`countryd`の判定が日本になりました。ChatGPTの`forciblyHidden`が解除され、設定に拡張のスイッチが現れました。

Finally！

スイッチが出たらChatGPTを有効にします。PlusやProのアカウントがあればログインできます。

::alert{type="tip"}
一度ChatGPT拡張を有効にすれば、その後Wi-Fiや地域設定を元に戻しても、引き続きChatGPTを使えます。
::
