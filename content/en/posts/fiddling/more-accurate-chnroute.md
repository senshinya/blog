---
authorship: human-only
title: "More Accurate Routing for Chinese and Overseas IPs with BGP"
description: "BGP-based routing for Chinese and overseas IPs makes transparent proxying more efficient and accurate. Marking overseas destinations with FakeIP lets the main router route traffic more intelligently for smoother connectivity. The sing-box DNS configuration is also refined to handle queries more flexibly and efficiently, improving the overall network experience."
date: 2024-10-07 16:51:00
categories: [fiddling]
tags: ["Tinkering", "software router", "transparent proxy", "traffic routing", "BGP"]
image: "https://blog-img.774352199.xyz/MOmM1s.webp"
---

After two rounds of tinkering—[Using Debian as a Side Router](/en/fiddling/debian-as-bypass-router) and [Routing Transparent Proxy Traffic with FakeIP](/en/fiddling/fake-ip-based-transparent-proxy)—my home transparent proxy was basically usable. The FakeIP approach marks overseas IPs with FakeIP, which the main router identifies to route traffic. The sing-box DNS module was configured as follows:

```json
{
  "dns": {
    "servers": [
      ...
    ],
    "rules": [
      ...
      {
        "server": "local",
        "rewrite_ttl": 10,
        "type": "logical",
        "mode": "and",
        "rules": [
          {
            "rule_set": [
              "geosite-geolocation-!cn" // [!code highlight]
            ],
            "invert": true
          },
          {
            "rule_set": [
              "geosite-cn", // [!code highlight]
              "geosite-category-companies@cn", // [!code highlight]
              "geoip-cn" // [!code highlight]
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
  }
}
```

This DNS routing rule uses rule sets: if a domain is not in `geosite-geolocation-!cn`, and either the domain is in `geosite-cn` or `geosite-category-companies@cn`, or its resolved IP is in `geoip-cn`, the traffic is treated as within China and receives a RealIP. Otherwise, it receives a FakeIP.

This is a very crude test. The domain rule sets cover only relatively common domains, for a start. The `geoip-cn` IP rule set is based on MaxMind’s GeoLite2 database and ultimately WHOIS data. Most of the time, that only tells you which organization registered an IP, not where the IP is actually used. It is especially inaccurate for CN-IP.

I happened to learn about BGP recently. Here is a bit of background, borrowed from an explainer:

> Border Gateway Protocol (BGP) is a routing protocol for exchanging Network Layer Reachability Information (NLRI) between routing domains. Because each domain is controlled by a separate administrative organization, routing domains are commonly called Autonomous Systems (AS). Today’s Internet is a large network of interconnected autonomous systems. As the de facto standard external routing protocol for the Internet, BGP is widely used between Internet Service Providers (ISPs).

In BGP, routes into China are announced by Chinese ASes. Collecting the IP lists announced by all Chinese ASes should therefore give us a more accurate CN-IP list.

> Given how China’s network is organized, and according to Wikipedia, only the three major carriers, the education network, and the science and technology network can establish BGP sessions directly with the global Internet.

Plenty of tutorials explain how to run your own AS and obtain a complete BGP table. Being lazy and happy to borrow someone else’s work, though, I found that GitHub already has several BGP-based CN-IP lists. This post uses this project: https://github.com/gaoyifan/china-operator-ip/blob/ip-lists/china.txt

With the list ready, it is code time!

```bash
#!/bin/bash

# 定义变量
URL="https://raw.githubusercontent.com/gaoyifan/china-operator-ip/refs/heads/ip-lists/china.txt"
IPSET_NAME="allowed_ips"

# 下载新的 IP 列表
curl -o /tmp/ip-list.txt "$URL" || { echo "下载 IP 列表失败"; exit 1; }

# 清空现有的 ipset 集合
ipset flush $IPSET_NAME

# 重新创建 ipset 集合（如果不存在则创建）
ipset create $IPSET_NAME hash:net -exist

# 添加局域网地址到集合
ipset add $IPSET_NAME 0.0.0.0/8
ipset add $IPSET_NAME 127.0.0.0/8
ipset add $IPSET_NAME 10.0.0.0/8
ipset add $IPSET_NAME 172.16.0.0/12
ipset add $IPSET_NAME 192.168.0.0/16
ipset add $IPSET_NAME 169.254.0.0/16
ipset add $IPSET_NAME 224.0.0.0/4
ipset add $IPSET_NAME 240.0.0.0/4

# 读取 IP 列表并添加到 ipset 集合
while IFS= read -r ip
do
    # 如果行为空或注释行，则跳过
    if [ -z "$ip" ] || [[ $ip == \#* ]]; then
        continue
    fi
    ipset add $IPSET_NAME $ip
done < /tmp/ip-list.txt

# 清理临时文件
rm /tmp/ip-list.txt

# 创建自定义链
iptables -t mangle -N NO_FORWARD

# 配置 iptables：将流量引导到自定义链，并基于逻辑规则返回或标记
iptables -t mangle -A PREROUTING -j NO_FORWARD

# 在自定义链中配置规则
iptables -t mangle -A NO_FORWARD -s 192.168.7.2 -j RETURN
iptables -t mangle -A NO_FORWARD -m set --match-set $IPSET_NAME dst -j RETURN
iptables -t mangle -A NO_FORWARD -j MARK --set-mark 1

# 设置路由以标记的流量转发到 192.168.7.2
ip rule add fwmark 1 table 100
ip route add default via 192.168.7.2 table 100
```

The comments cover everything, so I will not add much explanation.

If your router runs OpenWrt, install bash, ipset, iptables, and the other dependencies separately. OpenWrt’s default shell is ash, which cannot run this script.

```bash
opkg update
opkg install bash
opkg install curl
opkg install ipset
opkg install iptables
```

The CN-IP list updates once a day. Schedule the script to run daily, and add it to startup as well.
