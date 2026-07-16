---
title: "一个 TREK 引发的二十个 stack"
description: "刷 GitHub trending 刷到一个旅行规划工具，想自己跑一台。既然都要开新 VPS，那就顺手多装亿点点。"
date: 2026-05-11 22:43:00
categories: [折腾]
tags: ["折腾", "vps", "自托管"]
---

前几天刷 GitHub trending，看到一个叫 TREK 的项目，让一群人在同一张地图上排路线、订住宿、列预算，做完还能丢给别人接着改。点进 demo 站玩了一圈，很精致。

跟 npy 出去玩的行程一直是拿 Obsidian 拼的，几个 daily note 来回链着写，越写越乱，到出门那天往往还是粗糙的「早上去哪下午去哪」。作者的 demo 可以直接用，但行程这种东西放在别人机器上多少有点不放心，早晚得自己部署。

既然要自己部署，索性开一台新 VPS。

### Netcup ARM

挑 VPS 比想象中纠结。DigitalOcean 和 Linode 同配置贵一倍以上，直接排除。Hetzner 性价比是有的，可惜 ARM 节点选址不灵活。国内小厂便宜，但备案是大坑，而且带宽小的可怜。兜了一圈还是 Netcup。

型号是 VPS 2000 ARM G11，10 vCore、16G 内存、512G NVMe、2.5 Gbps，月价 €13.41 含税。同样的配置放到 x86 至少得贵一倍。流量走 flatrate，24 小时滑动平均超过 2 TB 才限速到 200 Mbps，我这种小破站根本碰不到。

下单前 Google 了一圈，捞到一张 -50% coupon，首期直接砍到 €6.7 出头，续费回原价，香就完事了。

机房有 Nuremberg、Wien、Amsterdam 和美东 Manassas 四个。最后挑了 Manassas，国内常见路由走过去 ping 比三个欧洲点都低一截。至于邮件 IP 信誉，我出站邮件全走 Resend 的 HTTPS 桥接（后面会讲），不落本地 IP，没必要为这个死磕欧洲机房。

### 从零到 TREK

下单到收到登录信息大概 5 分钟。第一件事不是装东西，而是先收紧 SSH 权限：禁 root、禁密码登录、改端口、ufw 默认 deny in。fail2ban 跑两天看日志，22 端口换掉之前一天 5000+ 次暴力尝试。

ARM64 镜像生态这两年好了很多。后面陆陆续续装的二十来个 stack 里，Caddy、Postgres、Stalwart、SnappyMail、Open WebUI、Vaultwarden、Dagu、Glance、Karakeep、Paperless 全都有官方多架构镜像，docker pull 直接 work。唯一费点事的是 Forgejo runner：base 镜像 ARM64 没问题，但我要在 runner 里跑 docker compose 当 deploy 工具，得自己加 docker-cli 和 docker-compose-plugin。最后用 buildx 推了一份 ARM64 镜像到自己的 Forgejo registry，runner 起来直接拉。

终于轮到 TREK 本身。仓库 mauriceboe/TREK 有官方 docker-compose.yml，照抄过来改了几行：

- 端口收成只对 web 这个 docker 网络可见
- ENCRYPTION_KEY 用 `openssl rand -base64 32` 新生成一把
- DATABASE_URL 走 SQLite，自己用够了
- 加上 web 这个 external network，跟 Caddy 接通

Caddyfile 那边一行 `reverse_proxy trek:3000` 收尾。从 `docker compose up -d` 到 trek.shinya.click 出登录页，前后不到 15 分钟。

看着空荡荡的 dashboard 注册完第一个账号，我下意识琢磨的不是「行程从哪开始拉」，而是「还能往这台机器里塞点啥」。

### 二十来个 stack

后半夜的折腾大概就是从这个念头开始的。~~手痒~~反正配置富裕，闲着也是闲着，干脆把一直想自托管的东西都搬上来。

第二天起床顺手装了 Forgejo 负责代码托管，博客也借此机会翻新了一遍，下面单独说。邮件是 Stalwart + SnappyMail + 自己写的 Resend bridge 三件套。AI 那条线挂 CLIProxyAPI，把 OpenAI / Claude / Gemini 几家订阅统一起来，前端是 Open WebUI。再往后是密码、网盘、图床、笔记、稍后读、RSS、PDF 工具集，能自托管的几乎都尝试了一遍。SSO 用 Authelia，一次登录处处可用。备份是 Dagu 起一个 DAG，每天加密快照到 R2。

陆陆续续装完，整套结构大概是这样：

![画的时候还没把博客算进去，现在看只会更满](https://blog-img.774352199.xyz/4F9LtW.png)

入口侧走 Cloudflare SaaS 智能解析回源，Caddy 是唯一的外向 TLS 终点，按 Host 头反代到对应容器。需要登录的服务统一挂 Authelia forward_auth。出站邮件走 Resend 的 HTTPS API 桥接，绕开 Netcup 封掉的 25 端口。备份每天全量加密快照到 Cloudflare R2。

Dockge 面板里二十来个 stack 全绿着，看着确实有满足感。当然，这里面相当一部分是部署成瘾上头——本来只想要一个 TREK，最后 TREK 在这张图里只占一个小格子。

### 迁博客

之前博客是 Astro + retypeset，markdown push 上去走 CI 构建发布。用了一年多没出过大问题，但有几个点一直膈应：改个错别字也要 commit、push、等 build；想加个友链或者独立页面，还得重新折腾文件树。游记照片一多，构建慢得离谱。

于是趁此机会重构一下。

新栈是 SvelteKit 2 + adapter-node SSR + UnoCSS，视觉沿用 retypeset，样式按 UnoCSS 重写了一份。内容后端换成 PocketBase，建了 7 个 collection，把文章、标签、游记、游记天数、游记照片、独立页面、友链全收进 SQLite。i18n 改成 zh / en / ja 三语并存。Astro 那边导出来的 markdown 写了个 migration 脚本一锅倒进 PB，123 篇文章、4 篇游记、148 张游记照片记录，加上 pages 和 friends 全部落库。

部署改成蓝绿。blog-blue 和 blog-green 两个容器常驻，活色由 `/opt/app/blog/active` 标记，Caddy 的反代上游从 `/opt/app/caddy-blog/upstream.caddy` 这个文件 import。CI 推完新镜像跑 switch.sh：起 target 色、等 healthcheck、改 import 文件、caddy reload 切流，失败自动回滚。做完之后发文章不用再等三分钟 build，PB 后台改一下，保存即生效。

后台是 SvelteKit 内部的 SPA，挂在 /admin 下，走 Authelia forward_auth。admin 到 PB 的写请求经 Caddy 同源反代 `/api/pb/*`，token 由 Caddy 注入，浏览器和 git 仓库都摸不到这把 key。PB 写入会触发一个 JS 钩子 POST 到 blog 容器的内部端点，做服务端缓存失效，再调一次 Cloudflare API purge 边缘缓存，公开页平均还是 CDN 命中。

整个迁移两个晚上搞定。

### 后记

折腾了好几天，trek 到现在一篇规划也还没做 = =
