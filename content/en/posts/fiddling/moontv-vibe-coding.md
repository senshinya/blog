---
title: "MoonTV: An Experiment in Vibe Coding"
description: "MoonTV is a new video aggregation platform built with Next.js and React to make following shows convenient. It began as an attempt to improve LibreTV and has attracted substantial attention and usage over several months of development. Cursor made development efficient, although multi-platform support and complex data dependencies posed challenges. As its user base grows, MoonTV continues improving in response to feedback."
date: 2025-07-20 23:32:00
categories: [fiddling]
tags: ["Tinkering", "moontv", "vibe coding", "cursor"]
---

About half a year ago, I started following [LibreTV](https://github.com/LibreSpark/LibreTV), a video aggregator that combines resources from various indexing sites into unified search and playback. I wanted to deploy something for my girlfriend to watch shows on. Later, I contributed quite a bit of code, including replacing the HTML5 player, and became increasingly familiar with how it worked. Continued use exposed its weaknesses: it is entirely frontend-based, storing viewing history and other data in browser localstorage, so changing browsers loses everything. The code is plain JS, touched by many hands and rather messy. Without static checks, I was afraid to touch much of it, let alone make major changes.

A few months later, a colleague told me Cursor accepted Alipay. That perked me up. I had been using Trae, whose models were weak and whose peak-time queues were long. It then introduced paid plans, leaving free requests behind three or four hundred people, making it almost unusable. I immediately bought a month of Cursor Pro to try it, with a LibreTV rewrite as my test project.

With absolutely no frontend experience, I began vibe coding. Most code was produced directly through conversations with Cursor. MoonTV was the result:

::github{repo="MoonTechLab/LunaTV"}
::
Only a month has passed, and it already has 4.6K stars and 5.4K forks—apparently some freeloaders fork without starring. The star history below shows how much demand there is in China for pirated video, thanks entirely to iQIYI, Youku, and Tencent Video's customer-hostile antics and that very tall wall.
[![Star History Chart](https://api.star-history.com/svg?repos=MoonTechLab/LunaTV&type=Date)](https://www.star-history.com/#MoonTechLab/LunaTV&Date)

Built on Next.js and React, the project supports deployment to Vercel, Cloudflare Pages, and Docker, with localstorage, Redis, or Cloudflare D1 for storage. Redis and D1 support isolated per-account data and synchronization across browsers, along with a convenient admin panel. Upstash integration is also planned.

This was my first attempt at vibe coding, my first frontend/full-stack project—“full-stack” seems to be a term used only in the Node/JS ecosystem—and my first reasonably serious open-source project. With Cursor, most of MoonTV's development shifted from writing code to reviewing code. I could implement requirements just by chatting with Cursor, although there is some technique to that chatting.

The first difficulty came right at the beginning. Knowing nothing about frontend development, I recognized the names of trendy stacks without understanding them. To use something current, I chose serverless-friendly Next.js and Tailwind CSS as the main framework. I created a folder and asked AI to initialize a Next.js/Tailwind project. Half an afternoon of repeated attempts produced nothing that ran correctly: styles were usually missing, leaving pages looking like piles of plain text. Utterly baffled, I gave up and found a scaffolding project on GitHub as a foundation. Only then could development proceed normally.

Actual development went smoothly. I mostly used Claude Sonnet 4.0 and GPT O3, whose tendencies became clear. Sonnet 4.0 is suited to sweeping changes; even when fixing a small issue, it sometimes tries to refactor the entire project. It is better for new features. GPT O3 is better at small repairs: it keeps changes tightly scoped instead of randomly modifying files throughout the project, making it better for bugs in existing features.

Some problems exceeded AI's abilities. The playback page had complicated state transitions and interconnected data. In the AI implementation, dependencies became a web. A single change, such as switching episodes or sources, could eventually trigger five or six repeated player initializations, making it flicker. Many models failed to fix this. I finally traced the dependency propagation paths myself and eliminated the repeated initialization.

Other unsolved problems were more niche. Most players do not enable AirPlay or Chromecast for m3u8 video, but small tricks can force this on. Asked directly, AI would say it was impossible, offer incorrect solutions, or suggest replacing the player with some other one it claimed could do it. After searching all over the web, I found [this issue](https://github.com/video-dev/hls.js/issues/6482#issuecomment-2582666967) tucked away in hls.js and finally enabled AirPlay. At its current level, AI mostly handles common problems. Do not expect much yet with very niche problems, let alone ones humans cannot solve.

The bigger challenge was supporting multiple platforms and environments. From the start, the plan was Vercel, Cloudflare Pages, and Docker. Next.js runs natively on Vercel, which caused little trouble. The project uses next-on-pages to translate code for Cloudflare Pages, so compatibility issues crop up regularly. Docker support is more complicated: API handlers, for instance, run in Node, while Next.js retains an edge environment for middleware such as authentication. These environments do not share memory, so dependencies and available APIs must be kept strictly separate. Client environments are complex too, especially WebKit. On iOS and iPadOS every browser must use WebKit, and many of its APIs and CSS behaviors differ substantially from Chromium, requiring special accommodations.

Because MoonTV grew out of LibreTV, early promotion happened in LibreTV's chat groups, which also served as MoonTV's discussion groups. My own promotion was almost entirely on linux.do, and really just changelog posts for major updates. Later, I noticed tech creators spreading MoonTV on their own: people I followed on X, tech channels on Telegram, and even creators on YouTube, Bilibili, and Xiaohongshu began teaching people how to deploy it.

More users naturally brought a flood of issues. Broadly, there are two categories. Bug reports make up most of them—who writes code without bugs, especially when AI wrote it all? Yes, I am shifting the blame. Feature requests split further: reasonable ones help the project improve, usually around layout, interaction, or data integrations. The least welcome are commercialization requests. These people apparently want to deploy the project and charge customers, but it has no monetization features and they cannot implement them, so they file FRs. The fewer of these lazy freeloaders, the better. One guy filed a whole batch, got banned, then kept pestering us in the Telegram group. Truly obnoxious. There is also the invalid-bug category: deployments fail because someone did not read the README, or searches fail because of their own network, and they start shouting in the issues. Even passersby from the chat group would spit on these before moving along.

Once a project becomes known, related projects start appearing too. MoonTV has an Android TV client called OrionTV, which can use MoonTV as its backend and sync viewing history. People in the chat groups have also made Android and iOS clients. Various restrictions mean the iOS version cannot be listed in the store, of course.

::github{repo="zimplexing/oriontv"}
::
That is all. I meant to finish this post in early July, when there were only 2K stars, but kept putting it off. Writing posts is simply less fun than writing code. That is how I am: once I have something in progress, I think about it constantly, eating or sleeping. Getting up at two or three in the morning to fix a bug that just occurred to me is common. For two straight weeks I slept only a little over six hours a day, working through the nights and back into the days.
