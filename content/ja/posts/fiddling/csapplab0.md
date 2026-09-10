---
authorship: human-only
title: "CSAPP Labの環境構築"
description: "CSAPPの学習では実験が欠かせませんが、Linux環境の構築が壁になりがちです。とくに仮想マシンでは、インストール失敗、互換性、ネットワーク接続などの問題に悩まされます。Windows 10バージョン2004以降なら、WSL（Windows Subsystem for Linux）が有力な選択肢です。従来の仮想マシンの複雑さや性能面の負担を避けながら、Linux環境を手軽に利用できます。"
date: 2021-12-27 00:09:00
categories: [fiddling]
tags: ["試行錯誤", "CSAPP", "実験", "環境構築"]
image: "https://blog-img.774352199.xyz/vqOC7N.webp"
---

### はじめに

> CSAPPを学びながら実験をしないのは、中国四大名著を読むのに『紅楼夢』を読まないようなものです。文学的素養と自己研鑽が足りず、内に秘めた高尚な芸術を理解できない。表面の華やかな言葉しか見えず、深遠な精神の核心に到達できない。その人の器はそこで頭打ちになり、比較的失敗した人生を送ることになるのです。

CSAPPの実験をあきらめさせる最大の要因は、Linux環境です。私は学部生のころ、VMware WorkstationにUbuntu Desktopを入れて一度やりました。自分はとくに困りませんでしたが、周りでは次のような問題が起きていました。

* 仮想マシンのインストール失敗
* VMwareとHyper-Vの非互換
* 仮想マシンがネットにつながらない
* ホストとの共有フォルダーが動かない
* Ubuntuの中国語入力
* その他、原因不明の怪現象

仮想マシンの性能も褒められたものではありません。ホストのメモリを切り分けるので、先にOOMになるのがゲストかホストか、分かったものではありません。

以上を踏まえ、私はWSL（Windows Subsystem for Linux）を選びました。WSL 2を使えるWindows 10 Version 2004以降、またはWindows 11をおすすめします。それ以前のWindowsはWSL機能があってもWSL 1で、LinuxのシステムコールをWindowsのシステムコールに翻訳して動かします。一方WSL 2は、軽量でメンテナンス不要の仮想マシン上に完全なLinuxカーネルを動かします。この完全なカーネルが、CSAPPの実験にはとても重要です。

macOSはどうするかって？ Intel MacBookならVirtualBox、VMware Fusion、Parallels DesktopなどにLinuxを入れるか、Dockerを使えます。M1 MacBookなら、**別のパソコンに替えることをおすすめします**。冗談ではなく、M1では本当に実験できません。

我ながら、余計な話が多いですね。

### WSLとUbuntuのインストール

WindowsでのWSLインストールは簡単です。管理者権限のPowerShellで次のコマンドを入力します。

```shell
wsl --install -d Ubuntu
```

必要な機能が自動で設定され、Ubuntuの最新LTSもダウンロードされます。執筆時点では20.04です。インストールが終わると端末が開き、ユーザー名とパスワードを求められます。

```shell
Installing, this may take a few minutes...
Please create a default UNIX user account. The username does not need to match your Windows username.
For more information visit: https://aka.ms/wslusers
Enter new UNIX username: shinya
New password:
Retype new password:
passwd: password updated successfully
Installation successful!
```

パスワードは入力しても画面に表示されません。

設定が終わると、`shinya@DESKTOP-4TMFLAE:~$`のようなプロンプトが現れ、コマンド待ちになります。これでUbuntuに入れました。

### 便利な使い方

#### Windows Terminal

Windows Terminalは、Windowsの端末の王様と言っていいでしょう。

