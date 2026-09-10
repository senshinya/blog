---
title: "Xiaomi 17を普段使いに：ロック解除、ROM書き込み、root化とroot隠し"
description: "Xiaomi 17のBootloaderを解除し、純正改変ROMを導入してrootを隠すまでの記録。銀行・決済アプリやプロキシを普段どおり使えるようにした手順もまとめます。"
date: 2026-08-17 23:59:21
categories: [fiddling]
tags: ["試行錯誤", "root", "bootloader"]
---

::quote{icon="tabler:device-mobile"}
普段使いのためにいじらないOSもあれば、いじらないと普段使いが難しいOSもあります。
::

学部生のころはスマートフォンをいじるのが大好きでした。当時は多くのメーカーで簡単にロック解除でき、コミュニティにはサードパーティーROM、root、hookがあふれていました。何もかもが勢いよく育っていた光景を、今でも覚えています。

就職後は、もういじる年齢でもないのかと思った時期があり、iPhoneも使いましたが、結局慣れませんでした。AI時代になり小さなアイデアがよく浮かぶのに、Appleの閉じた環境では外部ソフトを入れるだけでもサイドロードや署名が面倒です。本音を言えば年99ドルの開発者登録料を払いたくないだけですが。一方Androidはどんどん大型化し、標準iPhoneのサイズが「小型」と呼ばれる妙な流れです。中、大、特大というわけです。手の小さい私には、標準iPhoneがすでに操作できる限界です。

今年前半にOPPO Find X9s Proへ替えました。フラッグシップモデルではありませんが、小さいのが長所です。ただ、その一点以外の不満はかなりありました。普段はトラフィック振り分け用のVPNと、アクセシビリティを使うiCostの自動記帳を動かしています。ところが銀行アプリが両方を検出し、利用を拒否してきてうんざりします。カーネルのスケジューリングにも問題があるようで、Dimensityの全大コア構成のせいか分かりませんが、夏になると異常に熱くなります。ゲームなどせず、Xや小紅書を見るだけで熱々です。熱くなるとシステム全体が重くなり、30fpsほどまで落ちます。普段使いにも大きな支障が出ていました。

ある晩、またひどい発熱とカクつきに遭い、ついに買い替えを決めました。比較して選んだのはXiaomi 17で、6.3インチという小ささも理由の一つです。下取りに500元を足して、空色の16+512モデルに交換しました。前の端末はブランドと有名人の上乗せが大きかったのだなと実感します。スポーツ選手が宣伝していて、そのファンはアイドルファン的な熱狂で有名です。

配送を待つ間にCoolapkを眺めていたら、この機種はBootloaderを直接解除でき、ROMを作る人も多く、コミュニティが活気づいていると分かりました。

> 思わぬ収穫です。

こうして届いた純正HyperOSは1時間も生き延びられず、Bootloaderを解除して第三者による純正改変ROMに入れ替えられました。

