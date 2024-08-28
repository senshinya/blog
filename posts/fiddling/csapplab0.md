---
title: CSAPP LAB 环境搭建
tags: ["CSAPP"]
category: 折腾
date: 2021-12-27T00:09:00+08:00
author: "shinya"
---

### 前言

> 学 CSAPP 不做实验，就像四大名著不看红楼梦，说明这个人文学造诣和自我修养不足，他理解不了这种内在的阳春白雪的高雅艺术，他只能看到外表的辞藻堆砌，参不透其中深奥的精神内核，他整个人的层次就卡在这里了，只能度过一个相对失败的人生。

劝退 CSAPP 实验人的最大因素，就是 Linux 环境。本科时候做过一次，用的是 Vmware Workstation，安装 Ubuntu Desktop。虽然我个人倒是没遇到过什么问题，但是身边的人遇到过一下问题：

*   虚拟机安装错误
*   Vmware 与 Hyper-v 不兼容
*   虚拟机无网络
*   虚拟机与宿主机共享文件夹不好使
*   Ubuntu 中文输入法
*   其他玄学问题

另外，虚拟机的性能也是很难恭维，毕竟要从宿主机划出去一片内存，你永远不知道，是虚拟机先 OOM，还是宿主机先 OOM。

综上，我选择 WSL（Windows Subsystem for Linux，适用于 Windows 的 Linux 子系统）。推荐的操作系统是 Windows 10 Version 2004 以上，或者 Windows 11，以使用 WSL 2。低于此版本的 Windows，即使有 WSL 功能，也只是 WSL 1，使用翻译层将 Linux 系统调用转化成 Windows 系统调用，而 WSL 2 使用了一个轻量级的、无需维护的虚拟机，并在这个虚拟机中运行了一个完整的 Linux 内核。一个完整的 Linux 内核，对于 CSAPP 的实验至关重要。

什么，你问我 MacOS 怎么办，Intel 芯片的 MacBook 可以安装 VirtualBox、VMWare Fusion 或者 Parallel Desktop，并在其上安装 Linux 发行版，也可以使用 Docker。至于 m1 芯片的 MacBook，**建议换电脑**（不是开玩笑，m1 真的没法做实验）。

笑死，我发现我废话就真多。

### 安装 WSL 和 Ubuntu

Windows 安装 WSL 非常简单，只需要在一个有管理员权限的 PowerShell 中输入如下命令：

```shell
wsl --install -d Ubuntu
```

系统就会自动配置好所需的功能，并且自动下载 Ubuntu 的最新 LTS（截至本文写作时，版本 20.04）。在下载安装完成后，会弹出一个终端，要求你输入用户名和密码：

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

注意，输入密码时是不会显示在屏幕上的。

配置完成后，一个 `shinya@DESKTOP-4TMFLAE:~$` 样式的文字就出现了，等待你输入命令。至此，你已经进入了 Ubuntu 系统。

### 一些使用小技巧

#### Windows Terminal

Windows Terminal，可以说是 Windows 下的终端之王了。

