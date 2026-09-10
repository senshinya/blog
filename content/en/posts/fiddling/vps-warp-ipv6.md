---
authorship: human-only
title: "Routing Selected VPS Traffic Through WARP over IPv6"
description: "A Telegram notification on an ordinary afternoon introduced a tempting VPS deal: a direct China Telecom CN2 route and 2.5G bandwidth. The plan includes IPv6, useful for unlocking streaming services, but not every connection needs to go through WARP. My previous script was convenient, yet its effects on speed and traffic routing called for a more flexible solution."
date: 2025-03-15 16:24:00
categories: [fiddling]
tags: ["Tinkering", "censorship circumvention", "warp", "traffic routing"]
---

On an ordinary afternoon last week, Telegram, which had been sitting quietly in the background for ages, received a notification:

![](https://blog-img.774352199.xyz/2025/c2dcc1d96db444256f1092fb0e15ce3d.png)​

A closer look: direct China Telecom CN2 routing, 2.5G bandwidth, 1T of transfer, and \$36 a year after the coupon. That is \$3 a month.

Now that’s a VPS deal to hold on to!

I paid immediately, then rallied friends and managed to talk three or four coworkers into buying one too.

This plan includes IPv6, which helps with unlocking various streaming services. Plenty of VPSes still have no IPv6 address, of course. And as the Chinese saying goes, a clever rabbit has three burrows: it pays to have a disguise when venturing outside. This is where WARP from our generous friends at Cloudflare comes in.

The WARP script I used before was [fscarmen/warp](https://gitlab.com/fscarmen/warp). Starting global mode redirects all outbound VPS traffic through WARP. There are two problems with that:

1. WARP reduces speed, and not all outbound traffic needs it. Usually only services picky about IP addresses, such as Netflix and OpenAI, need to use WARP.
2. Once WARP takes over all traffic, it sometimes prefers IPv4 even with a dual-stack exit. DNS resolution takes place inside WARP, remotely, so there is no way to intervene.

For the first problem, the script supports a non-global mode that exposes a local SOCKS proxy, letting proxy software route selected traffic through it. For the second, the proxy software can resolve DNS locally before sending the resolved traffic out through WARP.

You can select non-global WARP mode directly when running the installation script:

```shell
wget -N https://gitlab.com/fscarmen/warp/-/raw/main/menu.sh && bash menu.sh c
```

You can also select it from the menu after installation. Either WARP Linux Client or wireproxy works.

Once enabled, SOCKS listens on local port 40000 by default.

With that SOCKS service available, add a SOCKS outbound and route traffic as needed. Here is an Xray example; Clash and sing-box work similarly.

```json
{
  "outbounds": [
    {
      "tag": "warp",
      "protocol": "socks",
      "settings": {
        "servers": [
          {
            "address": "127.0.0.1",
            "port": 40000
          }
        ]
      }
    }
  ]
}
```

Pointing the proxy software’s outbound directly at the SOCKS5 service triggers remote DNS resolution, making the choice of IPv4 or IPv6 unpredictable. Local DNS resolution fixes this.

For local DNS, enable the proxy software’s DNS module.

```json
{
  "dns": {
    "servers": [
      "2606:4700:4700::1111",
      "1.1.1.1"
    ],
    "queryStrategy": "UseIP",
    "tag": "dns_inbound"
  }
}
```

Configure the outbound as a proxy chain.

```json
{
  "outbounds": [
    {
      "tag": "warp",
      "protocol": "freedom",
      "settings": {
        "domainStrategy": "UseIPv6v4"
      },
      "proxySettings": {
        "tag": "warp-inner"
      }
    },
    {
      "tag": "warp-inner",
      "protocol": "socks",
      "settings": {
        "servers": [
          {
            "address": "127.0.0.1",
            "port": 40000
          }
        ]
      }
    }
  ]
}
```

First, a freedom outbound resolves the domain. UseIPv6v4 prefers a resolved IPv6 address and falls back to IPv4 if none is available. proxySettings then sends traffic to the warp-inner outbound—the SOCKS service configured earlier, meaning WARP.

Now, if a website supports IPv6, accessing it through the warp tag will always use IPv6.
