---
title: 装备
date: 2026-07-16 00:00:00
---

# 我在用的

我日常在用的一些东西。

<!-- 每件装备一个 ::gear-item：
     - 有真实照片时写 photo: /images/uses/xxx.jpg（放好图后跑一次 `pnpm gen:image-meta`），无则用 icon 图标块
     - params 是参数列表（键值对），随手写几条；写多写少都行
     - say 是「我的评价」，会钉在卡片底部
     - 自建服务用 active: true 显示运行中状态点，用 tag 显示类型标签 -->

:::gear-grid{title="电子产品" accent="primary" note="5"}
::gear-item
---
name: MacBook Pro 14"
tag: 电脑
icon: simple-icons:apple
params:
  处理器: M2 Pro
  内存: 16 GB
  入手: "2023"
say: 三年老伙计，除了续航焦虑和偶尔风扇起飞，几乎挑不出毛病。
---
::
::gear-item
---
name: Keychron K8 Pro
tag: 键盘
icon: tabler:keyboard
params:
  轴体: 茶轴
  连接: 蓝牙 / 有线
say: 换茶轴之后终于不吵室友了。
---
::
::gear-item
---
name: MX Master 3S
tag: 鼠标
icon: tabler:mouse
params:
  连接: 多设备
  续航: 70 天
say: 侧边滚轮刷长文档和代码是真香，但我还是更爱触控板的手势，两个换着用。
---
::
::gear-item
---
name: LG 27" 4K
tag: 显示器
icon: tabler:device-desktop
params:
  分辨率: 3840×2160
  接口: USB-C
say: 4K 字体渲染是回不去的舒服。
---
::
::gear-item
---
name: AirPods Pro
tag: 耳机
icon: tabler:headphones
params:
  代次: 二代
say: 降噪救了我的通勤，地铁里瞬间清净。
---
::
:::

:::gear-grid{title="自建服务" accent="accent" note="4 · 运行中"}
::gear-item
---
name: Umami
active: true
icon: simple-icons:umami
params:
  域名: umami.shinya.click
  部署: Docker
say: 不想给访客塞 Google Analytics，自己搭一个干净、不吃 cookie 的。
---
::
::gear-item
---
name: Memos
active: true
icon: tabler:notes
params:
  域名: memos.shinya.click
say: 碎碎念的归宿，比发朋友圈自在。
---
::
::gear-item
---
name: Bangumi 反代
active: true
icon: tabler:arrows-exchange
params:
  线路: Cloudflare
  缓存: 远端
say: 给番剧页续命，大陆访问快一大截，半夜偶尔要起来重启它。
---
::
::gear-item
---
name: Vaultwarden
active: true
icon: simple-icons:bitwarden
params:
  客户端: Bitwarden
say: 把密码从大厂手里拿回来，自己扛。
---
::
:::
