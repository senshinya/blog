---
title: "一个 TREK 引发的二十个 stack"
description: "本来只是想自部署一个旅行规划工具，结果从挑 VPS、加固服务器到迁博客、搭邮件、SSO、备份，一路装出二十多个自托管服务。"
date: 2026-05-11 22:43:00
categories: [折腾]
tags: ["折腾", "vps", "自托管"]
---

### 引

前几天刷 GitHub trending 看到一个项目叫 TREK，是个让一群人在地图上排路线、订住宿、列预算的项目，做完还能分享给别人继续改。点进 demo 站玩了一圈，挺顺手。

跟 npy 出去玩的行程一直是用 Obsidian 拼出来的，几个 daily note 来回链着写，越写越乱，往往到出门那天还是只有粗糙的"早上去哪下午去哪"。看到 TREK 我立刻就想自己跑一台。可以直接用作者的 demo，但旅行计划这种东西放别人服务器上多少有点不爽，早晚要自己部署。

既然要自己部署，索性顺手开一台新 VPS。

### Netcup ARM

挑 VPS 比想象中纠结。DigitalOcean / Linode 同等配置直接贵一倍以上；国内小厂便宜，但 25 端口出站和备案是两个潜在雷，能不碰就不碰；Hetzner 性价比好，可惜 ARM 节点选址不灵活。兜回来还是 Netcup 顺手。

具体型号选了 VPS 2000 ARM G11，10 vCore、16G 内存、512G NVMe、2.5 Gbps 网络，月价 €13.41 含税，配置放到 x86 那边怎么也得贵一倍。流量是 flatrate，24 小时滑动平均超 2 TB 才会限速到 200 Mbps，我这种小破站根本碰不到。

下单前我去 Google 了一圈，捞到一张 -50% coupon，首付直接砍到 €6.7 出头，续费时回到原价。我对这种"首期半价"的玩法没什么意见，反正首年这一刀已经够香了。

机房可选 Nuremberg、Wien、Amsterdam 和美东 Manassas 四个。最后挑了 Manassas，国内常见路由走过去 ping 比另外三个欧洲点都低一截。至于邮件 IP 信誉这事，反正我出站邮件都走 Resend HTTPS 桥接（后面会讲），不依赖本地 IP 落地，没必要为这个守在欧洲机房。

### 从零到 TREK 跑起来

下单到收到登录信息大概 5 分钟。第一件事不是装东西，先收 SSH：禁 root、禁密码登录、改端口、ufw 默认 deny in。fail2ban 跑两天看日志，22 端口换之前一天 5000+ 次暴力尝试，换之后掉到个位数。刚装的机器，外面的人比你急。

ARM64 镜像生态这两年好了很多，后面陆陆续续装的二十来个 stack 里，Caddy、Postgres、Stalwart、SnappyMail、Open WebUI、Vaultwarden、Dagu、Glance、Karakeep、Paperless 全都有官方多架构镜像，docker pull 直接 work。唯一稍微费点事的是 Forgejo runner，base 镜像是 ARM64 没问题，但我需要在 runner 里跑 docker compose 当 deploy 工具，得自己加 docker-cli 和 docker-compose-plugin。最后是 buildx 推了一份 ARM64 镜像到自己的 Forgejo registry，runner 起来直接拉。

终于轮到 TREK 本身。仓库 mauriceboe/TREK 有官方 docker-compose.yml，照抄过来改了几行：

- 端口收成只对 web 这个 docker 网络可见
- ENCRYPTION_KEY 用 openssl rand -base64 32 新生成一把
- 数据库 DATABASE_URL 走 SQLite，自己用够了
- 加 web 这个 external network，跟 Caddy 接通

Caddyfile 那边一行 reverse_proxy trek:3000 收尾。从 docker compose up -d 到 trek.shinya.click 出现登录页，前后不到 15 分钟。看着空荡荡的 dashboard 我注册了第一个账号，下意识琢磨的下一件事不是"行程从哪开始拉"，而是"还能塞点啥进这台机器"。这毛病我自己也知道。

### 装着装着就停不下来

后半夜的折腾大致就是从这种心思开始的。反正配置富裕，闲着也是闲着，索性把之前一直想自托管的东西都搬上来。

第二天起床顺手装了 Forgejo 把代码托管收回来，博客也借着这波翻新了一遍，下面单独说。邮件用 Stalwart + SnappyMail + 自己写的 Resend bridge 三件套。AI 那条线挂 CLIProxyAPI 把 OpenAI / Claude / Gemini 几家订阅统一起来，前面再罩一层 Open WebUI 自己用。再后面是密码、网盘、图床、笔记、稍后读、RSS、PDF 工具集，能自托管的几乎都过了一遍。SSO 用 Authelia 把这一票服务统起来，登录一次到处通用。备份用 Dagu 起一个 DAG 每天加密快照到 R2。

陆陆续续装完，整套结构大概就是这张图：

![架构图，不过还缺了博客部分](https://blog-img.774352199.xyz/4F9LtW.png)

入口侧全部走 Cloudflare SaaS 智能解析回源；Caddy 是唯一一台外向 TLS 终点，按 Host 头反代到对应容器；需要登录的服务统一走 Authelia forward_auth；出站邮件走 Resend HTTPS API 桥接绕开 Netcup 的封禁；备份每日全量加密快照到 Cloudflare R2。

回头看 Dockge 面板里二十来个 stack 全绿色亮着挺有满足感的，但我也承认这中间有相当一部分是部署成瘾型上头：本来只想要一个 TREK，最后是一整套自托管基础设施。TREK 在这张图里只占其中一个小格子。

### 顺手把博客也迁了

之前博客是 Astro + retypeset，markdown 文件 push 上去走 CI 构建发布。用了一年多没什么大问题，但有几个一直让我膈应的点：发个错别字 fix 也要 commit、push、等 build；想加个"友链"或者"独立页面"这种轻量页面，要重新折腾文件树；游记里照片多了构建慢得离谱。

正好新机器铺好了，索性把博客也一起翻了一遍。

新栈是 SvelteKit 2 + adapter-node SSR + UnoCSS，视觉沿用 retypeset 但样式按 UnoCSS 重写了一份。内容后端换成 PocketBase，建了 7 个 collection 把文章、标签、游记、游记天数、游记照片、独立页面、友链全收进 SQLite。i18n 改成 zh / en / ja 三语并存。原 Astro 那边导出来的 markdown 写了个 migration 脚本一锅倒进 PB，123 篇文章、4 篇游记、148 张游记照片记录加上 pages、friends 全部落库。

部署改成蓝绿：blog-blue 和 blog-green 两个容器都常驻，活色由 /opt/app/blog/active 标记，Caddy 反代上游从 /opt/app/caddy-blog/upstream.caddy 这个文件 import。CI 推新镜像后跑 switch.sh，起 target 色、等 healthcheck、改 import 文件、caddy reload 切流，失败自动回滚。这套做完整个发布流程从"push 等三分钟"变成"PB 后台改一下、保存即生效"。

后台是 SvelteKit 内部的 SPA 挂在 /admin 路径下，走 Authelia forward_auth。admin → PB 的写请求经 Caddy 同源反代 /api/pb/*，token 由 Caddy 注入，浏览器和 git 仓库都摸不到这把 key。PB 写入会触发一个 JS 钩子 POST 到 blog 容器内部端点，做服务端缓存失效再调一次 Cloudflare API purge 边缘缓存，公开页平均还是 CDN 命中。

整个迁移前后两个晚上搞定，意外地顺。

### 收尾

折腾了好几天，trek 到现在一篇规划也还没做 = =
