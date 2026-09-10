---
authorship: human-only
title: "Connecting My Shanghai and Hangzhou Networks"
description: "My girlfriend moved from Beijing to Shanghai for work, and I helped arrange broadband too. Shanghai Telecom’s 500M connection costs more than a 1000M line in Hangzhou, frustratingly. I set out to connect the two cities’ networks: transparent proxying in Shanghai, selected traffic exiting through Hangzhou, and access between both LANs. Hangzhou already had a simple setup with a software router and an AP, configured to route my everyday traffic home and ready for the next networking adventure."
date: 2025-04-18 16:43:12
categories: [fiddling]
tags: ["Tinkering", "transparent proxy", "software router", "networking", "mihomo", "tailscale"]
image: "https://blog-img.774352199.xyz/O6cAGh.webp"
---

### Introduction

My girlfriend moved from Beijing to Shanghai for work this month.

Along with helping with the move, I arranged a 500M China Telecom broadband connection.

A quick complaint about Shanghai Telecom: its 500M broadband costs more than Hangzhou Telecom’s 1000M service.

~~Is the fiber made of gold, or is it the ONT?~~

As a self-proclaimed geek, I could hardly leave it alone. I settled on these goals:

1. Transparent proxying for censorship circumvention in Shanghai.
2. Route some Shanghai traffic out through Hangzhou.
3. Allow both LANs to access each other.

The second goal is because I currently use a proxy subscription service to unlock Netflix and other streaming platforms—insert affiliate link here. The provider limits who can use an account, and simultaneous use from multiple places could get it banned. The workaround is to forward that traffic to Hangzhou and give it a single exit there.

### Preparation

The Hangzhou topology is simple: the ONT connects to a software router that handles PPPoE, then a TP-Link device serves as a wireless AP. A mini PC connects directly to the router and runs a Shadowsocks server for routing my everyday traffic home. The router is a BKHD G30S—insert advertisement here—with an N5100 that does the job just fine, running ImmortalWrt. It has these plugins installed:

* AdGuard Home: DNS-based ad blocking.
* Nikki: transparent proxying with the Mihomo core.
* Tailscale: virtual LAN networking, previously my backup way to route traffic home.
* DDNS-Go: as you can see, just DDNS.

The LAN subnet is 192.168.7.0/24.

To keep the devices consistent and reduce complexity a little, I bought another G30S with the same configuration and installed ImmortalWrt. Shanghai would use the same topology as Hangzhou: ONT → software router → AP.

### Installation

Installing ImmortalWrt deserves a mention. I initially assumed it worked like Windows or other Linux distributions: the image would be a live CD or installer, and I would boot it from a USB drive to install the system. Instead, it simply booted from USB…

Just… booted.

So the img was the actual system image all along.

I quickly switched the USB drive to WinPE and used physdiskwrite to write the image to the internal disk. It booted successfully, and a little configuration got Internet access and DHCP working. Shanghai’s LAN subnet is 192.168.10.0/24.

Next came expanding the disk. OpenWrt installed by writing the image directly has less than 1G of usable space, leaving the rest of the disk wasted. This was the second hurdle: I could not find a suitable guide. Simplified Chinese tutorials were tangled, error-ridden copies of one another. They either covered expanding squashfs or creating another partition in the unused space and moving the root mount there. Almost none explained how to actually expand the partition.

I finally found it in the [official OpenWrt documentation](https://openwrt.org/docs/guide-user/advanced/expand_root). I should probably stop searching in Chinese; even Google turns up little of use.

First, the circumvention and traffic-exit requirements. Clash alone can handle these.

[Nikki](https://github.com/nikkinikki-org/OpenWrt-nikki) is an OpenWrt plugin for transparent proxying with the Mihomo core. It offers more customization than similar plugins such as Passwall or Clash. Follow the installation instructions in the README: downloading the ipk directly from Releases does not work, oddly enough.

::github{repo="nikkinikki-org/OpenWrt-nikki"}
::
Once installed, import a configuration file and start it. A few points:

1. You can enable TUN mode directly. It automatically configures the router’s routing table for transparent proxying and generally works fine.
2. Mihomo’s domain-based routing requires DNS queries to go through Mihomo. There are two options: let Mihomo DNS hijack port 53 and move OpenWrt’s dnsmasq to another port, or configure dnsmasq to forward all DNS requests to Mihomo’s DNS port.
3. In FakeIP mode, configure the FakeIP Filter carefully.

Everything else is the usual stuff, essentially the same as using Mihomo on other platforms, so I will leave it there.

After configuration, enable Nikki. The dashboard will show Mihomo taking over all outbound traffic from the router.

I mostly copied the configuration from my own setup. Most circumvention traffic connects directly to my BandwagonHost proxy 🪜. For rules that need a Hangzhou exit, I changed the outbound to the Shadowsocks server in Hangzhou. Latency was acceptable in testing; think of it as one extra relay within China.

At this point, Shanghai could already access the Hangzhou LAN by domain name. In FakeIP mode, requests to the returned fake address are handled by Mihomo, which can forward them to Hangzhou using domain rules. Direct IP requests bypass DNS, though, so Mihomo cannot forward them—TUN does not take over LAN requests by default. Hangzhou also still could not access Shanghai.

Enter Tailscale!

On OpenWrt, [luci-app-tailscale](https://github.com/asvow/luci-app-tailscale) gives you a fairly intuitive interface for managing and configuring Tailscale.

::github{repo="asvow/luci-app-tailscale"}
::
After installation, start it once and complete login authentication before configuring it. It is also best to disable key expiry for this device in Tailscale.

In Advanced Settings:

* Enable routing: Tailscale automatically configures routes to other subnets.
* Leave Allow DNS unchecked: we only need it to route IP requests.
* Set Advertised Routes to 192.168.10.0/24, telling Tailscale that this device routes this subnet.
* Enable subnet interconnection: exactly what it says.
* Select 192.168.7.0/24 for subnet routing, so Tailscale handles routes to that subnet.

Apply the corresponding settings to Tailscale in Hangzhou too, using the correct local and remote subnets for Advertised Routes and subnet routing.

Restart Tailscale after saving and the subnets can talk to each other. Machines in Shanghai and Hangzhou can now access hosts in the other subnet directly by IP.

### Afterword

The Shanghai connection turns out to be some kind of “cloud broadband.” Disabling that and enabling bridge mode is an enormous hassle; I still have not completed the process.

So all the setup above was done without a public IP on the Shanghai software router.

Fortunately, Hangzhou does have a public IP, so Tailscale can establish a direct hole-punched connection with latency in the teens of milliseconds. If neither side has a public IP, good luck: you either host your own DERP relay or put up with several hundred milliseconds of latency.

One more complaint about Shanghai Telecom: enabling bridge mode requires signing an agreement, taking photos, and waiting for approval. They treat you like a potential thief.
