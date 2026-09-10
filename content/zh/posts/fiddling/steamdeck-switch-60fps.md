---
title: "Steam Deck 的第二春：Switch 模拟器到插帧 60FPS 一条龙"
description: "这何尝不是一种 NTR"
date: 2026-09-09 23:59:00
categories: [fiddling]
tags: ["Steam Deck", "Switch", "EmuDeck", "Eden", "Lossless Scaling"]
---

### 引子

近期筹划国庆旅游，花了不少，想着回收点闲置旧物回回血。盘点旧物时，翻出了此前海淘回来的港版 SteamDeck。入手价四千多，爱回收估了下价格，还能卖到三千多，有些心动，遂下了一单回收

等待上门时，把机器接上电源准备重置下系统清除数据，越操作越顺手，看着这十成新的机器，买来几乎没怎么玩过，忽的有些心疼。想了想，还是把回收取消了。最近愈发不想坐在电脑前玩上一两个小时的游戏了，一来失去了对超重量级叙事型游戏的耐心，二来租房里的这套桌椅也给我的肩颈腰臀腿带来了很大的挑战（不得不服老，三四年前还能坐着硬板凳玩原神到凌晨四点），决心回归一些心智负担较轻的、可以随时拿起随时放下的游戏。SteamDeck 这台机器正好可以满足我

于是升级了下系统，把 p5r 和文明 7 下了回来，这俩游戏买来就一直没功夫玩。在 youtube 翻找游戏推荐时，撞见了一条 SteamDeck 安装  Switch 模拟器的视频，看了下大致介绍，似乎已经十分成熟，配合一些超分插帧的模组，大部分游戏甚至能稳 60 帧，体验比 Switch 还要好。十分心动，于是动手折腾了一遍，部分内容由于有时效性，安装过程中踩了些坑

YouTube 视频在

::video-embed{type="youtube" id="WZ8UunuMLqc"}
::

### 安装 EmuDeck

::alert{type="tip"}
以下所有操作都应直接在 SteamDeck 上进行，所有的软件安装都是安装在 SteamDeck 上
::

首先安装 EmuDeck，用于统一管理 SteamDeck 上的模拟器，且可以将模拟器游戏导入到 Steam 中启动

::link-card{link="https://www.emudeck.com" title="EmuDeck"}
::

滚动到页面最底端下载 steamOS 版本即可

如果通过 SteamDeck 的 firefox 下载的话，下载产物会额外多一个 `.download` 后缀，如 `EmuDeck.desktop.download`，重命名移除 `.download` 后缀即可

直接双击启动，会弹出终端开始下载，完成后会弹出配置过程。

1. 选择 Custom Mode
2. ROM Directory 是后续游戏 ROM 的存放位置，如果没有外置 SD 卡则直接选择 Internal Storage
3. Device 直接选择 Steam Deck
4. Level of Integration 选择 Highest，我们需要 Steam Rom Manager
5. Emulators and tools for Steam Deck 全部取消勾选
6. Emulator and Tools Configuration 仅保留 EmulationStation DE，其他都取消勾选
7. Configure Controller Layout 是键位映射，这里按喜好选择即可，后续还可调整

完成这些选择后再下一步，会出现索尼克的画面，选择的组件即开始在后台下载安装了。完成后会进入 Post Installation，用来配置 ROMs 和固件。由于还没有下载任何模拟器，这一步可以忽略，跳过即可

随后从桌面或者应用菜单中启动 EmuDeck，在 Manage Emulators 中找到 Steam Rom Manager，如果有 Update Configuration 则执行一下，再执行一遍 Reset Configuration。返回，再进入 EmulationStation-DE，点击 Install，再执行一遍 Reset Configuration

从 EmuDeck 的左侧菜单中启动 Steam ROM Manager，注意背景应当是 Steam Deck
图案。Choose 选择自己的账号后 Save 点击 Next

### 安装 Eden 并导入游戏

从 eden 的 git release 找到最新的 release，下载 Steam Deck 版本的 PGO AppImage

::link-card{link="https://git.eden-emu.dev/eden-emu/eden/releases" title="Eden Releases"}
::

将下载产物重命名为 `Eden.AppImage` 后移入 `Home/Application` 目录下

双击启动，会提示密钥缺失，先点击 No 不安装

模拟器需要一台真实的 Switch 机器，用于提取 keys 和固件导入模拟器，如果你没有

Well……我在这里放一个网站，你可以自行研究

::link-card{link="https://prodkeys.net/" title="prodkeys.net"}
::

获取到 keys 和 firmware 后，keys 解压，firmware 保持 zip 压缩包。Eden - Tools - Install Decryption Keys 选择解压的 keys 文件夹安装密钥。Eden - Tools - Install Firmware - From ZIP 选择 firmware 压缩包安装固件

接着就可以导入游戏 Rom 了，Eden 支持 xci 和 nsp 格式的 Rom。游戏 Rom 应当从真实的 Switch 机器中获取，如果你还是没有

Well……这里再放一个网站，供你们自行研究

::link-card{link="https://nswpedia.com/" title="nswpedia.com"}
::

获取到的 Rom 移动到 `Home/Emulation/roms/switch` 目录下，本体放在根目录， DLC 和更新补丁包建议新建一个 Update 目录存储

