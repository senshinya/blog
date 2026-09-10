---
title: "One TREK, Twenty Stacks"
description: "I found a trip-planning tool on GitHub Trending and wanted to host my own instance. Since I was getting a new VPS anyway, I might as well install a little extra. Well, quite a lot extra."
date: 2026-05-11 22:43:00
categories: [fiddling]
tags: ["Tinkering", "vps", "self-hosting"]
---

A few days ago, I came across TREK on GitHub Trending. It lets a group plan routes, book accommodation, and budget on the same map, then hand the plan to someone else to keep editing. I tried the demo, and it was beautifully done.

For trips with my girlfriend, I had been cobbling together itineraries in Obsidian, linking back and forth between daily notes. They only got messier, and by departure day the plan was usually still a rough “go here in the morning, there in the afternoon.” The author’s demo is usable as-is, but keeping travel plans on someone else’s machine makes me a little uneasy. Sooner or later, I would have to host it myself.

If I was going to host it myself, I might as well get a new VPS.

### Netcup ARM

Choosing a VPS took some deliberation. DigitalOcean and Linode cost more than twice as much for the same specs, so they were out. Hetzner offers good value, but its ARM location choices are limited. Small Chinese providers are cheap, but ICP filing is a minefield and bandwidth is painfully low. After going around in circles, I came back to Netcup.

I chose the VPS 2000 ARM G11: 10 vCores, 16G RAM, 512G NVMe, and 2.5 Gbps for €13.41 per month including tax. Equivalent x86 specs would cost at least twice as much. Transfer is flat-rate, only throttled to 200 Mbps once the 24-hour rolling average exceeds 2 TB. My little sites will never come close.

A quick Google search before ordering turned up a 50%-off coupon. The first term came to just over €6.70, with renewal at the normal price. An excellent deal.

There were four locations: Nuremberg, Vienna, Amsterdam, and Manassas on the US East Coast. I picked Manassas; typical routes from China have noticeably lower ping there than to the European sites. As for the IP’s email reputation, all my outbound mail goes through a Resend HTTPS bridge, which I will explain later. It never uses the local IP for delivery, so there was no reason to insist on Europe for that.

### From Zero to TREK

Login details arrived about five minutes after ordering. Before installing anything, I tightened SSH access: no root login, no password authentication, a different port, and ufw default deny in. After fail2ban had run for two days, I checked its logs: before moving away from port 22, there had been more than 5,000 brute-force attempts a day.

ARM64 image support has improved enormously over the last couple of years. Among the twenty-odd stacks I eventually installed, Caddy, Postgres, Stalwart, SnappyMail, Open WebUI, Vaultwarden, Dagu, Glance, Karakeep, and Paperless all had official multi-architecture images. docker pull just worked. The only slightly awkward one was the Forgejo runner. Its base image supports ARM64, but I wanted to run docker compose inside the runner as a deployment tool, so I had to add docker-cli and docker-compose-plugin myself. In the end, I pushed an ARM64 image to my Forgejo registry with buildx, ready for the runner to pull at startup.

Finally, TREK itself. The mauriceboe/TREK repository includes an official docker-compose.yml, which I copied and adjusted in a few places:

- Expose the port only to the web Docker network.
- Generate a new ENCRYPTION_KEY with `openssl rand -base64 32`.
- Use SQLite for DATABASE_URL; plenty for personal use.
- Join the external web network to connect to Caddy.

One line, `reverse_proxy trek:3000`, finished the Caddyfile. From `docker compose up -d` to a login page at trek.shinya.click took less than 15 minutes.

After registering the first account and looking at the empty dashboard, my instinctive thought was not where to start planning a trip, but what else I could cram onto this machine.

### Twenty-Odd Stacks

That thought was probably where the late-night tinkering began. ~~Itchy fingers.~~ There was plenty of capacity, and it was just sitting there. I might as well bring over everything I had wanted to self-host.

The next morning I installed Forgejo for code hosting and took the opportunity to revamp the blog, which I will get to below. Email became a trio of Stalwart, SnappyMail, and a Resend bridge I wrote. For AI, CLIProxyAPI combines my OpenAI, Claude, and Gemini subscriptions behind Open WebUI. Then came passwords, cloud storage, image hosting, notes, read-it-later, RSS, and PDF utilities. I tried almost anything that could be self-hosted. Authelia handles SSO. For backups, Dagu runs a DAG that takes encrypted snapshots to R2 every day.

Once everything had gradually found its way onto the server, the setup looked roughly like this:

![The blog was not included when I drew this; it would be even more crowded now](https://blog-img.774352199.xyz/4F9LtW.png)

Incoming traffic uses Cloudflare SaaS with smart DNS routing to the origin. Caddy is the only public-facing TLS endpoint and reverse-proxies to the appropriate container based on the Host header. Services requiring login all use Authelia forward_auth. Outbound email goes through a bridge to Resend’s HTTPS API, bypassing Netcup’s block on port 25.

All twenty-odd stacks in Dockge were green. A fair number were there because I had caught the deployment bug: I only wanted TREK, and by the end it occupied one tiny box in the diagram.

### Moving the Blog

The blog had been Astro with retypeset: push Markdown and let CI build and publish it. It had worked for over a year without major problems, but a few things kept bothering me. Even a typo fix required a commit, push, and build. Adding a link to a friend’s blog or a standalone page meant fiddling with the file tree again. Travel posts with lots of photos made builds absurdly slow.

So I took the opportunity to rebuild it.

The new stack is SvelteKit 2, adapter-node SSR, and UnoCSS. I kept the retypeset look and rewrote its styles in UnoCSS. PocketBase became the content backend, with seven collections putting posts, tags, travelogues, travelogue days, travelogue photos, standalone pages, and friend links into SQLite. i18n now supports zh, en, and ja side by side. I wrote a migration script to dump the Markdown exported from Astro into PB: 123 posts, four travelogues, 148 travelogue photo records, plus all the pages and friends.

Deployment is now blue-green. Two containers, blog-blue and blog-green, stay up, with `/opt/app/blog/active` marking the active one. Caddy imports its upstream from `/opt/app/caddy-blog/upstream.caddy`. After pushing a new image, CI runs switch.sh: start the target color, wait for health checks, update the import file, and run caddy reload to switch traffic, automatically rolling back on failure. Publishing no longer means waiting three minutes for a build. Edit in PB, save, and it is live.

The admin is an SPA inside SvelteKit at /admin, protected by Authelia forward_auth. Writes from admin to PB go through Caddy’s same-origin `/api/pb/*` reverse proxy, with Caddy injecting the token. Neither the browser nor the Git repository can access that key. A PB write triggers a JS hook that POSTs to an internal endpoint on the blog container to invalidate the server cache, then calls the Cloudflare API to purge the edge cache. Public pages are still served from the CDN most of the time.

The whole migration took two evenings.

### Afterword

Several days of tinkering later, I still have not made a single plan in TREK = =
