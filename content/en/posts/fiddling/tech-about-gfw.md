---
authorship: human-only
title: "How the Great Firewall Works"
description: "The GFW does more than monitor an exit gateway: it inspects international traffic through passive taps, copying inbound and outbound IP packets to a cluster for analysis and filtering. Understanding where and how this happens matters when studying censorship circumvention. Examining the GFW’s network topology helps explain its blocking mechanisms and how to work around them."
date: 2024-06-23 15:31:32
categories: [fiddling]
tags: ["Tinkering", "firewall", "global Internet", "circumvention proxy"]
---

Technology itself isn’t to blame.

> The Great Firewall (GFW), also called China’s national firewall, the Wall, or simply the firewall—and termed a cross-border data security gateway by the Cyberspace Administration of China—is the collection of hardware and software systems the Chinese government uses to filter content at international Internet gateways. — Wikipedia

To counter the GFW effectively, we need to look beyond which sites are blocked and understand the mechanisms. Knowing that Google is blocked does not directly help you get around it. Understanding how the GFW blocks Google is essential to choosing and implementing a circumvention method. Before discussing those methods, we therefore need to examine how blocking works.

### Where Is the GFW?

It is tempting to assume that the GFW sits on the exit gateways, where it can directly capture and inspect all outbound traffic. According to research at gfwrev.blogspot.com, however, it “passively taps the three international gateways,” using optical splitters to copy inbound and outbound IP packets to GFW clusters for inspection. The proposed topology is shown below, with the diagram from gfwrev.blogspot.com:

