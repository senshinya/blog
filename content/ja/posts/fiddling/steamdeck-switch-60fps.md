---
recommend: 7
authorship: human-only
title: "Steam Deckの第二の人生：Switchエミュレーター導入からフレーム補間で60FPSまで"
description: "これも一種のNTRですよね"
date: 2026-09-09 23:59:00
categories: [fiddling]
tags: ["Steam Deck","Nintendo Switch","EmuDeck","Eden","Lossless Scaling","フレーム生成"]
image: "https://blog-img.774352199.xyz/NDPUwc.webp"
seoDescription: "Steam DeckにEmuDeckとEdenを導入し、ゲーム登録、ボタン、ジャイロを設定。Decky LSFG-VKのフレーム補間で60FPSを目指す構成と画質の調整を紹介します。"
---

### はじめに

最近、国慶節の旅行を計画していて、結構な出費になりました。使っていないものを売って少しでも足しにしようと整理していたら、以前個人輸入した香港版Steam Deckが出てきました。買ったときは4,000元台でしたが、買取サービスの爱回收で査定してみると、まだ3,000元台で売れるようです。ちょっと心が動いて、買取を申し込みました。

訪問買取を待つ間に、初期化してデータを消そうと電源につないだのですが、触っているうちにどんどん手になじんできます。ほとんど遊んでいない新品同様の本体を見ていたら、急に手放すのが惜しくなりました。考え直して、結局買取はキャンセル。最近は、パソコンの前に座って1〜2時間ゲームをする気がますます起きなくなっています。超大作のストーリーを追いかける根気がなくなったのもありますし、賃貸の部屋に置いている机と椅子が、肩、首、腰、お尻、脚にかなりの負担をかけているのもあります（年には勝てません。3〜4年前は硬い木の椅子に座って、朝4時まで原神を遊べたのに）。気負わず、いつでも始めていつでもやめられるゲームに戻ろうと決めました。Steam Deckはちょうどその用途にぴったりです。

そこでシステムを更新して、買ったきり遊ぶ時間のなかったP5RとシヴィライゼーションVIIをダウンロードし直しました。YouTubeでおすすめのゲームを探していたら、Steam DeckにSwitchエミュレーターを入れる動画に出会いました。ざっと見たところ、もうかなり完成度が高く、超解像やフレーム補間のMODを組み合わせれば、大半のゲームが60fpsで安定して動き、Switchより快適に遊べるようです。すっかりその気になって、ひととおり試してみました。ただ、一部の情報は時間がたって状況が変わっており、インストール中にいくつかつまずきました。

YouTubeの動画はこちらです。

::video-embed{type="youtube" id="WZ8UunuMLqc"}
::

### EmuDeckをインストール

::alert{type="tip"}
以下の操作はすべてSteam Deck本体で行います。ソフトウェアのインストール先もすべてSteam Deckです。
::

まずはEmuDeckをインストールします。Steam Deck上のエミュレーターをまとめて管理でき、エミュレーターのゲームをSteamに登録して起動できるようになります。

::link-card{link="https://www.emudeck.com" title="EmuDeck"}
::

ページの一番下までスクロールして、SteamOS版をダウンロードします。

Steam DeckのFirefoxからダウンロードすると、`EmuDeck.desktop.download`のように、ファイル名の末尾に`.download`が余分につくことがあります。名前を変更して`.download`を取り除けば大丈夫です。

ダブルクリックで起動すると、ターミナルが開いてダウンロードが始まります。完了すると設定画面が表示されます。

1. Custom Modeを選択します。
2. ROM Directoryは、後でゲームのROMを保存する場所です。外付けのSDカードがなければInternal Storageを選びます。
3. DeviceはSteam Deckを選択します。
4. Level of IntegrationはHighestを選びます。Steam Rom Managerが必要です。
5. Emulators and tools for Steam Deckは、すべてのチェックを外します。
6. Emulator and Tools Configurationは、EmulationStation DEだけを残して、ほかのチェックをすべて外します。
7. Configure Controller Layoutはボタンの割り当てです。好みで選んで構いません。後から変更もできます。

