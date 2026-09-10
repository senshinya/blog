---
title: "Fixing Port Forwarding with a Side Router"
description: "Port forwarding on the main router often stops working when a side router is introduced. Setting the side router as the gateway changes the forwarding path, breaking mappings that previously relied on the main router. A gateway translates addresses and forwards traffic from the internal network to the outside, and each internal device needs one to communicate externally. Understanding this mechanism helps explain how to fix the forwarding problem."
date: 2024-08-15 23:50:00
categories: [fiddling]
tags: ["Tinkering", "side router", "NAT", "port forwarding"]
---

### Introduction

After setting up [the approach from the previous post](/en/fiddling/debian-as-bypass-router), you will probably find that port forwarding on the main router no longer works if the target machine uses the side router as its gateway. This is not caused by Clash traffic routing. Simply using a side router as the gateway is enough to break port forwarding configured on the main router.

### How It Works (the Long Version)

The gateway essentially performs NAT address translation, forwarding traffic from the internal network to the external network. Any internal traffic heading outside has to pass through it, so every machine on the internal network needs a gateway address to communicate externally.

A simple way to think of a gateway is as automatic port forwarding. For each active connection, uniquely identified by its five-tuple, it maintains a pair of ports: one internal and one external. Suppose your machine connects to a Google server and the gateway maintains the pair (32384, 14122). That means all your traffic to Google goes to port 32384 on the gateway, which forwards the packets to Google through port 14122. Packets Google sends back pass through the same forwarding layer in reverse. There may be more than one layer of NAT: if your broadband connection has no public IP, the gateway upstream of your home gateway performs NAT as well. The gateway that ultimately communicates with Google must have a public IP, since only machines with public IPs can communicate on the Internet.

A side router also performs NAT because it acts as a gateway. Your machine therefore passes through two layers of NAT when communicating externally:

```
你的机器 <——> 旁路由（NAT） <——> 主路由（NAT） <——> 外部机器
```

If port forwarding is configured on the main router while the internal machine uses the side router as its gateway, incoming traffic to the public IP follows this path:

```
外部机器 ----> 主路由网关 ----> 你的机器
```

Outgoing traffic, however, follows this path:

```
你的机器 ----> 旁路由 ----> 主路由 ----> 外部机器
```

When the external machine initiates the connection, your machine establishes a connection only through the main router gateway. The return traffic goes to the side router gateway instead. Unable to find the corresponding port pair, the side router drops the packets, and port forwarding fails.

### Solution (Skip Here)

The fix is simple. There are two layers of NAT, so configure port forwarding twice.


1. On the main router, forward the port to the side router.
2. On the side router, forward the port to the target machine.

Traffic then follows the same route in both directions, allowing the connection to be established:

```
你的机器 <——> 旁路由（NAT） <——> 主路由（NAT） <——> 外部机器
```

How you configure port forwarding depends on the operating system. iKuai and OpenWrt both provide a graphical interface, so I will not repeat those steps here. The side router in the previous post runs Debian, but the following method applies to any system using iptables. Run these commands to configure iptables; the target machine is called “internal” in the example, and the gateway machine “external.”

```shell
iptables -t nat -I PREROUTING -p tcp -d <外部 IP> --dport <外部端口> -j DNAT --to-destination <内部 IP>:<内部端口>
iptables -t nat -I POSTROUTING -p tcp --dport <内部端口> -d <外部 IP> -j SNAT --to-source <内部 IP>
```

That sets up iptables.

Note that `iptables -t nat -F` in clean.sh from the previous post clears all user-defined routing rules and breaks forwarding. You therefore need to run the commands above again after it executes.
