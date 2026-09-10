---
authorship: human-only
title: "Making the Xiaomi 17 My Daily Driver: Unlocking, Flashing, Rooting, and Hiding Root"
description: "Unlocking the Xiaomi 17 bootloader, flashing a modified stock ROM, rooting and hiding root, and getting banking, payment, and proxy apps working normally again."
date: 2026-08-17 23:59:21
categories: [fiddling]
tags: ["Tinkering", "root", "bootloader"]
---

::quote{icon="tabler:device-mobile"}
Some systems are left untweaked for daily use. Others are hard to use daily without tweaking.
::

As an undergraduate, I loved tinkering with phones. Many brands allowed easy unlocking, and the community was alive with third-party ROMs, root, hooks... I can still picture that flourishing scene, everything bursting with life.

After starting work, I briefly thought I had outgrown tinkering. I used an iPhone for a while but never got comfortable with it. In the AI era, little ideas keep occurring to me, yet Apple's closed ecosystem makes installing third-party software a hassle of sideloading and signing. Really, I just do not want to pay \$99 a year for a developer account. Android phones, meanwhile, have taken a strange turn: they keep getting bigger. A standard iPhone's size counts as “small-screen” in Android land, with its medium, large, and extra-large tiers. My hands are small, and the standard iPhone is already my limit.

Earlier this year I switched to an OPPO Find X9s Pro, not a flagship, but pleasantly small. Later I found it had quite a few pain points beyond that advantage. I keep a VPN running for traffic routing and use iCost's automatic bookkeeping through accessibility services. Banking apps detect both accessibility and VPNs, then refuse to work. It gets old fast. Kernel scheduling also seems problematic, perhaps because of the Dimensity all-big-core design. In summer it gets terribly hot just scrolling X and Xiaohongshu, without any gaming. Once hot, the whole system stutters, seemingly dropping to 30 fps. Daily use had become a real problem.

After another evening of severe overheating and lag, I finally decided to replace it. Comparing options led me to the Xiaomi 17, partly for its small 6.3-inch screen. I traded in the old phone and paid another 500 yuan for a sky-blue 16+512 model. It made me marvel at the old phone's brand and celebrity markup: its endorser is an athlete whose followers are known for idol-fandom behavior.

While waiting for delivery, I browsed Coolapk and discovered that this phone's bootloader could actually be unlocked directly. Many people were making ROMs for it, and the community was thriving.

> An unexpected bonus.

The stock HyperOS installation survived less than an hour after delivery before I unlocked the bootloader and flashed a third-party modified stock ROM.

::alert{type="warning" title="Version note"}
The early unlocking vulnerability on 8e5 devices was closed by the February 2026 security patch. Most guides found online still describe that old exploit. For system versions after that patch, people mostly use [@AC 极光_Official](https://www.coolapk.com/u/17883039)'s [one-click unlocking script](https://www.coolapk.com/feed/73105378?s=ZTE1ODk2OGIyMTY3NjVnNmE4MzIyOTh6a1651).
::

Two active Coolapk creators make modified HyperOS ROMs for the 17 series: [江南](https://www.coolapk.com/u/25341491) and [毒蛇](https://www.coolapk.com/u/35810773). Both are high-school students. Young people these days are impressive. I chose [毒蛇's modified ROM](https://www.coolapk.com/feed/70200384?s=YTgxYmJmMWIyMTY3NjVnNmE4MzIzODJ6a1651), which comes rooted, with system debloating and a third-party kernel. Scheduling is well tuned: smooth and power-efficient, with seemingly fewer bugs. Flashing is easy too: reboot to the bootloader, then flash in one click.

Next came the usual installation of KernelSU, LSPosed, Zygisk Next, and related frameworks.

The biggest nuisance with a rooted system is app detection, especially banking and payment apps. Detecting root or other system modifications may disable features such as fingerprints, or make them refuse service entirely. Various modules are therefore needed to hide root.

Coolapk and other phone-tinkering communities have conflicting advice about hiding root and unlocked bootloaders, mixed with outdated tutorials. Finding a complete working setup is especially difficult. After some experimentation, I finally got there.

I mainly used just five modules:
::card-list
- [Magic Mount](https://github.com/Tools-cx-app/meta-magic_mount-rs): the core framework.
- [HMA-OSS](https://github.com/frknkrc44/HMA-OSS): hides the app list and accessibility services.
- [Integrity Box](https://github.com/MeowDump/Integrity-Box): disguises the phone as an official Google device to pass Google Play checks.
- [TEESimulator-RS](https://github.com/Enginex0/TEESimulator-RS): generates Android certificates for hardware key attestation.
- [Tricky Addon Enhanced](https://github.com/Enginex0/tricky-addon-enhanced): automates TEE certificate generation.
::

Flash the modules in order, then reboot.

HMA-OSS installs a separate app. Enable hiding for apps from which root, accessibility, and similar states need to be concealed, then enable templates. Set four app presets—accessibility apps, detector apps, root managers/root apps, and LSPosed/Xposed modules—and two settings presets: accessibility and developer options. Apps with hiding enabled cannot see sensitive installed apps or enabled features, bypassing their checks.

Next, press the launch button for the Integrity Box module in KernelSU. It randomly chooses a Google device to impersonate. TEESimulator-RS works without extra configuration.

In Zygisk-Next's module settings, set the denylist policy to “Unmount only”.

Download [Hunter APP](https://github.com/w296488320/HunterUpdate) to check whether root and related modifications are properly hidden.

::github{repo="w296488320/HunterUpdate"}
::

A System Patch mismatch means the security patch of the device impersonated by Integrity Box differs from the phone's actual patch, which you can find in system settings. To fix it, open TEESimulator-RS's module settings, tap the three dots at top right, choose Set security patch, enable Advanced, and set all three values to the actual patch date. Mine is 2026-07-01, so System is 202607, while Boot and Vendor are both 2026-07-01. Save afterward.

An error such as Found hole in prop area: u:object_r:bootloader_prop:s0 means the device's actual boot hash differs from that of the impersonated device. Get the real hash with the Key Attestation app, available on Coolapk. Copy BootHash into Integrity Box's Fix abnormal Boot Hash option, then reboot. If copying fails, take a screenshot and extract the text.

For other problems, try Integrity Box's Repair mode, which can fix some edge cases.

Afterward, banking and other apps all worked normally, fingerprint payments in WeChat and Alipay worked, and Hunter showed green across the board.

You can also use [Yumebox](https://github.com/YumeYucca/YumeBox) as your proxy app. With root permission, it creates a TUN interface directly instead of using the system VPN service, avoiding detection by third-party apps.

::github{repo="YumeYucca/YumeBox"}
::
