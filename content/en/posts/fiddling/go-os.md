---
authorship: human-only
title: "A Project That Failed: Seven Not-So-Happy Days over Chinese New Year"
description: "Inspiration struck during Chinese New Year: an article read on the train about running Go on bare metal sparked an interest in low-level system interfaces. Its successful implementation suggested exciting possibilities for combining a high-level language with an OS. Further research revealed earlier work on the idea, and that growing enthusiasm became a project full of anticipation that ultimately did not work out."
date: 2023-02-02 23:24:55
categories: [fiddling]
tags: ["Tinkering", "golang", "os", "riscv"]
---

### How it started

On the high-speed train home for Chinese New Year, I came across this Zhihu article: [Running Go Programs on Bare Metal](https://zhuanlan.zhihu.com/p/265806072). The idea was to reimplement system interfaces and take over Go programs' system calls, interrupts, and so on. I found it fascinating. The author also wrote an impressively complete x86 OS in Go, [eggos](https://zhuanlan.zhihu.com/p/265806072). The Go runtime is modified underneath, invisibly to user programs, so third-party Go libraries work directly. There is even a TCP/IP stack, allowing networking libraries to work too. I was fired up.

Looking at earlier work, I found the idea had been around for a long time. An OSDI 2018 paper discussed the benefits and costs of implementing an OS in a high-level language; the slides are [here](https://www.usenix.org/sites/default/files/conference/protected-files/osdi18_slides_cutler.pdf). Recent implementations include [gopher-os](https://github.com/gopher-os/gopher-os), a proof-of-concept kernel intended simply to show that writing an OS in Go is feasible. MIT's PhD project [Biscuit](https://github.com/mit-pdos/biscuit) takes the approach of hacking the compiler to target bare metal. It is more complete, implements some POSIX interfaces, and can even run Redis and nginx.

I noticed a common feature: all targeted x86. I had previously written a small C kernel for RISC-V, whose assembly and mechanisms are simple and pleasant to work with. That gave me an idea: write a RISC-V operating system in Go.

No time like the present! I started the day after getting home.

### Let's do this!

An important part of any project is naming it. Kidding. Mostly.

But I really did think of a brilliant name first: goose.

![README](https://blog-img.774352199.xyz/2025/736f6c389e54c1327775f1aa95dad597.png)

Genius, folks!

Go natively supports cross-compilation to 64-bit RISC-V executables, which is good news. Just prefix go build with `GOOS=linux GOARCH=riscv64`. Very convenient.

As usual, I used QEMU and its virt platform. In virt's memory layout, addresses above 0x80000000 are physical RAM, while those below are MMIO: device memory is mapped there, so accessing it operates the device. virt sets the PC to 0x80000000 on startup.

Normally compiled Go executables run at user-space virtual addresses, with low entry addresses around 0x10000. Fortunately, Go provides the linker flag `-T` to specify the TEXT segment's starting address, allowing all code to be placed high in memory. `-E` selects the entry symbol, so I could write a function to take over Go's startup process. A Go program's entry is not main but `_entry`, which performs initialization.

One serious problem remained: specifying the entry function does not specify its address. I could not place it at 0x80000000, so virt might start executing who-knows-what there. In C, a linker script solves this trivially: one line sets the entry symbol's address. But this is Go.

Research led me to [this Stack Overflow question](https://stackoverflow.com/questions/69111979/using-custom-linker-script-with-go-build), suggesting an external linker instead of Go's built-in linker to allow a custom script. I tried it, but it was impractical. Besides the familiar text, bss, rodata, and data sections, Go executables contain all sorts of special sections that must be explicitly listed in the linker script. Nearly impossible.

So I changed approach: write a C entry routine that dynamically finds the Go entry point and jumps to it. That address exists in the ELF file, not in the loaded memory image. I could therefore link the entire ELF as binary data into the C program's data segment, naming its beginning and end `_binary_kernel_elf_start` and `_binary_kernel_elf_end` for easy access. The C code parses the embedded ELF, copies its loadable segments to their target memory addresses, and jumps to the entry point from the ELF header.

Here is the entry assembly. It sets up the stack, calls a C function, and embeds the compiled Go executable between two symbols in the data segment:

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

The C function bootmain is simple too: parse the ELF, read its program header table, and load each segment at the required physical address:

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

Finally, entry is the Go entry-function address read from the ELF header. Jump to it.

The Go entry function is rt0, written in assembly. Go uses Plan 9 assembly, originating in the ancient Plan 9 operating system. It supports multiple instruction-set architectures, yet bizarrely I could find no official documentation listing the supported instructions for each. Some x86 material exists because most Plan 9 examples target x86, but RV64 documentation was nowhere to be found. Pure guesswork.

After much experimentation, I finally wrote the entry routine:

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

This syntax is rather cursed too. It does roughly the same thing: call kernelStackTop to obtain the preallocated stack-top address, point SP there, then call the Go entry, kmain. The only Go file is simple:

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

The stack array is preallocated as the kernel stack, while kmain does nothing but loop forever. Notice the compiler directive `//go:nosplit` on every function. It prevents insertion of stack-overflow checking code and also implicitly prevents GC checkpoints. If GC were triggered, this bare-metal environment with nothing implemented could not support it. Of course, GC should not run in the kernel anyway; it is more concerned with user-space heaps.

The Makefile can then look like this:

```make
Image: kernel.elf
    $(CC) $(CFLAGS) -fno-pic -O -nostdinc -I. -c boot/boot.c
    $(CC) $(CFLAGS) -fno-pic -nostdinc -I. -c boot/boot_header.S
    $(LD) $(LDFLAGS) -T image.ld -o Image boot.o boot_header.o

kernel.elf:
    GOOS=linux GOARCH=riscv64 go build -o kernel.elf -ldflags '-E goose/kernel.rt0 -T 0x80200000' -gcflags "-N -l" ./kmain
```

kernel.elf builds the Go ELF with goose/kernel.rt0 as its entry and 0x80200000 as the TEXT start. Image compiles the kernel-loading entry code above. image.ld puts the entry function first in TEXT and places TEXT at 0x80000000.

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

All set!

I was so absorbed that I barely managed proper family visits over Chinese New Year. I spent all day shut in my room collecting information, and even outside I just stared into space thinking about approaches. I was obsessed.

### A grand failure

Dun dun dunnn!

After loading the kernel into QEMU, debugging showed it freezing while loading program segments into memory. I examined the ELF from go build with readelf and found this bizarre thing:

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

Look at the third segment's Offset: the enormous 0xffffffffffff1000. Offset is the position of a segment's contents relative to the start of the file. This ELF was only tens of kilobytes—where could such an offset come from? Even in memory, virt has only 128 MB of physical RAM by default. Instant disaster.

Baffled, I experimented until I found that adding the linker flag `-T` always caused this. But I could not omit it: these segments cannot be loaded at low addresses occupied by MMIO. I filed a Go GitHub issue, [cmd/link: wrong program header offset when cross-compile to riscv64 when setting -T text alignment](https://github.com/golang/go/issues/57983). After describing the problem, I received this reply:

![ISSUE](https://blog-img.774352199.xyz/2025/42c633b821d4323697e542b47a8fce31.png)

Apparently RV64's support for `-T` was incomplete...

The project has remained shelved ever since. Such a waste of that wonderful name /(ㄒo ㄒ)/ All I can do is hope Go fixes it, though RV64 does not seem to be a major priority. Native cross-compilation to RV64 only landed in mainline in the last few years...

I'm mad. Off to Rust!
