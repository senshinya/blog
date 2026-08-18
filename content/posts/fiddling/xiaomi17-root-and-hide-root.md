---
title: "小米 17 折腾日用：解锁、刷机、root 与隐藏"
description: "小米 17 解锁 Bootloader、刷入官改 ROM 和隐藏 root 的折腾过程，以及如何让银行、支付应用与代理软件恢复正常使用"
date: 2026-08-17 23:59:21
categories: [折腾]
tags: ["折腾", "root", "bootloader"]
---

::quote{icon="tabler:device-mobile"}
有些系统不折腾是为了日用，有些系统不折腾就很难日用
::

本科时很喜欢折腾手机（或者叫玩机），彼时很多品牌都可以直接解锁，社区充满了第三方 rom、root、hook…… 一片勃勃生机万物竞发的境界犹在眼前

工作后一度以为自己已经过了折腾的年纪了，用过一阵 iPhone，但始终不习惯。ai 时代的到来，经常有些小巧思，苹果封闭的生态，安装第三方软件都要折腾侧载和签名，麻烦的很（其实就是不想花99刀一年的开发者认证）。但是安卓机则陷入了一个奇怪的趋势，尺寸越做越大，iPhone标准版的大小在安卓阵营被称为小屏机（中杯大杯超大杯），我手小，iPhone标准版已是我操作的极限

上半年换了一部 oppo find x9s pro，非旗舰，胜在小屏。后面发现，除了小屏这一点外，其他痛点有点小多。我日常会挂着 vpn 做分流，并且开着 icost 自动记账，用到了无障碍服务。然而各种银行软件会检测无障碍和 vpn，一旦检测到就会拒绝服务，不胜其烦。这台机器的内核调度也有点问题，不知道是不是天玑全大核的缘故，一到夏天就发热的厉害，甚至都没有在玩游戏，仅是刷刷 x 和小红书就烫得要命，并且一发热，整个系统就卡顿的厉害，刷新率降到得有30帧。日用已成大问题

在某天晚上再一次经历了严重的卡顿发热后，终于下定决心换机。横向比较了一番，选定了小米 17，原因之一就是它的 6.3 英寸小屏。最终以旧换新加了 500 块换了台 16+512 的天蓝色版，遂感慨原机品牌和明星溢价之严重（原机由运动员代言，其粉丝以饭圈化出名）

等待送货的过程中，去酷安随便逛了逛，发现这款机子居然可以直接解 bootloader，也有很多作者为它做各种 rom 包，社区十分繁荣

> 还有意外收获

于是原生澎湃系统在到手后没有存活过 1h，就被我解开了 bootloader 锁并刷入了第三方官改 rom

::alert{type="warning" title="版本提醒"}
早期 8e5 设备的解锁漏洞，已经被 26 年 2 月份的系统安全补丁封堵，网络上能搜到的基本也是这个早期漏洞的解锁思路。在这个安全补丁后的系统版本的解锁，使用的基本都是 [@AC 极光_Official](https://www.coolapk.com/u/17883039) 的[一键解锁脚本](https://www.coolapk.com/feed/73105378?s=ZTE1ODk2OGIyMTY3NjVnNmE4MzIyOTh6a1651)。
::

rom 方面，酷安比较活跃的，做 17 系列澎湃官改 rom 的主要有两位，[江南](https://www.coolapk.com/u/25341491)和[毒蛇](https://www.coolapk.com/u/35810773)，两位都是高中生，现在的年轻人真强啊。我最终选择了[毒蛇的官改包](https://www.coolapk.com/feed/70200384?s=YTgxYmJmMWIyMTY3NjVnNmE4MzIzODJ6a1651)，自带 root，附带各种系统精简和第三方内核，调度调教的很好，流畅且省电，并且似乎 bug 相对较少。刷入也很简单，重启进入 bootloader 后即可一键刷入。

随后就是按部就班的安装 KernelSU、LSPosed、Zygisk Next 等框架。

root 后的系统，最麻烦的地方就是会被各种应用检测，尤其是银行 app 和支付 app，一旦检测到有 root 或者其他对系统的修改，就会降级（如禁止指纹）甚至直接拒绝服务，所以需要通过各种模块隐藏 root。

酷安或其他玩机社区，对隐藏 root 和解锁 bl 众说纷纭，其间夹杂着各种过期教程，更令找到一份完美的隐藏方式变得尤为困难。经过一番摸索，终归得以实现。

主要使用的模块只有五个：
::card-list
- [Magic Mount](https://github.com/Tools-cx-app/meta-magic_mount-rs)，核心框架
- [HMA-OSS](https://github.com/frknkrc44/HMA-OSS)，用于隐藏 app 列表以及隐藏无障碍
- [Integrity Box](https://github.com/MeowDump/Integrity-Box)，用于将机器伪装为 google 官方机器以通过 google play 检测
- [TEESimulator-RS](https://github.com/Enginex0/TEESimulator-RS)，生成安卓证书以通过硬件密钥认证
- [Tricky Addon Enhanced](https://github.com/Enginex0/tricky-addon-enhanced)：自动化 TEE 的证书生成流程
::

模块按照顺序刷入后重启

HMA-OSS 刷入后会有一个单独的 app，对需要隐藏 root 和无障碍等状态的 app 启用隐藏，并开启模板，设置四个应用预设（无障碍应用、检测器应用、Root 管理器/Root 应用和 LSPosed/Xposed 模块）以及两个设置预设（无障碍功能、开发者选项）。开启了隐藏的 app 便无法感知到系统安装了敏感应用或开启了敏感功能，即可绕过检测

接着运行一下 KernelSU 中 Integrity Box 模板的启动按钮，会随机挑选一个 Google 设备做伪装，TEESimulator-RS 则无需额外设置即可生效

Zygisk-Next 模块设置中的“排除列表策略”需要选择“仅换换挂载”

可以下载一个 [Hunter APP](https://github.com/w296488320/HunterUpdate) 用以检测 root 和相关伪装是否到位

::github{repo="w296488320/HunterUpdate"}
::

如遇 System Patch 不一致相关的错误，是因为 Integrity Box 用于伪装的设备系统的安全补丁与设备实际的安全补丁不一致，设备实际的安全补丁/安全更新可以在系统设置中查看。修改方法也很简单，在 TEESimulator-RS 的模块设置中，点击右上角三个点-设置安全补丁，勾上高级，将三个参数设置为设备实际的安全补丁日期。如我的设备是 2026-07-01，那么 System 设置为 202607，Boot 和 Vendor 都设置为 2026-07-01。完成后保存

如遇 Found hole in prop area: u:object_r:bootloader_prop:s0 一类的错误，则是因为设备实际的启动哈希值与用于伪装的设备的启动哈希值不一致。设备的启动哈希值可以在密钥认证这个 app 中获取（app 可以在酷安找到），复制出 BootHash 后粘贴到 Integrity Box - 修复异常 Boot Hash 后重启（复制不出来可以截图识屏）

如遇其他问题，还可以尝试 Integrity Box - 修复模式，能解决一些边缘小问题

完成后银行等 app 全部正常运行，微信支付宝等的指纹支付也可正常运行，Hunter 检测全绿

另外还可以通过 [Yumebox](https://github.com/YumeYucca/YumeBox) 作为代理软件，赋予 root 权限后即可启动 tun 网络接口，而非通过系统的 vpn 服务，即可避免第三方应用检测

::github{repo="YumeYucca/YumeBox"}
::
