---
title: "Using Debian as a Side Router"
description: "Using Debian as a side router offers a more stable and flexible alternative without depending on OpenWrt and LuCI. Configuring Debian directly gives you greater control over the system and avoids the limitations and instability of a GUI. Compared with common side-router setups, this approach makes transparent proxying more reliable and offers another option for those who value performance and efficiency."
date: 2024-07-13 17:49:00
categories: [fiddling]
tags: ["Tinkering", "debian", "side router", "censorship circumvention", "transparent proxy", "mihomo"]
---

### Introduction

Most side-router setups use OpenWrt, a separate Linux distribution with its own package system. Most of those also rely on LuCI, OpenWrt’s dedicated web GUI, and tutorials use luci-app-xxx software built specifically for it. These approaches are good, but not quite good enough:

1. Too much dependence on GUI configuration: LuCI packages generally expose only limited options in the web interface.
2. LuCI is not stable enough. I mean LuCI, not OpenWrt itself. OpenClash has crashed my LuCI three times—though that might have been my fault.
3. We can compile OpenWrt ourselves, but most tutorials use prebuilt firmware, some of which may be outdated.
4. You cannot fully control the system. LuCI has taken the reins!

I spent a year or two tinkering with OpenWrt transparent proxying, both on the main router and with a side router, but eventually gave up because it was not stable enough. For a long time I muddled through with clients such as Surge, Loon, and Clash Verge Rev. About a week ago, Zenless Zone Zero launched. Because of the Chinese release-approval situation, PS5 only got the international version. Even the Asia server barely worked directly, with hopeless speeds and latency. Determined not to hand money to NetEase UU, I thought of transparent proxying again. I happened to have an idle Beelink mini PC with Debian already installed. It was supposed to be a development machine, but laziness had left it gathering dust. After a weekend of tinkering, I finally had Debian working as a side router for transparent proxying.

Here is the final network topology:

