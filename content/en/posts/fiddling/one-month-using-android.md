---
authorship: human-only
title: "One Month After Switching to Android"
description: "My frequent phone changes took me from OnePlus to iPhone, and from enjoying tinkering to relying on an ecosystem. At my girlfriend’s suggestion, I recently bought an OPPO Find X8 Ultra to improve my photos. Migrating apps out of Apple’s ecosystem reminded me how uneven Android’s app selection remains and how difficult finding replacements can be. A month of migration has been an exercise in friction and adaptation between platforms."
date: 2025-06-05 23:26:00
categories: [fiddling]
tags: ["Tinkering", "Android", "Oppo", "Apple", "smartphone"]
---

### Introduction

I change phones frequently. Since starting work and saving a little money, I have developed a bad habit of loving the new and getting bored with the old. A phone rarely lasts a year in my hands. Whenever a new model launches, I start imagining it as my main phone and planning how to migrate my software and tools. Before long, the itch wins and I order it. The old phone goes to family, gets sold secondhand, or stays as a backup until I gradually forget it.

In the four years since graduation, my main phones alone have included the OnePlus 8T, OnePlus 9 Pro, Pixel 5, OPPO Find X6 Pro, Vivo X Fold3 Pro, iPhone 14 Pro, and iPhone 16 Pro. I also have a OnePlus 7 Pro as a backup.

That history reflects my changing attitude. Early on, with OnePlus and Pixel, I loved tinkering: near-stock Android, root, unlocked bootloaders, as much freedom as possible. With OPPO and Vivo, I gradually stopped fiddling but retained some interest in unusual hardware, such as Vivo's foldable screen. Then iPhone took me fully into Apple's camp and deep into its ecosystem.

Just as I was happily drowning in that ecosystem, my girlfriend hit me with: “Your photos are absolute garbage.” Fair enough. Back when I obsessed over phones, I cared about benchmark scores and specs. A camera only needed to scan QR codes. Now I had to prove to her:

> Any shortage of technique can be compensated for with software and hardware!

Of course, this was just another excuse to buy a phone. In fact, K's camera had caught my attention on our last [Kansai trip](/en/travels/kansai-202504), especially its long telephoto lens. But I am naturally lazy and do not want to edit photos afterward. Why not buy a <mark>smartphone</mark> with better lenses and color processing to satisfy that urge?

As it happened, all three major players released their biggest Ultra models in the first half of the year: Vivo X200 Ultra, OPPO Find X8 Ultra, and Xiaomi 15 Ultra. Xiaomi was ruled out first—<del>Lei Jun! Jin Fan!</del> Vivo's telephoto extender was tempting, practically made for concerts, but since I cannot get concert tickets, I chose the OPPO Find X8 Ultra with its one-inch main-camera sensor. It has been a month now. The main difficulty was leaving Apple's ecosystem, especially with so many developers making only iOS apps and Android's uneven app quality. Finding equivalents took considerable time. With no bootloader unlocking, root was out of reach, so I had to compromise on several features.

### Removing ads

The biggest problem with Chinese Android phones is advertising everywhere. First order of business: remove it.

::video-embed{type="bilibili" id="BV18c6JYLEmw"}
::

Afterward, only the recommendation ads at the bottom of the Weather app's secondary pages remained. Stubborn as a rash.

### Photo backups

My complete Apple setup meant all photos lived in iCloud. I paid for the 200 GB tier specifically for photos and currently use 50 GB, containing everything since my undergraduate years. I recently moved my NAS to 飞牛 (fnOS) and backed these photos up again to its built-in photo library.

Switching to Android, I certainly was not going to use the manufacturer's cloud—yes, 欢太云, I mean you. Moving to Google Photos would be troublesome too. Last year I spent ages exporting everything from Google Photos to iCloud; what would be the point of moving it all back? Google also provides only 15 GB without a subscription. I did snag Google AI Pro's 2 TB offer using my alumni email, but relying on that still makes me uneasy.

Since my other devices remain Apple, I decided to keep iCloud. I installed O+ Connect on the Mac, which connects automatically when I open the computer each day, though I still have to export photos and import them into Apple Photos manually. Honestly, O+ Connect is much worse than Vivo's desktop companion software. It is buggy and incomplete: no clipboard sync, no phone control from the Mac, no automatic photo sync. OPPO seems to have given up on frequent updates too. It will have to do.

### Proxies and connecting home

I keep proxy software on both my phone and computer, primarily to connect back to my home network, for two reasons:
1. Accessing self-hosted services such as the photo library above and my notes service.
2. My home network has DNS ad blocking and a rule-based transparent proxy. Connecting home gives me the same network experience without configuring complicated rules again.

