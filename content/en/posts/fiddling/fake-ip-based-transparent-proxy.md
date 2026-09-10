---
authorship: human-only
title: "Routing Transparent Proxy Traffic with FakeIP"
description: "This FakeIP-based transparent proxy design addresses the single point of failure, poor performance, and awkward port forwarding of a traditional side router. Switching to the sing-box proxy core improves forwarding performance and simplifies configuration, with broader protocol support and better optimization than the previous Clash setup. Clash can implement the same design, but sing-box provides a flexible alternative."
date: 2024-08-16 23:53:00
categories: [fiddling]
tags: ["Tinkering", "censorship circumvention", "transparent proxy", "FakeIP"]
image: "https://blog-img.774352199.xyz/S2HHD5.webp"
---

### Introduction

[The previous post](/en/fiddling/debian-as-bypass-router) introduced a side router for transparent proxying on a LAN. It is usable for most people, but its drawbacks are fairly clear:

1. A possible single point of failure: DHCP points the gateway directly to the side router, so if Clash stops working, even sites that need no circumvention become unreachable.
2. Clash’s packet-forwarding performance is weak compared with hardware forwarding. With the gateway set to the side router, the iptables setup sends all traffic through Clash, whether it needs circumvention or not.
3. Having the side router as a gateway means configuring port forwarding on both the main router and the side router.

