---
title: "国行 Mac 折腾 Apple 智能：从换区到把 ChatGPT 抠出来"
description: "又一年 WWDC，macOS 27 又端上了全新的 Apple 智能。macOS 26 时代的法子已经无法偷渡，只能继续和苹果斗智斗勇了"
date: 2026-06-11 10:00:00
categories: [折腾]
tags: ["折腾", "macOS", "Apple 智能", "ChatGPT"]
---

又是一年科技春晚 WWDC，macOS 27 如约而至。该换的皮换了，该升的版本号升了，唯独 macOS 27 最大的升级：Apple 智能，国行机器依然无法使用，又是一次环大陆更新，依旧的二等公民。

去年 [macOS 26](/fiddling/macos-26-trial) 我还没什么感觉，今年想着机器都在手里了，不如折腾一下。本机是国行 MacBook air M5，系统 macOS 27（26A5353q）。整个过程分两段：先用一个内核扩展启用 Apple 智能，再尝试开启 ChatGPT 扩展——因为它有自己的一套地理围栏限制，比 Apple 智能整体的地区管控要严格的多。

## 原理

Apple 智能的整体地区管控，原理可以直接缩减如下：

```
MGGetStringAnswer("RegionCode") == "CH"  →  Apple 智能关闭
```

`RegionCode` 是实时从 IORegistry 的 `IOPlatformExpertDevice` 里读取的 `region-info` 属性，国行机器这个值是 `CH/A`。macOS 27 的 `eligibilityd` 基于 SwiftData 实时重算，所以以前的那些改 plist、锁 `uchg` 的老办法在这一代全部失效，改完一重启就会掉。