::alert{type="warning" title="バージョンについて"}
初期の8e5端末の解除脆弱性は、2026年2月のセキュリティパッチで塞がれています。ネットで見つかる手順の多くは、その古い脆弱性向けです。それ以降のOSでは、主に[@AC 极光_Official](https://www.coolapk.com/u/17883039)の[ワンクリック解除スクリプト](https://www.coolapk.com/feed/73105378?s=ZTE1ODk2OGIyMTY3NjVnNmE4MzIyOTh6a1651)が使われています。
::

17シリーズのHyperOS改変ROMでCoolapk上で活発なのは、[江南](https://www.coolapk.com/u/25341491)さんと[毒蛇](https://www.coolapk.com/u/35810773)さんです。2人とも高校生。今の若者はすごいですね。私は[毒蛇さんのROM](https://www.coolapk.com/feed/70200384?s=YTgxYmJmMWIyMTY3NjVnNmE4MzIzODJ6a1651)を選びました。root入りで、不要機能の削減や第三者製カーネルも含みます。スケジューリングの調整がよく、滑らかで省電力、バグも比較的少なそうです。Bootloaderへ再起動すれば、ワンクリックで書き込めます。

続いてKernelSU、LSPosed、Zygisk Nextなどのフレームワークを順番に入れます。

root化後の最大の悩みはアプリによる検出です。とくに銀行や決済アプリはrootやOS改変を見つけると、指紋認証などの機能を制限したり、利用そのものを拒否したりします。そのため、各種モジュールでrootを隠します。

Coolapkなどのコミュニティでは、rootや解除済みBootloaderの隠し方について意見が入り乱れ、古い解説も混ざっています。きちんと動く方法を探すのは大変ですが、試行錯誤の末に実現できました。

主に使ったモジュールは5つだけです。
::card-list
- [Magic Mount](https://github.com/Tools-cx-app/meta-magic_mount-rs)：中核となるフレームワーク。
- [HMA-OSS](https://github.com/frknkrc44/HMA-OSS)：アプリ一覧とアクセシビリティを隠します。
- [Integrity Box](https://github.com/MeowDump/Integrity-Box)：Google純正端末に偽装し、Google Playの検査を通します。
- [TEESimulator-RS](https://github.com/Enginex0/TEESimulator-RS)：Androidの証明書を生成し、ハードウェア鍵の認証を通します。
- [Tricky Addon Enhanced](https://github.com/Enginex0/tricky-addon-enhanced)：TEE証明書の生成を自動化します。
::

順番に導入して再起動します。

HMA-OSSには専用アプリがあります。rootやアクセシビリティなどを隠したいアプリに隠蔽を有効にし、テンプレートも有効にします。アプリのプリセットは「アクセシビリティアプリ」「検出アプリ」「Root管理／Rootアプリ」「LSPosed/Xposedモジュール」の4つ、設定のプリセットは「アクセシビリティ」「開発者向けオプション」の2つです。対象アプリからは検出対象のアプリや機能が見えなくなり、検出を回避できます。

次にKernelSUのIntegrity Boxモジュールで起動ボタンを押すと、偽装先のGoogle端末がランダムに選ばれます。TEESimulator-RSは追加設定なしで動きます。

Zygisk-Nextのモジュール設定では、「除外リストのポリシー」を「アンマウントのみ」にします。

[Hunter APP](https://github.com/w296488320/HunterUpdate)を入れると、rootや関連する改変を隠せているか確認できます。

::github{repo="w296488320/HunterUpdate"}
::

System Patchの不一致エラーは、Integrity Boxが偽装する端末と実機のセキュリティパッチが違うためです。実機の日付はシステム設定で確認できます。TEESimulator-RSのモジュール設定で右上の三点メニューからセキュリティパッチ設定を開き、詳細設定を有効にして3項目を実機の日付に合わせます。私の端末は2026-07-01なので、Systemは202607、BootとVendorは2026-07-01にして保存しました。

Found hole in prop area: u:object_r:bootloader_prop:s0のようなエラーは、実機と偽装先のブートハッシュが一致していないためです。実機の値はCoolapkで入手できる「密钥认证」（Key Attestation）アプリで調べられます。BootHashをコピーし、Integrity Boxの異常なBoot Hashの修復欄へ貼り付けて再起動します。コピーできなければスクリーンショットの文字認識でも構いません。

ほかの問題はIntegrity Boxの修復モードも試せます。細かな例外的な問題を解消できることがあります。

これで銀行アプリなどがすべて正常に動き、WeChatやAlipayの指紋決済も使え、Hunterの検査はすべて緑になりました。

プロキシには[Yumebox](https://github.com/YumeYucca/YumeBox)も使えます。root権限を与えるとシステムのVPNサービスを使わずにTUNインターフェースを作れるため、第三者アプリの検出を避けられます。

::github{repo="YumeYucca/YumeBox"}
::
