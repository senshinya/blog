---
authorship: human-only
title: "RISC-Vツールチェーンとエミュレーターのインストール"
description: "RISC-Vツールチェーンをインストールするには、まずriscv-gnu-toolchainのソースを取得します。clone時に`--depth=1`を付けるとダウンロード量を減らせます。READMEのPrerequisitesを確認し、必要な依存関係をそろえてから進めます。Debianではコマンドで依存パッケージをまとめて導入できます。"
date: 2023-05-24 17:51:09
categories: [fiddling]
tags: ["RISC-V","Spike","riscv-pk","クロスコンパイル","ツールチェーン"]
image: "https://blog-img.774352199.xyz/rWNOKx.webp"
seoDescription: "RISC-V GNUツールチェーン、Spike、riscv-pkをソースから導入。zifencei拡張不足によるコンパイルエラーを設定で解消し、Helloプログラムで動作確認します。"
---

暇つぶしにSpikeのソースを読もうと思ったのですが、いろいろな解説を見ても、Spikeと関連ツールチェーンをそのままインストールできるものがありませんでした。そこで自力で各リポジトリのREADMEを読み、ほぼ無事にインストールできました。ただ、一つ小さな落とし穴があったので記録しておきます。

### ツールチェーン（riscv-gnu-toolchain）のインストール

RISC-Vツールチェーンにはgcc、gdb、objdump/copyや関連する標準ライブラリ実装などが含まれます。最初に入れるのがおすすめです。

リポジトリ：https://github.com/riscv-collab/riscv-gnu-toolchain

clone時は`--depth=1`を付けると取得サイズを減らせます。以降のリポジトリでも同じオプションをおすすめします。

事前に必要な依存関係はREADMEのPrerequisites節にあります。現時点でのDebian系向けコマンドは次のとおりです。

```bash
sudo apt install autoconf automake autotools-dev curl python3 libmpc-dev libmpfr-dev libgmp-dev gawk build-essential bison flex texinfo gperf libtool patchutils bc zlib1g-dev libexpat-dev ninja-build
```

clone後はツールチェーンの`Installation (Newlib)`節に従えば大体インストールできますが、落とし穴があります。

> この方法でビルドしたgccではriscv-pkをコンパイルできず、extension `zifencei' requiredというエラーになります。デフォルトのビルドオプションでzifencei拡張、つまりFENCE.I命令が有効になっていないためだと推測しています。

次のビルドオプションなら動きます。

```bash
./configure --prefix=/opt/riscv --with-arch=rv64gc
make
```

先に/optの下へriscvディレクトリを作り、自分の一般ユーザーが所有者になっていることを確認しておくのがおすすめです。違う場合はchownします。

```bash
sudo chown 1000:1000 /opt/riscv
```

ここではuidとgidをどちらも1000としています。実際の値は`id`コマンドで確認できます。

インストール後は`/opt/riscv/bin`をPathに追加します。具体的な方法はGoogleやChatGPTで調べてください。以降にインストールするものも、すべて`/opt/riscv`に入れます。ここまでで`riscv64-unknown-elf-gcc`が使えるはずです。

### エミュレーター（spike）のインストール

リポジトリ：https://github.com/riscv-software-src/riscv-isa-sim

cloneしてREADMEのBuild Stepsに従えば、そのままインストールできます。こちらに落とし穴はありません。現時点でのコマンドです。

```bash
$ sudo apt install device-tree-compiler
$ mkdir build
$ cd build
$ ../configure --prefix=/opt/riscv
$ make
$ make install
```

インストールできたら、`spike`コマンドが使えるはずです。

### 代理カーネル（riscv-pk）のインストール

リポジトリ：https://github.com/riscv-software-src/riscv-pk

pkはProxy Kernelの略で、静的リンクされたユーザー空間のRISC-Vプログラムを直接実行するためのものです。動作確認だけのためにOSを丸ごと動かすのは重すぎますからね。

cloneしてREADMEのBuild Stepsに従えばインストールできます。注意点は、ツールチェーンの節で触れたFENCE.I命令だけです。現時点でのコマンドは次のとおりです。

```bash
$ mkdir build
$ cd build
$ ../configure --prefix=/opt/riscv --host=riscv64-unknown-elf
$ make
$ make install
```

### 動作確認

Spikeのサンプルで確認します。hello.cを作り、次の内容を書きます。

```c
#include <stdio.h>

void main()
{
    const char *s = "Hello.\n";
    while (*s) putchar(*s++);
    while(1);
}
```

このファイルをコンパイルします。

```bash
$ riscv64-unknown-elf-gcc -o hello hello.c
```

Spikeで実行します。

```bash
spike pk hello
```

端末にHello.と表示されるはずです。ctrl+cを何度か押すと終了できます。