![gfw topology](https://blog-img.774352199.xyz/2025/4beb5462a598c9015c56c75fa73ae301.svg)

The GFW seeks to integrate heterogeneous links, and multiple techniques for coupling different link types have been studied (source: [Research on Intrusion Detection System Architecture in High-Speed Networks](https://xueshu.baidu.com/usercenter/paper/show?paperid=f46cb7e5a6dbf7b9cb81b1dd3b9965ce)). Under the Measures for the Administration of International Communications Gateway Offices, the major ISPs converge at public international fiber cables, while the security management center, CNNISC, has independent switching centers to which the ISPs connect. To accommodate different ISP link specifications, the GFW switching centers integrate these links, with each ISP providing a separate tap into the GFW. Since these are mainly fiber links, this is called passive optical splitting. Experiments suggest the taps need not sit immediately beside the last hop, hence the dashed lines in the diagram.

For a more rigorous study, see [Internet Censorship in China: Where Does the Filtering Occur?](https://web.eecs.umich.edu/~zmao/Papers/china-censorship-pam11.pdf).

Early research in 2010 suggested that the GFW project was implemented under the guise of a “Virtual Computing Environment Testbed” project.

> The Virtual Computing Environment Testbed was jointly built by the National Computer Network Emergency Response Technical Team/Coordination Center of China (CNCERT/CC) and Harbin Institute of Technology (HIT). Drawing on CNCERT/CC’s network infrastructure and computing resources across all 31 provinces, it integrates distributed, autonomously managed resources into an open, secure, dynamic, controllable, large-scale virtual computing test platform for studying and validating aggregation and collaboration mechanisms in virtual computing environments.

A paper published by the testbed project, [A Job-Level Task Scheduling Algorithm Based on Multisite Cooperation in a Computational Grid](https://dds.sciengine.com/cfs/files/pdfs/1674-5973/LcNrPPSfzafrc3Pmn.pdf), lists its 2005 configuration as follows:

| Site | Location | System | Nodes | Processors per node | Memory per node |
|  ----  | ----  |  ----  | ----  |  ----  | ----  |
|CNCERT/CC|Beijing|Dawning 4000L|128 nodes|2*Xeon 2.4G|RAM2G|
|HIT|Harbin|Dawning server|32 nodes|2*Xeon 2.4G|RAM2G|
|CNCERT/CC|Shanghai|Beowulf cluster|64 nodes|2*AMD|Athlon 1.5G|RAM2G|

Of course, those specifications are only from 2005. It is now difficult to establish what hardware and software the GFW currently uses.

### Processing the Data

After receiving IP packets, the GFW must decide whether communication with the server should continue. It cannot be too aggressive: cutting off all overseas websites nationwide would undermine its purpose. It first interprets the packets, then decides whether it can safely block the connection. This begins with reconstruction, analyzing TCP to rebuild a complete byte stream. Application protocols such as HTTP can then be analyzed on that stream, looking for politically unacceptable content and choosing an appropriate response.

To simplify the discussion, suppose there are three TCP packets:

```
IP 包 1：包含 TCP 包：包含的数据：Get /inde
IP 包 2：包含 TCP 包：包含的数据：x.html H
IP 包 1：包含 TCP 包：包含的数据：TTP/1.1
```

Reconstruction joins GET /inde from packet 1, x.html H from packet 2, and TTP/1.1 from packet 3 into GET /index.html HTTP/1.1. The result may be plaintext or encrypted binary protocol data; that is agreed between you and the server. As an eavesdropper, the GFW must infer what you are saying. HTTP is easy to recognize because it is standardized and unencrypted. Once the stream is rebuilt, the GFW can readily identify HTTP and the site you are visiting.

The difficult part is rebuilding streams at such enormous traffic volumes. [This blog post](http://gfwrev.blogspot.tw/2010/02/gfw.html) explains it clearly: the principle resembles a website load balancer. Hash a given source and destination to choose a node, then send all traffic matching that pair to that node. A single node can thus reconstruct a TCP session’s one-way byte stream.

Two more points for completeness:

1. Although reconstruction happens on passive optical taps, that does not mean every GFW component sits off the main path. Some responses discussed later require equipment on backbone routers, such as intermittent packet loss on Google HTTPS connections. The GFW therefore participates in routing for some IPs.
2. Reconstruction is of one-way TCP streams. The GFW does not need the two sides of a conversation together; it makes judgments from the content seen in one direction. Monitoring itself is bidirectional, though: traffic both into and out of China is reconstructed and analyzed. One TCP connection therefore becomes two byte streams for the GFW.

### Analysis

Analysis is the next step after reconstruction. Rebuilding streams mainly requires understanding IP and the TCP and UDP protocols above it. Analysis, however, requires understanding the many strange and varied application-layer protocols. We can even invent new ones ourselves.

Broadly, protocol analysis serves two similar but distinct purposes. One is preventing the spread of politically unacceptable content, such as searches on Google for keywords you “should not” search for. The other is preventing circumvention tools from bypassing inspection.

The first goal involves inspecting plaintext in protocols such as HTTP and DNS. The rough process is:

```
1. 特征检测
2. 拆包
3. 关键词匹配
```

Protocols such as HTTP have obvious signatures, so detection itself needs little explanation. Once the GFW identifies HTTP, it parses the packet according to its understanding of the protocol—for example, extracting the requested URL from an HTTP GET. It then matches that URL against keywords, checking for Twitter, for instance. Why parse first? It permits more precise blocking and fewer false positives, and may use fewer resources than matching the entire stream. The core of [liruqi/jjproxy](https://github.com/liruqi/jjproxy) exploited a flaw in this HTTP parser, although that bug has since been fixed. The GFW did not handle extra \r\n sequences correctly when parsing HTTP, while google.com did. This shows that the GFW interprets the protocol before keyword matching. The matching itself presumably uses efficient regular-expression algorithms; there is not much more to discuss there.

The following protocol analysis is known to be performed by the GFW:

#### DNS

The GFW can analyze DNS queries sent over UDP port 53. Queries whose domain names match keywords are hijacked. The matching certainly uses something resembling regular expressions rather than a simple blacklist, given the enormous number of subdomains. Evidence includes:

- In March 2010, an engineer at a Chilean domain registrar found abnormal responses when querying a root server in China for facebook.com, youtube.com, twitter.com, and other domains. Netnod, the operator of the Chinese root server, temporarily disconnected it from the global Internet. Security experts believed the issue was unrelated to Netnod itself and resulted from a network change by the Chinese government elsewhere.
- At 3:30 p.m. on January 21, 2014, DNS resolution across China malfunctioned, sending many websites to 65.49.2.178. The IP was hosted at Hurricane Electric in Fremont, California, and was leased by Dynamic Internet Technology for a circumvention-software node. The company and researchers attributed the incident to a GFW operator’s mistake, while others said an actual hacker attack using that IP as a stepping stone could not be ruled out.
- On January 2, 2015, poisoning changed: instead of fixed, blocked addresses, the GFW began injecting reachable addresses of real overseas websites. This subjected overseas servers to DDoS traffic from China, prompting some sites to block Chinese IPs. In April that year, CNCERT stated that the hijacking was caused by an overseas attack.

Source: https://zh.wikipedia.org/wiki/%E9%98%B2%E7%81%AB%E9%95%BF%E5%9F%8E

#### HTTP

The GFW identifies HTTP and checks the URL and Host in GET requests. A keyword match triggers TCP RST blocking.

#### TLS

In early TLS versions, the server’s handshake response, including its certificate, was unencrypted, allowing the GFW to infer the destination site. Since TLS 1.3, handshake messages after ServerHello, including the site certificate, are encrypted in transit. This generally prevents inspection of certificate information.

However, the widely used SNI extension to TLS tells the server the requested domain at the start of the handshake so a server hosting multiple HTTPS sites can select the right certificate. This extension is also unencrypted. The GFW currently inspects that plaintext SNI domain to block connections. Since HTTPS is HTTP plus TLS, detection of HTTPS connections can still be grouped with HTTP detection.

**Note: because the GFW cannot obtain the target domain’s certificate, it still cannot decrypt the actual HTTPS content.**

#### Traffic Fingerprinting

The GFW’s second goal is to block circumvention tools, and it is more aggressive here. Mishandling HTTP blocking can disrupt normal Internet operation; the GFW depends on the Internet and will not threaten its own existence. A protocol such as Tor, used almost entirely for circumvention, gets no such leniency once detected. I do not know exactly how the GFW blocks every circumvention protocol, and the situation keeps evolving. Still, two examples show its considerable technical capabilities.

The first is automatic blocking of Tor, showing how far the GFW goes to understand the protocol. According to https://blog.torproject.org/blog/knock-knock-knockin-bridges-doors, connecting from a Chinese IP to a Tor bridge in the US is detected. About 15 minutes later, the GFW impersonates a client and connects to that bridge using Tor. If it confirms a Tor bridge, it blocks the port. Changing ports works briefly, then gets blocked again. This demonstrates its ability to pick out a Tor bridge connection from international traffic. Tor developers attribute this to the handshake’s conspicuous fingerprint. It also shows the effort the GFW makes: it actually pretends to be a client and tries connecting itself.

The second example shows that the GFW does not care whether encrypted traffic actually contains sensitive words. Suspected circumvention alone is enough, especially for commercial services. It is almost certain that the GFW has been upgraded to automatically identify encrypted traffic that appears to carry circumvention services.

The GFW’s recent focus is clearly traffic analysis to identify circumvention. There is relatively little research on this, and a notable pattern is that personal use may be fine while deployment at scale easily runs into trouble.

### Interference Methods

Once protocol analysis labels a byte stream as a threat, the GFW interferes with further communication in the following ways:

#### IP Blocking

This commonly follows manual inspection. I have not heard of a way to make automated GFW detection immediately block an IP. Usually detection first triggers TCP resets; an IP block arrives later, with no obvious timing pattern. My guess is that blanket IP blocking requires human intervention. I stress blanket blocking, as distinct from a partial block where only your access to that IP is stopped for three minutes while others can still reach it. Those are entirely different mechanisms even if both look like failed pings. To see a blanket block, try pinging twitter.com. It has been blocked for ages.

The implementation adds invalid blackhole routes to backbone routing tables so the routers discard packets for the specified IPs on the GFW’s behalf. Routing tables are updated dynamically using BGP. The GFW only needs to maintain a blocked-IP list and advertise it through BGP; backbone routers across China effectively become accomplices.

A traceroute to an IP blocked for everyone shows packets being dropped by China Telecom or China Unicom routers before they even reach the international gateway where the GFW sits. That is the effect of the BGP announcement.

#### DNS Hijacking

This is another common response after manual inspection: someone finds an unacceptable site and adds its domain to the hijack list. It exploits weaknesses in DNS and IP: neither verifies the server’s authority, and DNS clients blindly trust the first answer received. For a facebook.com query, the GFW only needs to beat the legitimate response, impersonating the queried DNS server and returning a false answer.

#### TCP Connection Resets

TCP specifies that a received RST immediately terminates the connection. In a browser, you see a connection-reset error, familiar to many of us. My impression is that this is currently the GFW’s main response. Most resets are conditional, triggered by something like a keyword in the URL. Many sites receive this treatment, Facebook being a famous example. Others are reset unconditionally: for certain IP-and-port pairs, any packet triggers a reset regardless of its contents. HTTPS Wikipedia is a well-known example. This TCP-layer response exploits IPv4’s weakness: anyone on the network can send packets pretending to be someone else. The GFW can therefore easily convince you that Google sent the RST and convince Google that you sent it.

#### Port Blocking

The GFW’s main components are intrusion-detection devices attached to passive taps beside backbone routers, using optical splitting to capture packets for IDS inspection. Those routers also block ports, acting as an IPS. After detecting a connection, the GFW can do more than reset it: backbone routers can block a specific port or IP, or selectively drop packets. Think of the routers as having iptables-like capabilities for real-time network- and transport-layer parsing and rule matching. Cisco calls this ACL Based Forwarding (ABF). Rules are deployed nationally, so if one router blocks your port, every GFW-equipped backbone router does too. Port blocking generally targets circumvention servers detected providing services over SSH, VPN, or similar protocols. The GFW deploys an ACL rule at international-exit backbone routers nationwide to block downstream packets from that server and port. Specifically, packets traveling from overseas into China are filtered if their src is the blocked server IP and their sport is the blocked port. This permits upstream packets to reach the server while filtering the downstream response.

Changing the server’s port after a block usually leads to another block quickly, and repeated attempts eventually get the IP blocked. A tentative inference is that port blocking uses blacklists and manual filtering rather than being a fully automatic response. One reason is reports that these blocks occur during daytime working hours.

#### Reverse Blocking

Most proxy subscription providers use relay servers within China. If the GFW detects unusually large overseas traffic, it may reverse-block the relay during sensitive periods such as the Two Sessions or National Day. Overseas servers then cannot reach the relay’s IP: ping tests are red everywhere outside China and green inside. There are few remedies. Change the IP, or wait for the sensitive period to pass and access to recover automatically.

> Reposted, edited, and supplemented from:
> 1. https://ednovas.xyz/2022/06/25/gfw/#%E4%B8%AD%E8%BD%AC
> 2. https://gfwrev.blogspot.com/2010/02/gfw.html
