---
authorship: human-only
title: "失敗に終わったプロジェクト：楽しくなかった春節の7日間"
description: "春節の帰省列車で、Goをベアメタルで動かす記事を読み、低レベルのシステムインターフェースに興味が湧きました。実際に動く実装を見て、高級言語でOSを作る可能性に胸が躍ります。関連研究を調べると先行例も見つかり、積もった熱意は期待に満ちたプロジェクトへと変わりました。しかし、最後は思いどおりにはいきませんでした。"
date: 2023-02-02 23:24:55
categories: [fiddling]
tags: ["試行錯誤", "golang", "os", "riscv"]
image: "https://blog-img.774352199.xyz/xB1Ni5.webp"
seoDescription: "GoでRISC-Vカーネルgooseを作ろうとした春節の記録。CによるELFロードとアセンブリの入口を実装し、最後は-T指定によるリンカーのオフセット異常で開発を中断しました。"
---

### きっかけ

春節の帰省で乗った高速鉄道の中、知乎の[Goプログラムをベアメタルで動かす](https://zhuanlan.zhihu.com/p/265806072)という記事を読みました。システムインターフェースを実装し直して、Goプログラムのシステムコールや割り込みを引き受ける発想です。とても面白いと思いました。著者はGoでx86 OSの[eggos](https://zhuanlan.zhihu.com/p/265806072)も作っていて、かなりの完成度です。ランタイムを下から改造しているのでユーザープログラムは意識せずに済み、Goのサードパーティーライブラリもそのまま使えます。TCP/IPスタックまであり、ネットワークライブラリも動きます。読んでいて胸が高鳴りました。

先行事例を調べると、ずいぶん前からある発想でした。OSDI 2018には高級言語でOSを実装する利点とコストを論じた論文があり、スライドは[こちら](https://www.usenix.org/sites/default/files/conference/protected-files/osdi18_slides_cutler.pdf)です。近年の実装には、GoでOSを作れることを示す実証用カーネル[gopher-os](https://github.com/gopher-os/gopher-os)があります。MITの博士論文プロジェクト[Biscuit](https://github.com/mit-pdos/biscuit)はコンパイラを改造してベアメタルへ出力します。こちらはより完成度が高く、POSIXの一部に対応し、Redisやnginxまで動きます。

調べるうちに、すべてx86向けという共通点に気づきました。私は以前、Cで小さなRISC-Vカーネルを書いたことがあります。RISC-Vのアセンブリや各種の仕組みはシンプルで、書いていて気持ちがよいものです。そこで、GoでRISC-VのOSを作ろうと思いました。

思い立ったら即行動。帰省した翌日から始めました。

### とにかく作る！

プロジェクトで大事なのは、名前を付けることです。いや、冗談ですが。

でも、実際に最初に思いついたのは最高の名前でした。gooseです。

![README](https://blog-img.774352199.xyz/2025/736f6c389e54c1327775f1aa95dad597.png)

これは天才的でしょう！

まずGoは64ビットRISC-V実行ファイルへのクロスコンパイルに標準対応しています。go buildの前に`GOOS=linux GOARCH=riscv64`を付けるだけで、便利です。

仮想マシンはいつものQEMU、プラットフォームもvirtです。メモリ配置は0x80000000以上が物理RAM、それ未満がMMIOです。後者は機器のメモリがマップされ、そこを操作すると機器を操作することになります。virtの起動時はPCが0x80000000になります。

一方、通常のGo実行ファイルはユーザー空間の仮想アドレスで動くので、入口は0x10000付近の低いアドレスです。幸い、GoにはTEXTセグメントの開始を指定するリンクフラグ`-T`があり、コード全体を高いアドレスに置けます。`-E`で入口シンボルも指定できるので、Goの起動処理を引き受ける関数を書けます。Goの入口はmainではなく、初期化を行う`_entry`です。

ただし重大な問題が残ります。入口関数は指定できても、その関数の開始アドレスは指定できません。0x80000000へ配置できなければ、virt起動時にそこに何のコードがあるか分かりません。Cならリンカースクリプトで入口のアドレスを1行指定するだけです。しかし相手はGoです。

調べて[Stack Overflowの質問](https://stackoverflow.com/questions/69111979/using-custom-linker-script-with-go-build)を見つけました。内蔵リンカーではなく外部リンカーを使えばスクリプトを指定できるそうです。ただ試すと現実的ではありません。Goの実行ファイルにはtext、bss、rodata、data以外にも独自のいろいろなセクションがあり、すべてスクリプトで明示する必要があります。ほぼ無理でした。

そこで方針転換です。入口をCで書き、Goの入口を動的に調べて飛べばよさそうです。入口情報はELFファイルにしかなく、ロード後のメモリ像にはありません。ならばELF全体をバイナリとしてCプログラムのdataへ埋め込みます。始点と終点を`_binary_kernel_elf_start`、`_binary_kernel_elf_end`と名付ければ、Cからすぐ見つけられます。C側はそのELFを解析し、各ロード対象セグメントを対応するアドレスへコピーして、ELFが指定する入口へ飛びます。

入口のアセンブリは次のとおりです。スタックを設定してC関数へ飛び、dataの2つのシンボルの間にコンパイル済みGo実行ファイルを埋め込みます。

```asm
    .section .text.entry
    .globl _start
    # 仅仅是设置了 sp 就跳转到 main
_start:
    la sp, bootstacktop
    call bootmain

# 启动线程的内核栈 bootstack 放置在 bss 段的 stack 标记处
    .section .bss.stack
    .align 12
    .global bootstack
bootstack:
    # 以下 16K 字节的空间作为 OS 的启动栈
    .space 0x4000
    .global bootstacktop
bootstacktop:

    .section .data
    .globl _binary_kernel_elf_start
    .globl _binary_kernel_elf_end
_binary_kernel_elf_start:
    .incbin "kernel.elf"
_binary_kernel_elf_end:
```

C関数bootmainも単純です。ELFとプログラムヘッダーテーブルを読み、各セグメントを必要な物理メモリへロードします。

```c
void
bootmain()
{
    struct elfhdr *elf;
    struct proghdr *ph, *eph;
    void (*entry)(void);
    uchar *pa;
 
    elf = (struct elfhdr *)(_binary_kernel_elf_start);
 
    if (elf->magic != ELF_MAGIC)
        return;
 
    ph = (struct proghdr *)((uchar *)elf + elf->phoff);
    eph = ph + elf->phnum;
    for (; ph < eph; ph++)
    {
        pa = (uchar *)ph->paddr;
        readseg(pa, ph->filesz, ph->off);
        if (ph->memsz > ph->filesz)
            clearMem(pa + ph->filesz, ph->memsz - ph->filesz);
    }
 
    entry = (void (*)(void))(elf->entry);
    entry();
}
```

最後のentryはELFヘッダーから読んだGoの入口関数のアドレスです。そこへ飛ぶだけです。

Go側の入口rt0はアセンブリ関数です。Goが使うのは古のOS、Plan 9に由来するPlan 9アセンブリです。複数の命令セットに対応しますが、各アーキテクチャで使える命令を示す公式資料がなぜか見つかりません。例の大半がx86なのでそちらは多少情報があるものの、RV64は跡形もなく、完全に勘頼みでした。

試行錯誤の末、ようやく入口を書けました。

```asm
#include "textflag.h"

TEXT ·rt0(SB),NOSPLIT|NOFRAME,$0
    CALL ·kernelStackTop(SB)
    MOV  0(SP), A1
    MOV  A1, SP
    CALL ·kmain(SB)
    UNDEF
    RET
```

この書式もなかなか異様です。やることは同じで、kernelStackTopから確保済みスタックのトップのアドレスを取得し、SPをそこへ向けてGo側のkmainを呼びます。唯一のGoファイルも簡単です。

```go
type stack [16 * 4096]byte

type virtualAddress uintptr

var (
    kstack stack
)

//go:nosplit
func (s *stack) top() virtualAddress {
    stackTop := uintptr(unsafe.Pointer(&s[0])) + unsafe.Sizeof(*s)
    // Align to 16 bytes.
    stackTop = stackTop &^ 0xf
    return virtualAddress(stackTop)
}

//go:nosplit
func kernelStackTop() uint64 {
    return uint64(kstack.top())
}

//go:nosplit
func rt0()

//go:nosplit
func kmain() {
    for {
    }
}
```

stack配列をカーネルスタックとして先に確保し、kmainは無限ループするだけです。各関数には`//go:nosplit`が付き、スタックオーバーフロー検査の挿入を止めています。さらにGCチェックポイントの挿入を防ぐ暗黙の役割もあります。何も実装していないベアメタル環境ではGCは動かせません。そもそもGCはカーネルでなく、主にユーザー空間のヒープを扱うものですが。

Makefileはこう書けます。

```make
Image: kernel.elf
    $(CC) $(CFLAGS) -fno-pic -O -nostdinc -I. -c boot/boot.c
    $(CC) $(CFLAGS) -fno-pic -nostdinc -I. -c boot/boot_header.S
    $(LD) $(LDFLAGS) -T image.ld -o Image boot.o boot_header.o

kernel.elf:
    GOOS=linux GOARCH=riscv64 go build -o kernel.elf -ldflags '-E goose/kernel.rt0 -T 0x80200000' -gcflags "-N -l" ./kmain
```

kernel.elfではGoのELFを作り、入口をgoose/kernel.rt0、TEXTの開始を0x80200000にします。Imageは前述のカーネル読み込みコードをビルドします。image.ldでは入口関数をTEXTの先頭に置き、TEXT自体を0x80000000に配置します。

```plain
/* 执行入口 */
ENTRY(_start)

/* 数据存放起始地址 */
BASE_ADDRESS = 0x80000000;

SECTIONS
{
    /* . 表示当前地址（location counter） */
    . = BASE_ADDRESS;

    /* start 符号表示全部的开始位置 */
    kernel_start = .;

    text_start = .;

    /* .text 字段 */
    .text : {
        /* 把 entry 函数放在最前面 */
        *(.text.entry)
        /* 要链接的文件的 .text 字段集中放在这里 */
        *(.text .text.*)
    }
    ...
}
```

よし！

あまりに夢中で、春節中の親戚回りもろくにできませんでした。一日中部屋で資料を集め、外でもぼんやり手法を考えていて、取りつかれたようでした。

### 大失敗

じゃじゃーん！

QEMUにカーネルを読み込んでデバッグすると、セグメントをメモリにロードするところで固まっていました。go buildのELFをreadelfで調べたところ、奇妙なものがありました。

```bash
Type           Offset             VirtAddr           PhysAddr
                 FileSiz            MemSiz              Flags  Align
  PHDR           0x0000000000000040 0x00000000801ff040 0x00000000801ff040
                 0x0000000000000188 0x0000000000000188  R      0x10000
  NOTE           0x0000000000000f9c 0x00000000801fff9c 0x00000000801fff9c
                 0x0000000000000064 0x0000000000000064  R      0x4
  LOAD           0xffffffffffff1000 0x00000000801f0000 0x00000000801f0000
                 0x0000000000063300 0x0000000000063300  R E    0x10000
  LOAD           0x0000000000060000 0x0000000080260000 0x0000000080260000
                 0x000000000006adb8 0x000000000006adb8  R      0x10000
  ...
```

3つ目のOffsetが0xffffffffffff1000という巨大な値です。Offsetはファイル先頭からセグメント内容までの位置ですが、このELFは数十KBしかありません。こんなオフセットがどこから出るのでしょう。メモリに載せてもvirtの標準RAMは128MBなので、即座に破綻します。

分からずに実験した結果、リンク引数`-T`を付けると必ず起きると判明しました。しかし省くこともできません。低アドレスはMMIOなので、そこにロードできないからです。GoのGitHubに[cmd/link: wrong program header offset when cross-compile to riscv64 when setting -T text alignment](https://github.com/golang/go/issues/57983)を立て、状況を説明すると次の返事が来ました。

![ISSUE](https://blog-img.774352199.xyz/2025/42c633b821d4323697e542b47a8fce31.png)

どうやらRV64の`-T`対応が不完全なようです……。

こうしてプロジェクトは今まで棚上げです。せっかくのいい名前がもったいない /(ㄒo ㄒ)/ Go公式の修正を待つしかありませんが、RV64にはあまり力が入っていない気もします。RV64への標準クロスコンパイルがメインラインに入ったのも、ここ数年ですし……。

腹が立つので、Rustに行きます！
