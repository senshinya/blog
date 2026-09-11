---
authorship: human-only
title: "Installing the RISC-V Toolchain and Emulator"
description: "To install the RISC-V toolchain, first obtain the riscv-gnu-toolchain source. Using `--depth=1` when cloning reduces the download size. Check the README’s Prerequisites section and install the required dependencies. On Debian, a simple package installation command prepares the environment for building the toolchain."
date: 2023-05-24 17:51:09
categories: [fiddling]
tags: ["Tinkering", "environment setup", "riscv", "spike", "riscv-pk"]
image: "https://blog-img.774352199.xyz/rWNOKx.webp"
seoDescription: "Build the RISC-V GNU toolchain, Spike, and riscv-pk from source, fix the missing zifencei extension, and verify the setup by compiling and running Hello."
---

I was bored and wanted to look through Spike's source, but none of the many tutorials I found got Spike and its toolchain installed out of the box. So I took matters into my own hands and read the repositories' READMEs. They mostly worked, with one small trap worth recording.

### Installing the toolchain (riscv-gnu-toolchain)

The RISC-V toolchain includes gcc, gdb, objdump/copy, the relevant standard library implementations, and so on. I suggest installing it first.

Repository: https://github.com/riscv-collab/riscv-gnu-toolchain

Add `--depth=1` when cloning to reduce the download size. I recommend the same flag for the repositories below.

See Prerequisites in the README for dependencies. On Debian-based systems, the current command is:

```bash
sudo apt install autoconf automake autotools-dev curl python3 libmpc-dev libmpfr-dev libgmp-dev gawk build-essential bison flex texinfo gperf libtool patchutils bc zlib1g-dev libexpat-dev ninja-build
```

After cloning, the toolchain's `Installation (Newlib)` instructions mostly work, but there is a catch:

> gcc built this way cannot compile riscv-pk: it reports extension `zifencei' required. I suspect the default build options do not enable the zifencei extension (the FENCE.I instruction).

These build options work:

```bash
./configure --prefix=/opt/riscv --with-arch=rv64gc
make
```

I recommend first creating a riscv directory under /opt and ensuring that your regular user owns it. Otherwise, use chown:

```bash
sudo chown 1000:1000 /opt/riscv
```

This assumes both uid and gid are 1000; use `id` to check your actual values.

After installation, add `/opt/riscv/bin` to Path. Google or ChatGPT can explain how. Everything installed below will also go into `/opt/riscv`. Once done, `riscv64-unknown-elf-gcc` should be available.

### Installing the emulator (spike)

Repository: https://github.com/riscv-software-src/riscv-isa-sim

Clone it and follow Build Steps in the README. No traps here. The current commands are:

```bash
$ sudo apt install device-tree-compiler
$ mkdir build
$ cd build
$ ../configure --prefix=/opt/riscv
$ make
$ make install
```

The `spike` command should now be available.

### Installing the proxy kernel (riscv-pk)

Repository: https://github.com/riscv-software-src/riscv-pk

pk stands for Proxy Kernel. It runs statically linked user-space RISC-V programs directly; running an entire OS would be overkill just to test something.

Clone it and follow Build Steps in the README. The only catch is the FENCE.I instruction mentioned in the toolchain section. The current commands are:

```bash
$ mkdir build
$ cd build
$ ../configure --prefix=/opt/riscv --host=riscv64-unknown-elf
$ make
$ make install
```

### Verification

For verification, I used an example from Spike. Create hello.c with the following contents:

```c
#include <stdio.h>

void main()
{
    const char *s = "Hello.\n";
    while (*s) putchar(*s++);
    while(1);
}
```

Compile the file:

```bash
$ riscv64-unknown-elf-gcc -o hello hello.c
```

Run it through Spike:

```bash
spike pk hello
```

You should see Hello. printed in the terminal. Press ctrl+c several times to exit.