在 Eden 中双击页面上的添加文件夹的图标，选择 `Home/Emulation/roms/switch`，即自动扫描全部游戏本体和 Update DLC

### 连接 Eden 和 EmuDeck

现在安装好了 Eden，需要让 EmuDeck 识别出来。从 EmuDeck 进入 Steam ROM Manager，进入 Settings，Select Theme 选择 Classic。在左侧菜单中找到 `Nintendo Switch - Eden`，右侧默认的 Executable 配置是一个默认值，而非你安装的 Eden 位置。将其改为 Application 中的 Eden.AppImage，反显的值应当是 `/home/deck/Applications/Eden.AppImage`，点击保存，回到 Settings 中将 Theme 改回 EmuDeck

点击右下角 Parsers，将 Parsers 全部关闭后，单独打开 Eden。点击 Add Games，即可看到添加到 Eden 的游戏都展示了出来。只是有个问题，游戏的 DLC 和 Update 也被额外展示了一次。点击右下角 Exclude Games，将 DLC 和 Update 全部标灰，保证只有游戏本体亮起，即可 Save Excludes。点击 Save to Steam，等待片刻直到右上角显示 `Done adding/removing entries` 完成添加

这时返回 Steam Gaming Mode 就能看到游戏出现在 Steam 库中的 Non-Steam 部分了，且单独编入了一个 Collection 中，但此时不建议游玩，需要先配置一下键位映射和陀螺仪驱动

::pic{src="https://blog-img.774352199.xyz/xo23fk.jpeg" width="1280" height="800"}
::

### 配置键位和陀螺仪

返回桌面模式，启动 EmuDeck，点击左侧菜单中的 Gyroscope - Install，安装陀螺仪驱动

 完成后返回 Steam Gaming Mode，启动库中的 Emulation Station，选择 Emulators Various，再选择 Eden，启动 Eden

::folding{title="如果此时 Eden 没有出现在 Emulators Various 中，甚至都没有 Emulators Various 这个选项，按如下步骤进行"}
1. 返回桌面模式
2. 选择 Eden，Reset Configuration
3. 选择 ES-DE，Reset Configuration
4. 重启 Steam Deck
::

Eden 界面中，选择 Emulation - Configure - Controls，保证 Controller 选择 Pro Controller，Input Device 选择 Steam Virtual Gamepad 0

Face Button 中，可以设置 XYAB 的键位映射，我的建议是 AB 映射可以保持 AB，但是 XY 映射为 YX，不过还是看个人习惯了

Motion 1 配置陀螺仪，点击切换到 `Shake!`，再晃动 Steam Deck 机身，Eden 会识别到陀螺仪驱动。此时旋转 Steam Deck，如果界面中的 Pro Controller 中间顶部的立方体跟随旋转，说明陀螺仪识别正确

完成配置后点击 OK 保存

### 小黄鸭插帧

这时启动游戏，大部分游戏都可以跑到 30 帧左右，这个帧数在 Steam Deck 上体验不是很好，画面卡顿且不跟手

这时就需要大名鼎鼎的小黄鸭 Lossless Scaling 进行补帧。小黄鸭无法原生运行在 Steam Deck 上，所以需要一些额外的手段

::alert{type="info"}
所有的前提是先购买 Lossless Scaling 并安装好 lsfg-vk 版本
::

首先安装 Decky Loader，桌面模式下载后运行即可完成安装

::github{repo="SteamDeckHomebrew/decky-loader"}
::

安装完成后，在 Steam Gaming Mode 下，按下 QAM 键（右下角 ... 键），边栏最下方就会出现 Decky 菜单

接着安装 Decky LSFG-VK，下载 Release 中的 Zip 即可，推荐直接下载 Pre-release 版本

::github{repo="xXJSONDeruloXx/decky-lsfg-vk"}
::

接着在 Decky 菜单 - 设置 - 通用中开启开发者模式，并通过开发者菜单 - 从 ZIP 压缩文件安装插件，选择 Decky LSFG-VK 的压缩包完成安装

从 Decky 进入 LSFG-VK 的菜单， FPS Multiplier 点击 + 号到 2X，开启 Present Mode，后续如果达不到 60 帧可以开启 Performance Mode，这个模式下会使用性能更高的模型，代价是移动视角时会出现鬼影，最后点击 Copy Launch Option

对需要插帧的游戏（基本就是每个 Switch 游戏），进入菜单 - 属性 - 快捷方式 - 启动选项，在 `vblank_mode=0` 后粘贴刚刚的复制的内容，并删除重复的 `%command%`，最后的启动选项看起来是这样的 `vblank_mode=0 ~/lsfg %command% -f -g ...`

由于小黄鸭只能运行在 vulkan 下，还需要将 Eden 的运行模式改到 Vulkan。从 Emulation Station 启动 Eden，Emulation - Configure - Graphics，API 选择 Vulkan，VSync Mode 选择 Mailbox，点击 OK 保存

万事俱备，此时启动游戏，在短暂的波动后，帧率基本可以稳定在 60fps

Enjoy

::pic{src="https://blog-img.774352199.xyz/FeC82s.jpeg" width="1280" height="800" caption="本想截一个带新能叠加界面的截图，但默认截屏会隐藏浮层"}
::