選び終えて次へ進むと、ソニックの画面が表示され、選択したコンポーネントのダウンロードとインストールがバックグラウンドで始まります。完了後は、ROMやファームウェアを設定するPost Installationに進みます。まだエミュレーターを何もダウンロードしていないので、ここはスキップして構いません。

続いてデスクトップかアプリケーションメニューからEmuDeckを起動し、Manage EmulatorsでSteam Rom Managerを探します。Update Configurationがあれば実行し、その後Reset Configurationも実行します。戻ってEmulationStation-DEを開き、Installをクリックしてから、こちらもReset Configurationを実行します。

EmuDeckの左側のメニューからSteam ROM Managerを起動します。背景がSteam Deckの画像になっていることを確認してください。Chooseで自分のアカウントを選んでSaveし、Nextをクリックします。

### Edenをインストールしてゲームを追加

EdenのGitのリリースページから最新リリースを開き、Steam Deck版のPGO AppImageをダウンロードします。

::link-card{link="https://git.eden-emu.dev/eden-emu/eden/releases" title="Edenのリリース"}
::

ダウンロードしたファイルを`Eden.AppImage`にリネームして、`Home/Application`ディレクトリに移動します。

ダブルクリックで起動すると、キーが見つからないと表示されます。ひとまずNoをクリックして、インストールせずに進みます。

エミュレーターには、実機のSwitchから取り出したキーとファームウェアを読み込ませる必要があります。実機を持っていない場合は……。

Well……ここにサイトを一つ置いておくので、各自で調べてみてください。

::link-card{link="https://prodkeys.net/" title="prodkeys.net"}
::

keysとfirmwareを入手したら、keysは解凍し、firmwareはzipのままにしておきます。Eden - Tools - Install Decryption Keysで解凍したkeysフォルダーを選び、キーをインストールします。Eden - Tools - Install Firmware - From ZIPでは、firmwareの圧縮ファイルを選んでファームウェアをインストールします。

これでゲームのROMを追加できます。Edenはxciとnsp形式のROMに対応しています。ゲームのROMも実機のSwitchから取得するものですが、やはり持っていない場合は……。

Well……もう一つサイトを置いておくので、こちらも各自で調べてみてください。

::link-card{link="https://nswpedia.com/" title="nswpedia.com"}
::

入手したROMを`Home/Emulation/roms/switch`ディレクトリに移動します。ゲーム本体はこのディレクトリの直下に置き、DLCとアップデート用のファイルは、Updateディレクトリを新しく作ってそこに保存するのがおすすめです。

Edenの画面にあるフォルダー追加アイコンをダブルクリックし、`Home/Emulation/roms/switch`を選択すると、ゲーム本体とアップデート、DLCがすべて自動でスキャンされます。

### EdenとEmuDeckを連携

Edenをインストールできたので、次はEmuDeckに認識させます。EmuDeckからSteam ROM Managerを開き、SettingsのSelect ThemeでClassicを選択します。左側のメニューから`Nintendo Switch - Eden`を探します。右側のExecutableには初期値が入っているので、Application内のEden.AppImageに変更します。表示される値は`/home/deck/Applications/Eden.AppImage`になるはずです。保存をクリックし、Settingsに戻ってThemeをEmuDeckに戻します。

右下のParsersをクリックし、Parsersをすべてオフにしてから、Edenだけをオンにします。Add Gamesをクリックすると、Edenに追加したゲームがすべて表示されます。ただ、一つ問題があって、DLCやアップデートも別のゲームとして表示されてしまいます。右下のExclude Gamesをクリックし、DLCとアップデートをすべてグレーにして、ゲーム本体だけが明るく表示されている状態でSave Excludesをクリックします。Save to Steamをクリックし、右上に`Done adding/removing entries`と表示されるまでしばらく待てば、追加完了です。

Steam Gaming Modeに戻ると、ライブラリのNon-Steamにゲームが表示され、専用のCollectionにもまとめられています。遊び始める前に、ボタンの割り当てとジャイロドライバーを設定しておきます。

::pic{src="https://blog-img.774352199.xyz/xo23fk.jpeg" width="1280" height="800"}
::

