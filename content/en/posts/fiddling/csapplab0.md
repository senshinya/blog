---
authorship: human-only
title: "Setting Up the CSAPP Lab Environment"
description: "The labs are an essential part of learning CSAPP, but setting up Linux can be discouraging. Virtual machines bring installation errors, compatibility problems, and broken networking. WSL (Windows Subsystem for Linux), especially on Windows 10 version 2004 and later, provides a simpler, more direct Linux environment without the complexity and performance bottlenecks of a traditional VM."
date: 2021-12-27 00:09:00
categories: [fiddling]
tags: ["Tinkering", "CSAPP", "labs", "environment setup"]
image: "https://blog-img.774352199.xyz/vqOC7N.webp"
---

### Introduction

> Studying CSAPP without doing the labs is like reading China's Four Great Classical Novels but skipping Dream of the Red Chamber. It exposes a lack of literary accomplishment and self-cultivation: you cannot appreciate its refined inner artistry, seeing only ornate words while failing to grasp its profound spiritual core. Your entire existence hits its ceiling there, leaving you a relatively unsuccessful life.

The biggest deterrent to doing CSAPP labs is the Linux environment. I did them as an undergraduate using Ubuntu Desktop in VMware Workstation. I personally had no trouble, but people around me ran into:

* Virtual machine installation errors
* VMware incompatibility with Hyper-V
* No network in the VM
* Shared folders between guest and host not working
* Chinese input methods in Ubuntu
* Other inexplicable problems

VM performance is also hard to praise. You have to carve out memory from the host, and you never know which will run out first: the guest or the host.

For these reasons, I chose WSL (Windows Subsystem for Linux). I recommend Windows 10 version 2004 or later, or Windows 11, for WSL 2. Older Windows versions, even those with WSL, only support WSL 1, which translates Linux system calls into Windows system calls. WSL 2 uses a lightweight, maintenance-free VM running a complete Linux kernel. A full Linux kernel is crucial for the CSAPP labs.

What about macOS? On an Intel MacBook, install VirtualBox, VMware Fusion, or Parallels Desktop and run a Linux distribution, or use Docker. For an M1 MacBook, **get another computer**. I am not joking: you really cannot do the labs on M1.

Wow, I really do talk too much.

### Installing WSL and Ubuntu

Installing WSL on Windows is easy. Run this in an administrator PowerShell:

```shell
wsl --install -d Ubuntu
```

Windows automatically enables the required features and downloads the latest Ubuntu LTS, version 20.04 at the time of writing. Once installation finishes, a terminal asks you for a username and password:

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

Note that nothing appears on screen while you type your password.

After setup, you will see a prompt such as `shinya@DESKTOP-4TMFLAE:~$`, waiting for a command. You are now in Ubuntu.

### A few useful tips

#### Windows Terminal

Windows Terminal is arguably the king of terminals on Windows.

Search for “Windows Terminal” in Microsoft Store to install it, or download the msixbundle from its GitHub Releases page, [https://github.com/microsoft/terminal/releases](https://github.com/microsoft/terminal/releases), and double-click it.

If WSL and Ubuntu are already installed, an Ubuntu entry appears in the dropdown next to the plus sign in Windows Terminal's top bar. Click it to open Ubuntu's default shell.

#### File sharing

Ubuntu in WSL and Windows are isolated systems with separate filesystems. Isolated, but not entirely.

Windows's C drive is mounted at /mnt/c in Ubuntu. For example, to access the Windows desktop from Linux:

```shell
$ cd /mnt/c/Users/Shinya/Desktop
$ ls
 course.py     desktop.ini     szxx.bat     szxx.txt
```

Likewise, to view files in WSL's own filesystem from Windows, such as your home directory ~, run:

```shell
$ cd ~
$ explorer.exe .
```

Windows File Explorer opens the folder you requested. You can work with it just like a Windows folder.

#### Visual Studio Code

VS Code, the world's best text editor, can open WSL folders directly, offering the same experience as a local project. After all, not everyone enjoys doing their labs in vim.

Open VS Code on Windows, search for WSL in the extensions marketplace, and install “Remote - WSL”. It is usually the first result.

Then, from your project directory in Ubuntu, run:

```shell
$ code .
```

The first time you run it, the necessary support components are installed:

```shell
$ code .
Installing VS Code Server for x64 (899d46d82c4c95423fb7e10e68eba52050e30ba3)
Downloading: 100%
Unpacking: 100%
```

VS Code on Windows then opens automatically with the Ubuntu project folder as its working directory. Develop however you like from there.

#### Switching to Chinese package mirrors

First, what is a “source”?

> Ancient texts tell of a time when heaven and earth mingled to create all things, amid dense chaos and spiritual mist. Many spiritual beings absorbed the primordial essence of the world, forming amber-like crystals that sealed vast stores of life essence within.  
> Those surviving today are called “Sources”.

Sorry, wrong universe.

Put simply, apt, the package manager used by Ubuntu and other Debian-based systems, maintains a list of URLs. When you run apt install, it searches, downloads, and installs packages from those addresses. This URL list is the package sources. The defaults point overseas, and for well-known reasons they can be slow or entirely unreachable from China. So we replace them with mirrors within China.

Here is how:

```shell
$ sudo mv /etc/apt/sources.list /etc/apt/sources.list.bak
$ sudo nano /etc/apt/sources.list
```

Paste the following. I use Alibaba's mirror here. Different distributions and versions need different sources, so choose carefully. These are for Ubuntu 20.04.

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

Then refresh the package lists and upgrade packages:

```shell
$ sudo apt update
$ sudo apt upgrade
```

### Installing software for the labs

#### Packages

The essentials take just one command:

```shell
$ sudo apt install build-essential gcc-multilib gdb
```

Optional: cgdb, a lightweight frontend for GDB. It provides a split view of the gdb command interface, identical to regular gdb, and your source code. The repository's cgdb is not the latest version, so I build it from source:

```shell
$ sudo apt install automake libncurses5-dev flex texinfo libreadline-dev
$ git clone git://github.com/cgdb/cgdb.git
$ cd cgdb
$ ./autogen.sh
$ ./configure --prefix=/usr/local
$ make
$ sudo make install
```

Once installed, you can open it anywhere with the cgdb command. It looks like this:

![CGDB](https://blog-img.774352199.xyz/2025/a36f15210399888f0e0cf56efe45a202.jpg)

CGDB

The left pane is the source window; the right is the gdb window.

By default, cgdb stacks the two panes one above the other. Press `ctrl+w` to switch to side-by-side panes.

Press esc to move focus from gdb to the source window. There you can scroll through the source and press space to set a breakpoint on the focused line.

Press i to return focus to the gdb window, which works exactly like regular gdb.

For more details, see this [CGDB manual in Chinese](https://leeyiw.gitbooks.io/cgdb-manual-in-chinese).

#### Where are the labs?

If you are studying CSAPP independently, visit [http://csapp.cs.cmu.edu/3e/labs.html](http://csapp.cs.cmu.edu/3e/labs.html). Each lab's Self-Study Handout link downloads the lab materials. Copy them into WSL and enjoy the labs!