安装 Windows Terminal 可以直接在 Microsoft Store 中搜索 “Windows Terminal”，或者在其 Github Releases 页面：[https://github.com/microsoft/terminal/releases](https://github.com/microsoft/terminal/releases)，下载 msixbundle 文件，双击即可安装。

如果你已经安装了 WSL 和 Ubuntu，那么在 Windows Terminal 顶栏加号下拉处，就会显示一个 Ubuntu 的选项。点击即可快速打开 Ubuntu 的默认 shell。

#### 文件共享

WSL 中的 Ubuntu 和你使用的 Windows，是两个隔离的系统，各自使用自己的文件系统。但是，隔离，但没完全隔离。

Windows 的 C 盘，在 Ubuntu 中被挂载到了 /mnt/c，例如你要在 Linux 中访问 Windows 的桌面：

```shell
$ cd /mnt/c/Users/Shinya/Desktop
$ ls
 course.py     desktop.ini     szxx.bat     szxx.txt
```

同样，如果想要在 Windows 上查看 WSL 自己的文件系统中的文件（例如 ~），可以通过如下命令，例如我想查看用户文件夹 ~：

```shell
$ cd ~
$ explorer.exe .
```

这时会打开 Windows 的资源管理器，其中就是你要查看的文件夹的内容。你可以像操作 Windows 自己的文件夹一样操作它。

#### Visual Studio Code

vscode，世界上最好的文本编辑器，支持直接打开 WSL 中的文件夹，完全提供本地项目一般的体验。毕竟，不是所有人，都喜欢直接在 vim 里做实验的。

首先打开 Windows 下的 vscode，在扩展商店中搜索 WSL，并安装 “Remote - WSL”，这个插件一般是这个关键词的第一个搜索结果。

随后在 Ubuntu 中，在项目文件夹下，输入命令：

```shell
$ code .
```

如果是第一次运行这个命令，会首先安装相关的支持组件：

```shell
$ code .
Installing VS Code Server for x64 (899d46d82c4c95423fb7e10e68eba52050e30ba3)
Downloading: 100%
Unpacking: 100%
```

随后就会自动打开 Windows 下的 vscode，并将 Ubuntu 中的项目文件夹作为工作目录，随后，想怎么开发就可以怎么开发了。

#### 更换中国源

首先明确，什么叫源：

> 据古籍记载，天地合气生万物的时代，混沌迷蒙，灵气氤氲，非常浓密，很多灵物可以吸收天地间的本源精气，结出琥珀般的晶体，里面封有庞大的生命精华。  
> 保存到现在的，便被称作“源”

sorry，串了。

简而言之，就是 Ubuntu，或者说 Debian 系使用的软件包管理器 apt，维护了一个 URL 列表，在用户通过 apt install 安装软件包时，会请求那些 URL 中搜索下载并安装。这个 URL 列表，就是源（sources）默认的 URL 都是国外的地址，由于众所周知的原因，速度很慢，甚至连接不了。所以需要将其更换为国内的源。

方法如下：

```shell
$ sudo mv /etc/apt/sources.list /etc/apt/sources.list.bak
$ sudo nano /etc/apt/sources.list
```

将如下内容粘贴进去，这里我使用的是阿里的源。注意，不同的发行版，不同的版本，源是不同的，注意甄别。这里我用的是 Ubuntu 20.04 的源。

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

随后刷新源并更新软件包：

```shell
$ sudo apt update
$ sudo apt upgrade
```

### 安装实验所需软件

#### 软件包

必要的就一句话：

```shell
$ sudo apt install build-essential gcc-multilib gdb
```

可选安装：cgdb。cgdb 是 GDB 的一个轻量级前端。它提供了一个分屏窗口，分别显示 gdb 命令界面（和默认 gdb 一样）和程序源码。由于软件源中的 cgdb 不是最新版本，于是从源码编译安装。方法如下：

```shell
$ sudo apt install automake libncurses5-dev flex texinfo libreadline-dev
$ git clone git://github.com/cgdb/cgdb.git
$ cd cgdb
$ ./autogen.sh
$ ./configure --prefix=/usr/local
$ make
$ sudo make install
```

安装完成后，就可以在任何位置，通过 cgdb 命令打开了。如下：

![CGDB](/images/cgdb.jpg)

CGDB

左侧的窗口被称为代码窗口，右侧为 gdb 窗口。

打开 cgdb 时，默认两个窗口是上下分隔的，可以通过 `ctrl+w` 切换成左右分隔模式。

按 esc 键可以将焦点从 gdb 窗口转移到代码窗口，在代码窗口可以上下翻看源码，空格键可以在焦点行设置一个断点。

按 i 键可以将焦点从代码窗口转移到 gdb 窗口，在 gdb 窗口的操作与普通 gdb 完全一致。

更具体的 cgdb 使用可以查看这本 [CGDB中文手册](https://leeyiw.gitbooks.io/cgdb-manual-in-chinese)。

#### 实验在哪？

如果你是自学 CSAPP，可以到这个网站：[http://csapp.cs.cmu.edu/3e/labs.html](http://csapp.cs.cmu.edu/3e/labs.html) ，每个实验后的 Self-Study Handout 连接就是实验材料的下载。传入 WSL，就可以快乐实验了！