要从根本上解决这个问题，就得在 IORegistry 层把 `region-info` 改掉。GitHub 上的 [RegionSpoof](https://github.com/SkyBlue997/enableMacosAI) 项目就是这个原理：通过加载一个 kext，匹配 `IOPlatformExpertDevice`，在 `start()` 里把 `region-info` 设置成 `LL/A`（美版）、`country-of-origin` 设置成 `USA`。全系统每个进程从源头读到的就是美版区域，资格、模型下发、前端 UI 对应都可用了，无需每个进程都注入一次。

::github{repo="SkyBlue997/enableMacosAI"}
::

这个思路很简洁彻底，但是需要加载内核扩展。加载内核扩展，就需要关闭 SIP。

## 绕不开的 SIP

Apple Silicon 上加载第三方 kext，需要把系统完整性保护（SIP）关掉，并切到 Permissive 安全模式、允许第三方内核扩展。需要进入恢复模式。

关机后长按电源键进入恢复模式，打开终端，输入：

```bash
csrutil disable
```

随后重启回到系统，再在项目下执行：

```bash
sudo ./install.sh
```

脚本会检查 SIP 和 Apple Silicon 状态，装好 kext、配好开机自启的 LaunchDaemon，刷新 Apple 智能相关的守护进程。首次加载 kext 时系统会拦截，需要在「系统设置 → 隐私与安全性」中允许，重启即可。

这里有个坑：

::alert{type="warning" title="别顺手关掉 AMFI"}
关 SIP 的时候很多教程会要求加 `amfi_get_out_of_my_way=1` 这个 boot-arg。如果关闭 AMFI，SEP 就会拒绝给私有云计算出硬件证明，导致无法使用云端 AI，只能使用端侧。语气改写、图乐园这些靠 PCC 的功能全都无法开启。
::

安装完成后可以运行以下命令查看状态和验证：

```bash
sudo ./install.sh status     # SIP / AMFI / region / kext / 资格 一览
ioreg -ard1 -c IOPlatformExpertDevice | plutil -p - | grep region-info   # 应为 0x4c4c2f41 即 "LL/A"
```

`region-info` 值为 `LL/A`、资格域 GREYMATTER 的值为 4（eligible）。重启进设置，Apple 智能的配置项出现了，写作工具、Genmoji、图乐园、Foundation Models 全能正常使用。到这一步我以为已经收工了。

完美！

## 以为大功告成，ChatGPT 偏不出来

问题出在 Siri 的 ChatGPT 扩展。Siri 设置中，预期应当展示一个 ChatGPT 扩展的设置开关用于登录 ChatGPT 账号。Siri 还会提示「ChatGPT 的 Apple 智能支持内容仍在下载」。

一开始以为真的是下载卡住了，去抓 `generativeexperiencesd` 的日志，发现根本不是下载的问题，是下面 provider 被判成了隐藏状态：

```
Retrieved provider status for ChatGPT: .forciblyHidden, info:
  partnerNotSelected,
  useCaseDoesNotAllowCurrentIPCountryCode,
  useCaseDoesNotAllowUserLocaleRegion
```

三条原因如下：`partnerNotSelected` 是因为开关没有出现，暂且不论。真正的问题在于后两条：当前的 IP 国家码不符，系统的地区设置不符。

这就有意思了。kext 已经将设备区域改成了美版，`RegionCode` 是 US，但 ChatGPT 插件却不读取设备的 `RegionCode`，它依据 `countryd` 进程实时计算出的「你现在人在哪个国家」。也就是说 ChatGPT 扩展依据的是另一套地理围栏，而不仅仅是设备地区。

## 解决 countryd

挂上日本节点代理，确认出口 IP 是日本，连 Apple 自己的 GeoIP 接口都返回 JP：

```bash
curl -s https://gspe1-ssl.ls.apple.com/pep/gcc   # 返回 JP
```

原则上应当已经解禁。重启 `generativeexperiencesd` 重新判断，`isDisabled` 还是 `true`。去看 `countryd` 的结果，才发现 `countryd` 使用了一套十分复杂的机制。

`countryd` 判断国家靠的是如下优先级：

```
WiFiAP (优先级 1)  >  Location 定位 (优先级 4)  >  GeoIP (优先级 5)
```

代理只影响了 IP，对应的是优先级最低的 GeoIP。上面还有更高优先级的判断：WiFi 热点定位，和定位服务给的经纬度——这俩都把我定位到了中国大陆。

定位服务好处理，关掉即可，`LatLonLocation` 信号直接消失。地区设置也好处理，系统设置里把地区从中国大陆改成日本，`AppleLocale` 从 `zh_CN` 变成 `zh-Hans_JP`，`useCaseDoesNotAllowUserLocaleRegion` 就通过了。

麻烦的是 WiFi。我想当然以为换个手机热点就可以了，热点的 BSSID 总不在 Apple 的定位库里。连上热点抓日志，前半段确实如我所料：

```
21:49:42  "WiFi AP update", "countryCode":""     ← 热点本身查不到国家，是空的
21:49:51  "WiFi AP update", "countryCode":"CN"   ← 9 秒后又变回 CN
```

热点自己的 BSSID 返回空，这符合预期。可九秒之后又被归为 CN，因为 Apple 的 WiFi 定位不只看你连接的那个热点——它扫描周围**所有**的 WiFi 信号。我连上了热点，可我家、我邻居、整栋楼的国内路由器，照样把我定位到中国。

只要 WiFi 开着，连接哪个热点都没有用，周围的国内 AP 会前赴后继地出卖你。

~~Only Apple Can Do~~

## 关闭 WiFi

那么只要把 WiFi 关掉走有线，就能让 `countryd` 一个物理信号都获取不了，只能根据 GeoIP 判断。

我用的是 iPhone USB 网络共享，加上 Mac 上的全局日本代理。链路如下：手机 USB 网络共享，Mac 开启全局代理，保持 WiFi 关闭。再去看 `countryd`，GeoIP 终于变成了日本：

```
"CACHE: Geo IP country code changing", "from":"CN", "to":"JP, priority = 5 (GeoIP)"
```

但 overall 估算还是 CN。排查后发现，关 WiFi 不会主动发一个「清除」事件，`countryd` 把 WiFi 关闭前最后一次获取到的 `WiFiAP=CN` 缓存到了磁盘，每次重启都会从缓存中获取，由于优先级最高，导致 GeoIP 无法生效。

那就删除缓存：

```bash
sudo plutil -p /var/db/com.apple.countryd/countryCodeCache.plist
```

停掉服务、删缓存、在 WiFi 关闭状态下重启 `countryd`：

```bash
sudo launchctl bootout system/com.apple.countryd
sudo rm -f /var/db/com.apple.countryd/countryCodeCache.plist   # [!code highlight]
sudo launchctl bootstrap system /System/Library/LaunchDaemons/com.apple.countryd.plist
```

到这一步，`countryd` 的地区判定结果终于变成了日本，ChatGPT 的 `forciblyHidden` 解除，设置里的扩展开关出现了。

Finally！

开关出现后，开启 ChatGPT 即可，有 Plus/Pro 账号的可以登录。

::alert{type="tip"}
只要开启过一次 ChatGPT 扩展，后续即使切换回了 WiFi 和地区等配置，依然可以继续使用 ChatGPT。
::