Microsoft Storeで「Windows Terminal」を検索して入れるか、GitHub Releasesの[https://github.com/microsoft/terminal/releases](https://github.com/microsoft/terminal/releases)からmsixbundleをダウンロードしてダブルクリックすればインストールできます。

WSLとUbuntuが入っていれば、Windows Terminal上部のプラス横のドロップダウンにUbuntuが表示されます。クリックするとUbuntuのデフォルトシェルをすぐ開けます。

#### ファイル共有

WSL内のUbuntuとWindowsは、それぞれ独自のファイルシステムを持つ隔離された環境です。隔離されていますが、完全に切り離されているわけではありません。

WindowsのCドライブは、Ubuntuの/mnt/cにマウントされています。たとえばLinuxからWindowsのデスクトップを見るには、次のようにします。

```shell
$ cd /mnt/c/Users/Shinya/Desktop
$ ls
 course.py     desktop.ini     szxx.bat     szxx.txt
```

逆に、WSL自身のファイルシステムにあるファイルをWindowsから見ることもできます。ホームディレクトリ~を開くなら、次のコマンドです。

```shell
$ cd ~
$ explorer.exe .
```

エクスプローラーが開き、指定したフォルダーの内容が表示されます。Windowsのフォルダーと同じ感覚で操作できます。

#### Visual Studio Code

世界最高のテキストエディター、VS CodeはWSLのフォルダーを直接開けます。ローカルのプロジェクトとまったく同じように扱えます。誰もがvimで実験したいわけではありませんからね。

まずWindows側のVS Codeを開き、拡張機能でWSLを検索して「Remote - WSL」をインストールします。通常は検索結果の先頭に出ます。

続いてUbuntuのプロジェクトフォルダーで、次を入力します。

```shell
$ code .
```

初回は必要なサポートコンポーネントがインストールされます。

```shell
$ code .
Installing VS Code Server for x64 (899d46d82c4c95423fb7e10e68eba52050e30ba3)
Downloading: 100%
Unpacking: 100%
```

その後Windows側のVS Codeが自動で開き、Ubuntuのプロジェクトフォルダーが作業ディレクトリになります。あとは好きなように開発できます。

#### 中国国内のミラーに変更する

まず「源」とは何でしょうか。

> 古書によれば、天地の気が交わり万物を生んだ時代、世界は混沌と濃密な霊気に満ちていました。多くの霊物は天地の根源の精気を吸収し、膨大な生命の精華を封じた琥珀のような結晶を作りました。  
> 現在まで残ったものを「源」と呼びます。

すみません、別の作品の話でした。

簡単に言うと、UbuntuなどDebian系のパッケージマネージャーaptはURLの一覧を持っていて、apt installを実行すると、そこからパッケージを探してダウンロードし、インストールします。この一覧が「源」、つまりsourcesです。デフォルトは中国国外のURLで、例によって非常に遅かったり、接続できなかったりします。そこで中国国内のミラーに変更します。

手順は次のとおりです。

```shell
$ sudo mv /etc/apt/sources.list /etc/apt/sources.list.bak
$ sudo nano /etc/apt/sources.list
```

次の内容を貼り付けます。ここではAlibabaのミラーを使っています。ディストリビューションやバージョンによって設定が異なるので、間違えないようにしてください。これはUbuntu 20.04用です。

```shell
deb http://mirrors.aliyun.com/ubuntu/ focal main restricted universe multiverse
deb-src http://mirrors.aliyun.com/ubuntu/ focal main restricted universe multiverse
deb http://mirrors.aliyun.com/ubuntu/ focal-security main restricted universe multiverse
deb-src http://mirrors.aliyun.com/ubuntu/ focal-security main restricted universe multiverse
deb http://mirrors.aliyun.com/ubuntu/ focal-updates main restricted universe multiverse
deb-src http://mirrors.aliyun.com/ubuntu/ focal-updates main restricted universe multiverse
deb http://mirrors.aliyun.com/ubuntu/ focal-proposed main restricted universe multiverse
deb-src http://mirrors.aliyun.com/ubuntu/ focal-proposed main restricted universe multiverse
deb http://mirrors.aliyun.com/ubuntu/ focal-backports main restricted universe multiverse
deb-src http://mirrors.aliyun.com/ubuntu/ focal-backports main restricted universe multiverse
```

続いてパッケージ一覧を更新し、パッケージをアップグレードします。

```shell
$ sudo apt update
$ sudo apt upgrade
```

### 実験に必要なソフトウェア

#### パッケージ

必須のものは、この1行です。

```shell
$ sudo apt install build-essential gcc-multilib gdb
```

任意でcgdbも入れられます。GDBの軽量なフロントエンドで、通常のgdbと同じコマンド画面とソースコードを分割表示します。パッケージのcgdbは最新版ではないので、ソースからビルドします。

```shell
$ sudo apt install automake libncurses5-dev flex texinfo libreadline-dev
$ git clone git://github.com/cgdb/cgdb.git
$ cd cgdb
$ ./autogen.sh
$ ./configure --prefix=/usr/local
$ make
$ sudo make install
```

インストール後は、どこでもcgdbコマンドで開けます。画面はこんな感じです。

![CGDB](https://blog-img.774352199.xyz/2025/a36f15210399888f0e0cf56efe45a202.jpg)

CGDB

左がコードウインドウ、右がgdbウインドウです。

起動時は上下分割ですが、`ctrl+w`で左右分割に切り替えられます。

escを押すとgdb側からコード側へフォーカスが移ります。コード側ではソースを上下に見て回れ、スペースで選択行にブレークポイントを設定できます。

iを押すとgdb側へ戻ります。こちらの操作は通常のgdbと同じです。

詳しくは[CGDB中国語マニュアル](https://leeyiw.gitbooks.io/cgdb-manual-in-chinese)を参照してください。

#### 実験はどこにある？

独学なら[http://csapp.cs.cmu.edu/3e/labs.html](http://csapp.cs.cmu.edu/3e/labs.html)へどうぞ。各実験のSelf-Study Handoutリンクから教材をダウンロードできます。WSLにコピーすれば、楽しい実験の始まりです！
