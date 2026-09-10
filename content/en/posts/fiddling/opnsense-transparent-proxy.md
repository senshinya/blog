---
authorship: human-only
title: "Transparent Proxying and Traffic Routing with OPNsense"
description: "OPNsense is an open-source firewall and router with an attractive interface and a comprehensive feature set. After trying several routing setups, I came to appreciate its potential for transparent proxying and traffic routing. Combining it with BGP-based routing offers better security and stability, while its automatically updated IP lists make network management more convenient."
date: 2025-01-16 23:09:00
categories: [fiddling]
tags: ["Tinkering", "censorship circumvention", "transparent proxy", "OPNsense", "traffic routing"]
---

### Introduction

My original transparent proxy and traffic-routing setup used iKuai as the main router and OpenWrt as a side router, the standard approach in most online tutorials. Later I read that iKuai might [generate unrequested traffic and report information in the background](https://wusiyu.me/2022-ikuai-non-cloud-background-activities/). Being a closed-source system developed in China also left me with security concerns.

I switched to [OpenWrt as the main router and Debian as the side router](/en/fiddling/debian-as-bypass-router), then moved away from the side-router design. I tried [FakeIP-based routing](/en/fiddling/fake-ip-based-transparent-proxy) and then [BGP-based routing](/en/fiddling/more-accurate-chnroute), finally settling on BGP.

Recently I discovered the OPNsense firewall/router system. It is pretty much my dream router OS: free and open source, a beautiful UI, comprehensive features, and even GUI support for automatically updating IP lists used in routing. I decided to migrate my current design to it, integrating Clash into the main router instead of keeping a separate software router for censorship circumvention.

There were not many tutorials online, and some had aged out of usefulness. After falling into a few traps, I decided to document the full setup.

The required features are:
- Forward DNS to Clash for centralized resolution.
- Once traffic enters OPNsense, route it according to a list, sending selected traffic into Clash.

I will skip the basic OPNsense installation; plenty of material already covers it.
### Install Clash

#### Binary and Configuration File

Both DNS resolution and traffic processing depend on Clash, so install it first.

SSH into OPNsense—how do you enable SSH? STFW—and create `/usr/local/clash` for the binary, configuration, and supporting files. I recommend transferring the binary with scp, since the main router cannot yet circumvent censorship and direct downloads are slow. Upload the binary and configuration there, naming them clash and `config.yaml` respectively.

Download the latest core from the Mihomo [releases page](https://github.com/MetaCubeX/mihomo/releases). Choose the FreeBSD build and your architecture: 386, amd64, or arm64. If you use amd64 and encounter the following error when running Clash, download `amd64-compatible` instead.

```shell
This PROGRAM can only be run on _AMD64 processors with v3 microarchitecture_ support.
```

Use your usual configuration file, but change these settings:

```yaml
mixed-port: 7890

dns:
  listen: 127.0.0.1:5353

tun:
  enable: false
```

DNS listens on port 5353 as the upstream for OPNsense’s built-in DNS. Disable TUN so Clash does not capture traffic itself; OPNsense will select and feed it traffic. mixed-port serves SOCKS, HTTP, and HTTPS proxy functions together.

Run `pw user add clash -c "Clash" -s /usr/sbin/nologin` to create a clash user that cannot log in, then grant ownership with `chown clash:clash /usr/local/clash`. Test with `/usr/local/clash/clash -d /usr/local/clash` and check that it runs successfully.

#### Register the Clash Service

Create `/usr/local/etc/rc.d/clash` and `/usr/local/opnsense/service/conf/actions.d/actions_clash.conf` to register Clash as a system service.

```shell
#!/bin/sh
# $FreeBSD$

# PROVIDE: clash
# REQUIRE: LOGIN cleanvar
# KEYWORD: shutdown

# Add the following lines to /etc/rc.conf to enable clash:
# clash_enable (bool): Set to "NO" by default.
# Set to "YES" to enable clash.
# clash_config (path): Clash config dir.
# Defaults to "/usr/local/etc/clash"

. /etc/rc.subr

name="clash"
rcvar=clash_enable

load_rc_config $name

: ${clash_enable:="NO"}
: ${clash_config="/usr/local/clash"}

command="/usr/local/clash/clash"
#pidfile="/var/run/clash.pid"
required_files="${clash_config}"
clash_group="clash"
clash_user="clash"

command_args="-d $clash_config"

run_rc_command "$1"
```

```
[start]
command:/usr/local/etc/rc.d/clash onestart
type:script
message:starting clash

[stop]
command:/usr/local/etc/rc.d/clash stop
type:script
message:stoping clash

[status]
command:/usr/local/etc/rc.d/clash statusexit 0
type:script_output
message:get clash status

[restart]
command:/usr/local/etc/rc.d/clash onerestart
type:script
message:restarting clash
```

Make it executable with `chmod +x /usr/local/etc/rc.d/clash`, then activate the configuration with `service configd restart`.

#### Start Clash at Boot

Next is starting Clash at boot, but there is a catch:

> When launched as a system service, Clash does not automatically move into the background after starting. During boot, the system therefore gets stuck at Clash, which stays in the foreground and prevents later services from starting.

A roundabout solution is to use OPNsense’s built-in Monit service monitor to start Clash and watch its status. Enable it under `Services → Monit`.

Add two Service Tests under Service Test Settings. The first starts Clash:

| Setting   | Value                                    |
| --------- | ---------------------------------------- |
| Name      | Clash                                    |
| Condition | failed host 127.0.0.1 port 7890 type tcp |
| Action    | Restart                                  |

The second prevents an endless restart loop:

| Setting   | Value                      |
| --------- | -------------------------- |
| Name      | RestartLimit4              |
| Condition | 5 restarts within 5 cycles |
| Action    | Unmonitor                  |

Finally, add this under Service Settings:

| Setting | Value                                 |
| ------- | ------------------------------------- |
| Name    | Clash                                 |
| Match   | clash                                 |
| Start   | /usr/local/sbin/configctl clash start |
| Stop    | /usr/local/sbin/configctl clash stop  |
| Tests   | Clash,RestartLimit4                   |

Save, wait a little, and check Monit → Status to see whether Clash is running normally.

### DNS Resolution

I set OPNsense’s built-in Unbound DNS to use Clash at 127.0.0.1:5353 as its upstream, but resolution kept failing. Very strange.

After failing to figure it out, I disabled Unbound DNS and went back to AdGuard Home as the default DNS server, taking over port 53.

AdGuard Home is not in OPNsense’s default plugin repository, so add the community repository manually.

SSH into OPNsense and run:

```shell
$ fetch -o /usr/local/etc/pkg/repos/mimugmail.conf https://www.routerperformance.net/mimugmail.conf
$ pkg update
```

In the web GUI, go to System → Firmware → Plugins, search for adguard, and install os-adguardhome-maxit. Enable AdGuard Home under Services → Adguardhome. Its web interface is on port 3000. I will skip initialization, but make sure DNS listens on port 53, making AdGuard Home the default DNS server on the OPNsense machine.

Under AdGuard Home’s Settings → DNS Settings, set upstream DNS to 127.0.0.1:5353, Clash’s listening address.

### Routing Chinese and Overseas IPs

#### Binary and Configuration File

OPNsense includes Squid for proxying, but it only handles HTTP/HTTPS, not general TCP or UDP traffic. That makes it rather incomplete as a proxy. I took an indirect route instead, using tun2socks to feed TCP/UDP traffic into Clash.

Create `/usr/local/tun2socks` for the binary and configuration. Download the latest FreeBSD binary from [GitHub Releases](https://github.com/xjasonlyu/tun2socks/releases) into it and rename it tun2socks. Create `/usr/local/tun2socks/config.yaml`:

```yaml
# debug / info / warning / error / silent
loglevel: info

# URL format: [protocol://]host[:port]
proxy: socks5://127.0.0.1:7890

# URL format: [driver://]name
# TUN 设备名称，避免使用 tun0
device: tun://proxytun2socks0

# Maximum transmission unit for each packet
mtu: 1500

# Timeout for each UDP session, default value: 60 seconds
udp-timeout: 120s
```

Set `proxy` to the address of Clash’s SOCKS5 port.

Run `./tun2socks -config ./config.yaml` inside `/usr/local/tun2socks/` to test the configuration.

#### Register the Service

Create `/usr/local/etc/rc.d/tun2socks` and `/usr/local/opnsense/service/conf/actions.d/actions_tun2socks.conf`.

```shell
#!/bin/sh

# PROVIDE: tun2socks
# REQUIRE: LOGIN
# KEYWORD: shutdown

. /etc/rc.subr

name="tun2socks"
rcvar="tun2socks_enable"

load_rc_config $name

: ${tun2socks_enable:=no}
: ${tun2socks_config:="/usr/local/tun2socks/config.yaml"}

pidfile="/var/run/${name}.pid"
command="/usr/local/tun2socks/tun2socks"
command_args="-config ${tun2socks_config} > /dev/null 2>&1 & echo \$! > ${pidfile}"

start_cmd="${name}_start"

tun2socks_start()
{
    if [ ! -f ${tun2socks_config} ]; then
        echo "${tun2socks_config} not found."
        exit 1
    fi
    echo "Starting ${name}."
    /bin/sh -c "${command} ${command_args}"
}

run_rc_command "$1"
```

```
[start]
command:/usr/local/etc/rc.d/tun2socks start
parameters:
type:script
message:starting tun2socks

[stop]
command:/usr/local/etc/rc.d/tun2socks stop
parameters:
type:script
message:stopping tun2socks

[restart]
command:/usr/local/etc/rc.d/tun2socks restart
parameters:
type:script
message:restarting tun2socks

[status]
command:/usr/local/etc/rc.d/tun2socks status; exit 0
parameters:
type:script_output
message:request tun2socks status
```

Create `/etc/rc.conf` and add:

```
tun2socks_enable="YES"
```

Make it executable with `chmod +x /usr/local/etc/rc.d/tun2socks`, then run `service configd restart`.

Start tun2socks manually as well:

```shell
/usr/local/etc/rc.d/tun2socks start
```

#### Start at Boot

Create `/usr/local/etc/rc.syshook.d/early/60-tun2socks`.

```bash
#!/bin/sh

# Start tun2socks service
/usr/local/etc/rc.d/tun2socks start
```

Make the file executable: `chmod +x /usr/local/etc/rc.syshook.d/early/60-tun2socks`.

#### Create an Interface and Gateway

Under Interfaces → Assignments in OPNsense, add an interface using proxytun2socks0, the device named in the configuration, and save.

Open its configuration, enable it, set Description to TUN2SOCKS, IPv4 Configuration Type to Static IPv4, and IPv4 Address to `10.0.3.1/24`, then save.

Under System → Gateways → Configuration, create a gateway named TUN2SOCKS_MIHOMO. Select the TUN2SOCKS interface and enter `10.0.3.2` as the IP address, leaving the remaining settings at their defaults.

We now have a gateway that forwards any traffic entering it to 127.0.0.1:7890 for Clash to proxy.
#### Configure Chinese/Overseas IP Routing

The most useful OPNsense feature for me is Firewall → Aliases. You can define an IP list and reuse it directly in rules. Lists can be entered manually or fetched dynamically by subscribing to a URL.

Open Firewall → Aliases and create two aliases.

The first, InternalAddress, represents LAN address ranges. Choose Network(s) as the type and enter:

```
0.0.0.0/8
127.0.0.0/8
10.0.0.0/8
172.16.0.0/12
192.168.0.0/16
169.254.0.0/16
224.0.0.0/4
240.0.0.0/4
```

The second, CN_V4, represents IP ranges within China. Choose URL Table (IPs) and enter a URL containing all Chinese network ranges, such as https://raw.githubusercontent.com/gaoyifan/china-operator-ip/refs/heads/ip-lists/china.txt

Next, add two rules at the top of Firewall → Rules → LAN. Their top-to-bottom order matters.

The first uses InternalAddress as its destination, with everything else left at default. LAN destinations will follow normal routing.

The second uses CN_V4 as its destination, with Destination / Invert checked and TUN2SOCKS_MIHOMO selected as the gateway. This sends non-Chinese destinations to that gateway.

The remaining default rules go below. All other traffic follows them, so Chinese IPs connect directly.

When you visit Google, AdGuard Home receives the DNS query and forwards it to Clash, which resolves Google’s real address. Traffic to that address then matches the second firewall rule, goes to TUN2SOCKS_MIHOMO, and enters Clash through its SOCKS5 port. You are through the wall.