### ボタンとジャイロを設定

デスクトップモードに戻ってEmuDeckを起動し、左側のメニューのGyroscope - Installをクリックして、ジャイロドライバーをインストールします。

完了したらSteam Gaming Modeに戻り、ライブラリのEmulation Stationを起動します。Emulators Various、Edenの順に選び、Edenを起動します。

::folding{title="Emulators VariousにEdenが表示されない、またはEmulators Various自体がない場合は、以下の手順を試してください"}
1. デスクトップモードに戻ります。
2. Edenを選択し、Reset Configurationを実行します。
3. ES-DEを選択し、Reset Configurationを実行します。
4. Steam Deckを再起動します。
::

Edenの画面でEmulation - Configure - Controlsを開き、ControllerがPro Controller、Input DeviceがSteam Virtual Gamepad 0になっていることを確認します。

Face Buttonでは、XYABのボタン割り当てを設定できます。私のおすすめは、ABはABのままにして、XYをYXに入れ替える設定です。このあたりは好みで決めてください。

Motion 1でジャイロを設定します。クリックして`Shake!`の表示に切り替えたら、Steam Deck本体を振ると、Edenがジャイロドライバーを認識します。その状態でSteam Deckを回転させ、画面内のPro Controllerの中央上部にある立方体が同じように回転すれば、正しく認識されています。

設定が終わったらOKをクリックして保存します。

### アヒルのフレーム補間

ここまででゲームを起動すると、大半のゲームは30fps前後で動きます。ただ、Steam Deckではこのフレームレートだと映像がカクつき、操作への反応も鈍く感じます。

そこで、有名な黄色いアヒルのLossless Scalingにフレームを補間してもらいます。Lossless ScalingはSteam Deckでネイティブに動かないので、少し工夫が必要です。

::alert{type="info"}
前提として、Lossless Scalingを購入し、lsfg-vk版をインストールしておく必要があります。
::

まずはDecky Loaderをインストールします。デスクトップモードでダウンロードし、実行すればインストールできます。

::github{repo="SteamDeckHomebrew/decky-loader"}
::

インストール後、Steam Gaming ModeでQAMボタン（右下の...ボタン）を押すと、サイドバーの一番下にDeckyメニューが表示されます。

続いてDecky LSFG-VKをインストールします。ReleaseにあるZipをダウンロードします。Pre-release版を直接ダウンロードするのがおすすめです。

::github{repo="xXJSONDeruloXx/decky-lsfg-vk"}
::

Deckyメニューの設定 - 一般で開発者モードを有効にします。続いて開発者メニューでZIPファイルからのプラグインインストールを選び、Decky LSFG-VKの圧縮ファイルを指定してインストールします。

DeckyからLSFG-VKのメニューを開き、FPS Multiplierの+を押して2Xにし、Present Modeをオンにします。後で60fpsに届かなければ、Performance Modeもオンにできます。このモードでは処理の速いモデルが使われますが、その代わり視点を動かしたときに残像が出ます。最後にCopy Launch Optionをクリックします。

フレーム補間を使いたいゲーム（ほぼすべてのSwitchゲームです）のメニューから、プロパティ - ショートカット - 起動オプションを開きます。`vblank_mode=0`の後ろに、先ほどコピーした内容を貼り付け、重複した`%command%`を削除します。最終的な起動オプションは、`vblank_mode=0 ~/lsfg %command% -f -g ...`のようになります。

アヒルが動作するのはVulkan環境だけなので、EdenもVulkanに切り替える必要があります。Emulation StationからEdenを起動し、Emulation - Configure - Graphicsを開きます。APIでVulkan、VSync ModeでMailboxを選び、OKをクリックして保存します。

これで準備完了です。ゲームを起動すると、最初は少し変動しますが、しばらくすればほぼ60fpsで安定します。

Enjoy

::pic{src="https://blog-img.774352199.xyz/FeC82s.jpeg" width="1280" height="800" caption="パフォーマンスオーバーレイも一緒に撮りたかったのですが、標準のスクリーンショットではオーバーレイが非表示になります"}
::