On iPhone, I kept Surge in the background 24/7, sending all traffic home. But doing that while physically at home breaks connectivity. Surge's useful Subnet Override feature can act on the current Wi-Fi SSID, for example using SUSPEND to bypass the proxy globally. That solved the problem perfectly and let Surge stay on all the time.

Android's first problem was too much choice. Unlike iOS clients, most of which implement their own proxy cores, Android clients usually wrap open-source cores such as mihomo (Clash), v2ray, xray, or the newer sing-box with a UI. Consequently, <del>most</del> almost all clients cannot edit routing rules directly in the UI; you upload or subscribe to a configuration file. That is minor, since mine would barely change once written. The harder part was finding a client with something like Surge's Subnet Override. I did not want to manually toggle a proxy whenever I left or returned home.

I finally found the relatively obscure SurfBoard, which supports SSID rules. Adding a DIRECT SSID rule at the very top achieves the goal indirectly. More surprisingly, it supports Surge-format configuration files.

::github{repo="getsurfboard/surfboard"}
::
SurfBoard defaults to FakeIP and does not let you change it, so even requests using the SSID rule resolve to FakeIP first. It is less complete than a global bypass, but better than nothing.

### Bookkeeping

I happened to develop a bookkeeping habit just before switching phones. After more than two months, I record daily spending and reconcile accounts each day, including investment returns. One iOS app I strongly recommend is iCost: clean-looking but feature-rich. Quick entry can be added to Shortcuts and invoked with a double back tap or the iPhone 16's Action button. AI reads the screen and fills in the main details; I only need to choose a category. iCost plans an Android version, but that has been in the works for over two years with slow progress.

Xiaohongshu is full of bookkeeping app developers. The Chinese indie developer's holy trinity: notes, to-dos, and bookkeeping. I eventually found 钱迹, a long-established app apparently older than iCost. It syncs across iOS, macOS, Android, even Windows and HarmonyOS NEXT, and imports old iCost records quickly. All expected features are there: asset management, credit-card repayments, refunds, multiple currencies, and multiple ledgers, though I do not need the last one. Here is its [homepage](https://qianjiapp.com).

钱迹's automatic entry feels better than iCost's, perhaps because of platform differences. It uses accessibility services to recognize payment pages in Alipay or WeChat, then opens a small quick-entry window automatically. Recognition accuracy could improve: sometimes the Alipay payment-complete screen reached from another app is missed, requiring me to reopen the transaction in Alipay's history. A minor, tolerable flaw.

### Calendar and to-dos

The biggest iOS 18 update was integrating Calendar and Reminders. You can see and manage all reminders directly in the calendar, and iOS's excellent notification delivery makes them timely. It is arguably one of iOS's best little productivity tools, better than many paid apps. On Android, I immediately ruled out the built-in calendar: it has no portability, and changing brands next time would lose the data.

During my search, Microsoft's Outlook came fairly close. For an email app, its calendar is surprisingly good. But it cannot display the lunar calendar without subscriptions, which add events every day. Its localization is weak too: no traditional festivals or China's holiday/workday adjustments, requiring still more subscriptions. Add lunar birthdays and anniversaries, and the calendar becomes so packed that actual commitments are hard to spot. Its to-do features are also weak, merely serviceable.

Then I remembered the established to-do app 滴答清单, TickTick's Chinese version, and tried it. Unexpectedly, it was the best replacement for iOS Calendar plus Reminders. It directly supports everything above: lunar dates and events, holiday/workday adjustments, countdowns and anniversaries, and to-dos. It even natively supports the four-quadrant method that I had to implement with manually separated lists in iOS. A pleasant surprise. The annual 139-yuan subscription is less lovely, but that is my problem.

### Watch

Switching to Android finally freed me from that beautiful waste of space, Apple Watch, and daily charging. With an OPPO phone, naturally I needed an OPPO watch. I bought an OPPO Watch X2, almost as expensive as a brand-new Apple Watch.

The Watch X2 has a round face, uncommon among smartwatches these days, and mostly skeuomorphic watch faces that feel refreshing. My requirements are modest: tell the time, mirror phone notifications and alarms, and record sleep and other health data. It handles all of that perfectly. HRV was another surprise. Apple Watch largely neglects this metric, usually leaving third-party apps to display and interpret it. OPPO gives it unprecedented attention, with a dedicated physical-and-mental-state page and even Sun Yingsha as an endorser.

### Closing thoughts

After all that tinkering, I finally have a phone that feels comfortable to use. My girlfriend approves of the photos too. Perfect.