I recently came across a newer proxy core, sing-box. Perhaps not that new—it only really took off after Clash was archived. Its [wiki](https://sing-box.sagernet.org/configuration) shows comprehensive protocol and feature support, and better performance optimization than Clash. I decided to use sing-box as the core of the new design.

Of course, Clash can implement this design too.

~~Bad news: you need censorship circumvention to read the sing-box wiki.~~

### The Idea

Both sing-box and Clash have built-in DNS server modules and support FakeIP. Think of FakeIP this way: <mark>when a client makes a DNS query, the DNS module immediately returns a fake IP, performs the actual lookup in the background, and keeps a mapping between the fake and real addresses. When the client later connects and sends data to the FakeIP, the gateway uses that mapping to contact the real address.</mark> See [RFC3089](https://datatracker.ietf.org/doc/html/rfc3089) for a more detailed description. Routing later depends on the fake-to-real mapping saved when answering DNS, so a standalone DNS server cannot implement the entire FakeIP mechanism by itself.

FakeIP usually comes from a reserved subnet, most often `198.18.0.0/15`, making it extremely easy to identify and route. Have the software router’s proxy DNS module return FakeIP only for domains that require proxying, then configure the main router’s next hop so that only FakeIP destinations go through the software-router proxy. All other traffic forwards normally. In detail:

 ![FakeIP traffic routing](https://blog-img.774352199.xyz/2025/e078ffe1fe41b2cbcb04b40a55cbbc56.png)

```
1. 无须科学的域名
  1. 客户端发起 DNS 解析
  2. DNS 模块判断为无须科学，向国内 DNS 请求，返回 RealIP
  3. 客户端使用 RealIP 发起请求
  4. 主路由判断不是 FakeIP，走默认路由（直连）
  
2. 需要科学的域名
  1. 客户端发起 DNS 解析
  2. DNS 模块判断为需要科学，返回 FakeIP，并向国外 DNS 请求
  3. 客户端使用 FakeIP 发起请求
  4. 主路由判断是 FakeIP，路由流量到代理软件
  5. 代理软件根据 FakeIP 映射，通过出口节点向国外 IP 发起请求
```

This solves the three drawbacks from the previous post:


1. The single point of failure: sing-box going down no longer cuts off Internet access. Following the previous design, sing-box DNS sits behind AdGuard Home. When AdGuard detects its upstream failing, it uses fallback DNS within China. That returns no FakeIP, so all traffic follows the main router’s default route.
2. Traffic that does not require circumvention is forwarded directly by the router, bypassing proxy software.
3. Forwarding is handled by the main router’s routing table, and all clients use the main router as their gateway. There is no second NAT layer, so the main router’s port forwarding continues to work.

### Implementation

#### Main Router Configuration

First, configure a next-hop gateway on the main router. In iKuai, go to Traffic Control & Routing → Routing Settings → Port Routing and add a rule. Choose Next-Hop Gateway as the routing method and enter your software router’s IP, 192.168.7.2 in my case. Add 198.18.0.0/15 as the destination address, leaving everything else at its default.

 ![Next-hop gateway](https://blog-img.774352199.xyz/2025/37f3bc2ebbd0f4f79e218c2a949a84c4.png)

All traffic destined for 198.18.0.0/15 will now be forwarded to 192.168.7.2 when it reaches the main router.

#### Install and Configure sing-box

Set up AdGuard Home using [the previous post](/en/fiddling/debian-as-bypass-router), keeping upstream DNS at 127.0.0.1:1053. Then install sing-box. On Debian, one command is enough:

```shell
bash <(curl -fsSL https://sing-box.app/deb-install.sh)
```

Installation instructions for other distributions are at [https://sing-box.sagernet.org/installation/package-manager](https://sing-box.sagernet.org/installation/package-manager/#__tabbed_2_1).

The installer creates a systemd service automatically. Unusually, its definition is in `/lib/systemd/system/sing-box.service`. Edit that file and add these three lines before ExecStart:

```shell
ExecStartPre  = +/usr/bin/bash /etc/sing-box/clean.sh
ExecStartPost = +/usr/bin/bash /etc/sing-box/iptables.sh
ExecStopPost  = +/usr/bin/bash /etc/sing-box/clean.sh
```

As in the previous setup, this configures routing at startup and clears it when sing-box stops. All sing-box configuration lives in `/etc/sing-box`, and its default config file is `/etc/sing-box/config.json`, so we will keep the scripts there too.

Create `/etc/sing-box/iptables.sh` and `/etc/sing-box/clean.sh` as follows:

```shell
#!/usr/bin/env bash

set -ex

# ENABLE ipv4 forward
sysctl -w net.ipv4.ip_forward=1
# ENABLE ipv6 forward
sysctl -w net.ipv6.conf.all.forwarding=1

### IPv4 Routing Rules ###
# ROUTE RULES
ip rule add fwmark 666 lookup 666
ip route add local 0.0.0.0/0 dev lo table 666

# clash 链负责处理转发流量
iptables -t mangle -N clash

# 跳过内网流量
iptables -t mangle -A clash -d 0.0.0.0/8 -j RETURN
iptables -t mangle -A clash -d 127.0.0.0/8 -j RETURN
iptables -t mangle -A clash -d 10.0.0.0/8 -j RETURN
iptables -t mangle -A clash -d 172.16.0.0/12 -j RETURN
iptables -t mangle -A clash -d 192.168.0.0/16 -j RETURN
iptables -t mangle -A clash -d 169.254.0.0/16 -j RETURN
iptables -t mangle -A clash -d 224.0.0.0/4 -j RETURN
iptables -t mangle -A clash -d 240.0.0.0/4 -j RETURN

# 需代理的 IP 转向到 7893 端口，并打上 mark
iptables -t mangle -A clash -d 198.18.0.0/15 -p tcp -j TPROXY --on-port 7893 --tproxy-mark 666
iptables -t mangle -A clash -d 198.18.0.0/15 -p udp -j TPROXY --on-port 7893 --tproxy-mark 666

# 剩余流量正常处理
iptables -t mangle -A clash -j RETURN

# 最后让所有流量通过 clash 链进行处理
iptables -t mangle -A PREROUTING -j clash

# clash_local 链负责处理网关本身发出的流量
iptables -t mangle -N clash_local

# 跳过内网流量
iptables -t mangle -A clash_local -d 0.0.0.0/8 -j RETURN
iptables -t mangle -A clash_local -d 127.0.0.0/8 -j RETURN
iptables -t mangle -A clash_local -d 10.0.0.0/8 -j RETURN
iptables -t mangle -A clash_local -d 172.16.0.0/12 -j RETURN
iptables -t mangle -A clash_local -d 192.168.0.0/16 -j RETURN
iptables -t mangle -A clash_local -d 169.254.0.0/16 -j RETURN
iptables -t mangle -A clash_local -d 224.0.0.0/4 -j RETURN
iptables -t mangle -A clash_local -d 240.0.0.0/4 -j RETURN

# 为本机发出的流量打 mark
iptables -t mangle -A clash_local -p tcp -j MARK --set-mark 666
iptables -t mangle -A clash_local -p udp -j MARK --set-mark 666

# 让本机发出的流量跳转到 clash_local
# clash_local 链会为本机流量打 mark, 打过 mark 的流量会重新回到 PREROUTING 上
iptables -t mangle -A OUTPUT -j clash_local

# 修复 ICMP(ping)
# 这并不能保证 ping 结果有效 (clash 等不支持转发 ICMP), 只是让它有返回结果而已
# --to-destination 设置为一个可达的地址即可
sysctl -w net.ipv4.conf.all.route_localnet=1
iptables -t nat -A PREROUTING -p icmp -d 198.18.0.0/16 -j DNAT --to-destination 127.0.0.1
```

```shell
#!/usr/bin/env bash

set -ex

ip rule del fwmark 666 table 666 || true
ip route del local 0.0.0.0/0 dev lo table 666 || true

iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X clash || true
iptables -t mangle -X clash_local || true
```

iptables.sh is nearly identical to the previous post’s version. Only the final action in the clash chain changes: traffic to 198.18.0.0/15 goes to TPROXY port 7893, and other traffic follows the default rules. In effect, FakeIP traffic forwarded by the main router is handed to sing-box. clean.sh is completely unchanged.

I kept the two chains named clash and clash_local because this is just a small modification of the Clash setup. Laziness wins.

Next is the sing-box configuration. Here is a template:

```json
{
  "log": {
    "level": "info",
    "output": "box.log",
    "timestamp": true
  },
  "dns": {
    "servers": [
      {
        "tag": "cloudflare",
        "address": "tls://1.1.1.1",
        "detour": "🌍 外网" // 改为你的代理节点 tag
      },
      {
        "tag": "local",
        "address": "223.5.5.5",
        "detour": "DIRECT"
      },
      {
        "tag": "dns-fakeip",
        "address": "fakeip"
      },
      {
        "tag": "block",
        "address": "rcode://success"
      }
    ],
    "rules": [
      {
        "server": "block",
        "query_type": [
          "HTTPS",
          "SVCB"
        ]
      },
      {
        "server": "local",
        "outbound": "any"
      },
      {
        "server": "local",
        "rewrite_ttl": 10,
        "type": "logical",
        "mode": "and",
        "rules": [
          {
            "rule_set": [
              "geosite-geolocation-!cn"
            ],
            "invert": true
          },
          {
            "rule_set": [
              "geosite-cn",
              "geosite-category-companies@cn",
              "geoip-cn"
            ]
          }
        ]
      },
      {
        "server": "dns-fakeip",
        "rewrite_ttl": 1,
        "query_type": [
          "A",
          "AAAA"
        ]
      }
    ],
    "strategy": "ipv4_only",
    "fakeip": {
      "enabled": true,
      "inet4_range": "198.18.0.0/15"
    }
  },
  "inbounds": [
    {
      "type": "tproxy",
      "tag": "tproxy-in",
      "listen": "::",
      "listen_port": 7893,
      "tcp_fast_open": true,
      "udp_fragment": true,
      "sniff": true
    },
    {
      "type": "mixed",
      "tag": "mixed-in",
      "listen": "::",
      "listen_port": 7890,
      "tcp_fast_open": true,
      "udp_fragment": true,
      "sniff": true
    },
    {
      "type": "direct",
      "tag": "dns-in",
      "listen": "::",
      "listen_port": 1053
    }
  ],
  "outbounds": [
    {
      "type": "direct",
      "tag": "DIRECT"
    },
    {
      "type": "block",
      "tag": "REJECT"
    },
    {
      "type": "dns",
      "tag": "dns-out"
    },
    // 此处填写你的代理节点
  ],
  "route": {
    "rules": [
      {
        "inbound": "dns-in",
        "outbound": "dns-out"
      },
      {
        "protocol": "dns",
        "outbound": "dns-out"
      },
      {
        "outbound": "DIRECT",
        "type": "logical",
        "mode": "and",
        "rules": [
          {
            "rule_set": [
              "geosite-geolocation-!cn"
            ],
            "invert": true
          },
          {
            "rule_set": [
              "geosite-cn",
              "geosite-category-companies@cn",
              "geoip-cn"
            ]
          }
        ]
      }
    ],
    "rule_set": [
      {
        "type": "remote",
        "tag": "geoip-cn",
        "format": "binary",
        "url": "https://cdn.jsdelivr.net/gh/SagerNet/sing-geoip@rule-set/geoip-cn.srs",
        "download_detour": "DIRECT"
      },
      {
        "type": "remote",
        "tag": "geosite-cn",
        "format": "binary",
        "url": "https://cdn.jsdelivr.net/gh/SagerNet/sing-geosite@rule-set/geosite-cn.srs",
        "download_detour": "DIRECT"
      },
      {
        "type": "remote",
        "tag": "geosite-geolocation-!cn",
        "format": "binary",
        "url": "https://cdn.jsdelivr.net/gh/SagerNet/sing-geosite@rule-set/geosite-geolocation-!cn.srs",
        "download_detour": "DIRECT"
      },
      {
        "type": "remote",
        "tag": "geosite-category-companies@cn",
        "format": "binary",
        "url": "https://cdn.jsdelivr.net/gh/SagerNet/sing-geosite@rule-set/geosite-category-companies@cn.srs",
        "download_detour": "DIRECT"
      }
    ],
    "final": "🌍 外网", // 改为你的代理节点 tag
    "auto_detect_interface": true
  },
  "experimental": {
    "clash_api": {
      "external_controller": "0.0.0.0:9090",
      "external_ui": "yacd",
      "external_ui_download_url": "https://github.com/MetaCubeX/Yacd-meta/archive/gh-pages.zip",
      "external_ui_download_detour": "🌍 外网", // 改为你的代理节点 tag
      "default_mode": "Rule"
    }
  }
}
```

Edit the places marked by comments. By default, Chinese domains are resolved directly through 223.5.5.5 into RealIP (DNS-rules\[2\]); other domains get FakeIP (DNS-rules\[3\]). Traffic routing sends Chinese IPs and domains through DIRECT (route-rules\[2\]), with everything else using the proxy (route-final).

Once everything is configured, enable sing-box at boot and start it immediately.

```shell
systemctl enable --now sing-box
```

To view logs later, use Debian’s built-in tools:

```shell
journalctl -efu sing-box
```

sing-box provides a Clash-compatible API, so you can manage it with Clash’s web UI. Wait a little after startup while sing-box downloads the UI, then open yacd on port 9090.

#### The Telegram Problem

The drawback is obvious too: routing depends on DNS, so direct IP traffic that does not use DNS goes straight out through the main router. Apps such as Telegram that use IPs directly therefore are not routed correctly. The fix is simple: add those IPs to the main router’s next-hop IP list, the forwarding list in iptables.sh, and the sing-box rules, specifying that they use the proxy.

I currently have a script that processes IPs in rule sets and generates the corresponding IP list, iptables.sh, and a ready-to-use sing-box config.json. I will polish it up, remove private details, and release it as open source. Stay tuned.