![topo](https://blog-img.774352199.xyz/2025/c4347103c787f3d28b50a679e80aa0fe.png)

The LAN is divided into two subnets, 192.168.6.0/24 and 192.168.7.0/24. The 6.0/24 subnet is the default for devices that do not need censorship circumvention. Devices that need it go on 7.0/24, with all their traffic forwarded through the side-router mini PC.

The core is AdGuard Home plus Clash. AdGuard Home handles ad filtering and related features, while Clash handles DNS routing and traffic proxying.

### Main Router Configuration

The existing LAN uses 192.168.6.0/24. We need to add 192.168.7.0/24.

My main router runs iKuai, so here is how to add a subnet there. For OpenWrt or other router systems, Google the equivalent.

In iKuai, go to Network Settings → LAN/WAN Settings → lan1. Under Advanced Settings, add an extended IP of 192.168.7.1 with subnet mask 255.255.255.0.

![iKuai configuration](https://blog-img.774352199.xyz/2025/9fc87b145274f1fb0cba1ed0d2329ac0.png)

Add a DHCP configuration for 192.168.7.0/24 in DHCP Settings.

![DHCP configuration](https://blog-img.774352199.xyz/2025/2de91498b256d08c92a3c8844ca14dbe.png)

Set the gateway to 192.168.7.2, the side router address we will configure later. Set both preferred and alternate DNS to 192.168.7.2 too, since the side router handles all DNS for this subnet.

### Debian Configuration

Unless stated otherwise, perform the following steps on the side router.

#### Configure the IP Address

Run `sudo nano /etc/network/interfaces` to edit Debian’s network configuration, replace it with the following, then save and exit:

```
# This file describes the network interfaces available on your system
# and how to activate them. For more information, see interfaces(5).

source /etc/network/interfaces.d/*

# The loopback network interface
auto lo
iface lo inet loopback

# The primary network interface
allow-hotplug enp1s0
iface enp1s0 inet static
address 192.168.7.2
netmask 255.255.255.0
gateway 192.168.7.1
dns-nameservers 127.0.0.1
```

In this configuration:
- `enp1s0` is my network interface name. Replace it with yours; `ip a` shows the available interfaces.
- IPv4 uses static configuration, `inet static`, fixing the address at `192.168.7.2/24` and pointing the gateway to the main router at `192.168.7.1`. Until setup is complete, use a working DNS server so you retain Internet access. Change DNS to `127.0.0.1` once AdGuard Home is configured locally.

After saving, restart networking with:

```shell
sudo systemctl restart networking.service
```

Your SSH session may disconnect because the IP address has changed. Reconnect over SSH to `192.168.7.2`.

Check the result with `ip a`:

```shell
ip a
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host noprefixroute
       valid_lft forever preferred_lft forever
2: enp1s0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000
    link/ether 70:70:fc:00:e3:36 brd ff:ff:ff:ff:ff:ff
    inet 192.168.7.2/24 brd 192.168.7.255 scope global enp1s0
       valid_lft forever preferred_lft forever
    inet6 ■■■:■■■■:■■■■:■■■:■■■■:■■■■/64 scope global dynamic mngtmpaddr
       valid_lft 1741sec preferred_lft 1741sec
    inet6 fe80::7270:fcff:fe00:e336/64 scope link
       valid_lft forever preferred_lft forever
```

The local LAN address is now 192.168.7.2/24.

#### Enable Forwarding

A machine must be able to forward traffic to act as a router and gateway:

```shell
sudo echo "net.ipv4.ip_forward = 1" >> /etc/sysctl.conf
sudo sysctl -p
```

### AdGuard Home Configuration

Here is the DNS design:

![DNS path](https://blog-img.774352199.xyz/2025/bb62d86943fdce26364eea909c4621a9.png)

When a client resolves a domain, AdGuard Home on port 53 forwards the query to its upstream, Clash. Clash then routes the query according to its settings: mainland Chinese domains use public DNS servers within China, while other domains use overseas public DNS servers through the proxy.

If Clash fails, AdGuard Home queries public DNS servers within China directly. In practice this is not very useful, since traffic still has to pass through Clash even if DNS succeeds.

#### Install AdGuard Home

Run these commands as root.

```shell
## 检查最新稳定版的版本号，如果获取不到请检查网络
remote_ver=$(curl -sS https://api.github.com/repos/AdguardTeam/AdGuardHome/releases/latest | jq -r .tag_name | sed 's|v||' | grep -v "null"); echo $remote_ver

## 下载最新稳定版（前一句有输出这一句才能正常执行）
cd /tmp
wget -q --progress=bar:dot --show-progress -O "AdGuardHome_linux_amd64.tar.gz" "https://github.com/AdguardTeam/AdGuardHome/releases/download/v${remote_ver}/AdGuardHome_linux_amd64.tar.gz"

## 解压
tar --no-same-owner -xf "AdGuardHome_linux_amd64.tar.gz" --strip-components 2 --directory=.

## 安装
install -ps AdGuardHome /usr/local/bin/adguardhome
```

#### Create a Service

Create the working directory `/var/lib/adguardhome`.

```shell
mkdir -p /var/lib/adguardhome
```

Create `/etc/systemd/system/adguardhome.service` with the following contents. The configuration file will be `/var/lib/adguardhome/AdGuardHome.yaml`.

```ini
[Unit]
Description = Network-wide ads & trackers blocking DNS server.
Wants       = network-online.target mosdns.service
After       = network-online.target mosdns.service

[Service]
Type               = simple
Restart            = always
StartLimitInterval = 5
StartLimitBurst    = 10
ExecStart          = /usr/local/bin/adguardhome -w /var/lib/adguardhome
RestartSec         = 10

[Install]
WantedBy = multi-user.target
```

Save it, then run `systemctl enable --now adguardhome.service` to start it immediately and enable it at boot. To view logs later, use Debian’s built-in tools:

```shell
journalctl -efu adguardhome.service
```

To restart it:

```shell
systemctl restart adguardhome.service
```

#### Initial Setup

Open `http://192.168.7.2:3000` for initial setup. Keep the web administration port at 3000 and set the DNS server port to 53.

Under Settings → DNS Settings, set upstream DNS to Clash at `127.0.0.1:1053`, which we have not configured yet. Add a few DNS servers within China as fallback servers, for example:

```
223.5.5.5
119.29.29.29
```

Remember to click Apply.

Then set DNS Server Configuration → Rate Limit to 0.

For ad blocking, add lists under Filters → DNS Blocklists. These two rule sets work well in mainland China:

```
easylist:  https://anti-ad.net/easylist.txt
half-life: https://adguard.yojigen.tech/HalfLifeList.txt
```

### Clash Configuration

Clash handles DNS routing between China and overseas, along with its usual job of getting through the wall. The original Clash repository was deleted and its maintainers disappeared, so Mihomo inherited the project. (Damn you, miHoYo.)

#### Install Clash

Run the following as root:

```shell
## 检查最新稳定版的版本号，如果获取不到请检查网络
remote_ver=$(curl -sS https://api.github.com/repos/MetaCubeX/mihomo/releases/latest | jq -r .tag_name | sed 's|v||' | grep -v "null"); echo $remote_ver

## 下载最新稳定版（前一句有输出这一句才能正常执行）
cd /tmp
wget -q --progress=bar:dot --show-progress -O "mihomo-linux-amd64-v${remote_ver}.gz" "https://github.com/MetaCubeX/mihomo/releases/download/v${remote_ver}/mihomo-linux-amd64-v${remote_ver}.gz"

## 解压
gzip -d "mihomo-linux-amd64-v${remote_ver}.gz"

## 安装
install -ps mihomo-linux-amd64-v${remote_ver} /usr/local/bin/clash
```

#### Create a Service

Create the working directory `/var/lib/clash`.

```shell
mkdir -p /var/lib/clash
```

Create the clash user.

```shell
useradd -M -s /usr/sbin/nologin clash
```

Create `/etc/systemd/system/clash.service` with the following contents. Clash’s configuration file will be `/var/lib/clash/config.yaml`.

```ini
[Unit]
Description = Clash-Meta tproxy daemon.
Wants       = network-online.target
After       = network-online.target

[Service]
Environment   = PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/b>
Type          = simple
User          = clash
Group         = clash

CapabilityBoundingSet = CAP_NET_ADMIN CAP_NET_BIND_SERVICE CAP_NET_RAW
AmbientCapabilities   = CAP_NET_ADMIN CAP_NET_BIND_SERVICE CAP_NET_RAW

Restart       = always
ExecStartPre  = +/usr/bin/bash /var/lib/clash/clean.sh
ExecStart     = clash -d /var/lib/clash
ExecStartPost = +/usr/bin/bash /var/lib/clash/iptables.sh

ExecStopPost  = +/usr/bin/bash /var/lib/clash/clean.sh
```

As the unit file shows, the Clash binary runs as clash:clash. This makes it easy to distinguish traffic generated by Clash itself from traffic forwarded by Clash.

Notice that ExecStartPost and ExecStopPost run iptables.sh and clean.sh to set up and clear the routing rules.

Here are iptables.sh and clean.sh:

```sh
#!/usr/bin/env bash

set -ex

# ENABLE ipv4 forward
sysctl -w net.ipv4.ip_forward=1

# ROUTE RULES
ip rule add fwmark 666 lookup 666
ip route add local 0.0.0.0/0 dev lo table 666

# clash 链负责处理转发流量
iptables -t mangle -N clash

# 目标地址为局域网或保留地址的流量跳过处理
# 保留地址参考：https://zh.wikipedia.org/wiki/%E5%B7%B2%E5%88%86%E9%85%8D%E7%9A%84/8_IPv4%E5%9C%B0%E5%9D%80%E5%9D%97%E5%88%97%E8%A1%A8
iptables -t mangle -A clash -d 0.0.0.0/8 -j RETURN
iptables -t mangle -A clash -d 127.0.0.0/8 -j RETURN
iptables -t mangle -A clash -d 10.0.0.0/8 -j RETURN
iptables -t mangle -A clash -d 172.16.0.0/12 -j RETURN
iptables -t mangle -A clash -d 192.168.0.0/16 -j RETURN
iptables -t mangle -A clash -d 169.254.0.0/16 -j RETURN

iptables -t mangle -A clash -d 224.0.0.0/4 -j RETURN
iptables -t mangle -A clash -d 240.0.0.0/4 -j RETURN

# 其他所有流量转向到 7893 端口，并打上 mark
iptables -t mangle -A clash -p tcp -j TPROXY --on-port 7893 --tproxy-mark 666
iptables -t mangle -A clash -p udp -j TPROXY --on-port 7893 --tproxy-mark 666

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

# 跳过 clash 程序本身发出的流量，防止死循环 (clash 程序需要使用 "clash" 用户启动)
iptables -t mangle -A OUTPUT -p tcp -m owner --uid-owner clash -j RETURN
iptables -t mangle -A OUTPUT -p udp -m owner --uid-owner clash -j RETURN

# 让本机发出的流量跳转到 clash_local
# clash_local 链会为本机流量打 mark, 打过 mark 的流量会重新回到 PREROUTING 上
iptables -t mangle -A OUTPUT -j clash_local

# 修复 ICMP(ping)
# 这并不能保证 ping 结果有效 (clash 等不支持转发 ICMP), 只是让它有返回结果而已
# --to-destination 设置为一个可达的地址即可
sysctl -w net.ipv4.conf.all.route_localnet=1
iptables -t nat -A PREROUTING -p icmp -d 198.18.0.0/16 -j DNAT --to-destination 127.0.0.1
```

```sh
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

Every line has detailed comments. Ask ChatGPT if you want to dig further.

#### Clash Configuration File

Your proxy subscription provider can supply a Clash configuration in YAML format. Save it to `/var/lib/clash/config.yaml` and adjust the following sections:

```yaml
tproxy-port: 7893   # iptables.sh 将所有流量转发到了 7893 端口
mixed-port: 7890
allow-lan: true
find-process-mode: off
bind-address: "*"
mode: rule
log-level: debug
ipv6: false # 不进行 IPv6 流量代理

external-controller: 0.0.0.0:9090
secret: # 登陆 ui 的密码
external-ui: ui # webui 的基础路径
external-ui-name: xd # webui 的下级路径
external-ui-url: https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip
unified-delay: true
tcp-concurrent: true
experimental:
  sniff-tls-sni: true
geodata-mode: true
geodata-loader: standard
geox-url:
  geoip: https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat
  geosite: https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat
  mmdb: https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/country.mmdb
profile:
  tracing: true
  store-selected: true
  store-fake-ip: true
sniffer:
  enable: true
  parse-pure-ip: true
  override-destination: true

dns:
  enable: true
  ipv6: false
  listen: 0.0.0.0:1053 # DNS 监听端口
  use-hosts: true
  enhanced-mode: fake-ip
  default-nameserver: # 建议修改为国内 DNS 服务器
    - 223.5.5.5
    - 119.29.29.29
  nameserver:
    - https://doh.pub/dns-query
    - tls://dot.pub
    - tls://dns.alidns.com
    - https://dns.alidns.com/dns-query
  fallback:
    - https://dns.cloudflare.com/dns-query
    - tls://dns.google:853
    - https://1.1.1.1/dns-query
    - tls://1.1.1.1:853
    - tls://8.8.8.8:853
  fake-ip-filter:
    - '+.lan'
    - '+.cluster.local'
    - 'time.*.com'
    - 'time.*.gov'
    - 'time.*.edu.cn'
    - 'time.*.apple.com'
    - 'ntp.*.com'
    - 'localhost.ptlogin2.qq.com'
    - '+.ntp.org.cn'
    - '+.pool.ntp.org'
    - '+.localhost'
  fallback-filter:
    geoip: true
    geoip-code: CN
    geosite:
      - gfw
    ipcidr:
      - 224.0.0.0/4
      - 240.0.0.0/4
      - 169.254.0.0/16
      - 0.0.0.0/8
      - 127.0.0.1/32
    domain:
      - '+.google.com'
      - '+.facebook.com'
      - '+.youtube.com'

proxies:  # 以下为你的代理节点、分组及代理规则
proxy-groups:
rules:
```

A closer look at DNS: there are two groups of DNS servers.
- nameserver contains public DNS servers within China.
- fallback contains public DNS servers overseas.

fallback-filter determines when a domain uses the fallback group’s result.
- geoip-code is an inverse condition: if the IP returned by nameserver does not match geoip-code, use the fallback result.
- geosite is a positive condition: domains matching geosite use fallback.
- ipcidr is a positive condition: if nameserver returns one of these poisoned IPs, use fallback.
- domain is a positive condition: matching domains use fallback directly.

That completes DNS routing.

#### Other Clash Files

Clash needs a few supporting files. Download them before starting it.

```shell
cd /var/lib/clash
wget -q --progress=bar:dot --show-progress -O country.mmdb https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/country.mmdb
wget -q --progress=bar:dot --show-progress -O geosite.dat  https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat
wget -q --progress=bar:dot --show-progress -O GeoIP.dat    https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.dat

mkdir -p ui
cd ui
wget -q --progress=bar:dot --show-progress -O xd.zip https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip
unzip -oqq xd.zip
mv metacubexd-gh-pages xd
```

The final `/var/lib/clash` directory should look like this:

```shell
/var/lib/clash
├── clean.sh
├── config.yaml
├── country.mmdb
├── GeoIP.dat
├── geosite.dat
├── iptables.sh
└── ui
```

Since Clash runs as the clash user, change ownership:

```shell
chown -R clash:clash /var/lib/clash
```

Make iptables.sh and clean.sh executable too.

```shell
chmod +x iptables.sh
chmod +x clean.sh
```

#### Start the Service

Once configuration is complete, enable `/etc/systemd/system/clash.service` at boot and start it immediately.

```shell
systemctl enable --now clash.service
```

To check logs later, use Debian’s built-in tools:

```shell
journalctl -efu clash.service
```

Open the web UI: `http://192.168.7.2:9090/ui/xd`.

The web UI configuration should be familiar. If everything works, change this machine’s DNS to 127.0.0.1 as mentioned earlier, and point both the gateway and DNS of LAN devices to 192.168.7.2.

### Port Forwarding

If the main router has port forwarding configured and the target machine uses the side router as its gateway, that forwarding probably no longer works. See [Fixing Port Forwarding with a Side Router](/en/fiddling/fix-port-forward-in-bypass-router) for the solution.
