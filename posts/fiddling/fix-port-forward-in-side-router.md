---
title: 旁路由端口映射失效解决
tags: ["debian","旁路由","NAT","端口映射","端口转发","网络"]
date: 2024-08-15T23:50:00+08:00
author: "shinya"
---

### 前言

使用[上篇文章的方案](/fiddling/debian-as-side-router)配置完成后，如果你在主路由上配置了端口映射，且被映射端口的机器网关配置的是旁路由，那此时端口映射应当是失效了。其实并不是 Clash 分流导致的问题，只要是配置了旁路由网关，主路由配置的端口映射都会失效。

### 原理（太长不看系列）

网关的作用其实就是 NAT 地址转换，用于将内部网络的流量转发到外部网络，内部流量只要传输到外部网络，就必须通过网关。所以每个内网机器都必须配置一个网关地址，以与外部通信。

网关在实现上，可以简单理解为一个自动的端口转发。网关对每一个活动连接（通过五元组唯一标识）都维护了一个端口对，一个端口对内一个端口对外。例如你的机器与 Google 服务器建立连接，网关维护的端口对是 (32384, 14122)，那么就表示你向 Google 发送的所有流量都要发送到网关的 32384 端口，网关转发流量包，通过 14122 端口送往 Google 的服务器，反之 Google 服务器向你发送数包也要经过这层转发。当然很多时候 NAT 不一定只有一层，如果你的宽带没有获取到公网 IP，那么你的家庭网关的上级网关也会做一次 NAT，最终与 Google 通信的网关一定是具有公网 IP 的网关（只有具有公网 IP 的机器才可以在互联网通信）

当我们配置了旁路由时，旁路由由于充当了网关，也会进行一次 NAT。那么在你的机器与外部通信时，实际上是经过两次 NAT 的：

```
你的机器 <——> 旁路由（NAT） <——> 主路由（NAT） <——> 外部机器
```

如果你在主路由配置端口映射，但是内部机器配置的网关却是旁路由，当你尝试通过公网 IP 访问内网时，入流量是这样的：

```
外部机器 ----> 主路由网关 ----> 你的机器
```

而出流量则是这样的：

```
你的机器 ----> 旁路由 ----> 主路由 ----> 外部机器
```

实际上，在外部机器发起连接的时候，你的机器只与主路由网关建立了连接，但是回程流量却被发到了旁路由网关，旁路由网关找不到连接对应的端口对就会直接将包丢弃，导致了端口映射失效

### 解决方案（直接看这个）

解决方案很简单，内网包含了两层 NAT，那也只需要将端口映射配置两次即可。


1. 主路由配置端口映射，指向旁路由
2. 旁路由配置端口映射，指向目标机器

这样，无论入程还是回程，流量都按如下模式路由，即可成功建立连接

```
你的机器 <——> 旁路由（NAT） <——> 主路由（NAT） <——> 外部机器
```

主路由和旁路由配置端口映射的方式因系统而异，iKuai 和 OpenWRT 都由图形化的方式配置，这里不再赘述了。上篇文章的方案中旁路由使用的是 Debian，实际上以下方法适用于所有使用 iptables 的系统。执行以下命令设置 iptables，以下为目标机器为"内部"，称呼网关机器为"外部"

```shell
iptables -t nat -I PREROUTING -p tcp -d <外部IP> --dport <外部端口> -j DNAT --to-destination <内部IP>:<内部端口>
iptables -t nat -I POSTROUTING -p tcp --dport <内部端口> -d <外部IP> -j SNAT --to-source <内部IP>
```

执行完后即可设置 iptables

注意上篇文章中 clean.sh 中的 `iptables -t nat -F` 命令会清除所有用户自定义的路由规则，导致转发失效。所以在执行完后需要补充执行下上述命令。