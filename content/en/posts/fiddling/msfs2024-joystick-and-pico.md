---
authorship: human-only
title: "Adventures with Microsoft Flight Simulator 2024"
seoTitle: "Microsoft Flight Simulator 2024: TCA joystick and PICO 4 Pro VR setup"
description: "A friend’s comment got me interested in simulation games. After buying Microsoft Flight Simulator, I discovered streamed maps and models, another account login, oddly hidden tutorials, and awkward keyboard controls. A flight stick and some tinkering with Pico VR finally rounded out the experience."
date: 2025-12-14 14:31:00
categories: [fiddling]
tags: ["Microsoft Flight Simulator 2024","Thrustmaster TCA","PICO VR","Flight simulation"]
image: "https://blog-img.774352199.xyz/lfhEuE.webp"
seoDescription: "My Microsoft Flight Simulator 2024 setup, from streaming and tutorials to Thrustmaster TCA controls and PICO 4 Pro VR through Virtual Desktop and OpenXR."
---

### Introduction

Simulation games (SLGs) have always been a relatively niche genre. A steep learning curve and a supposedly “boring” experience put players off—who wants more real life after work? I have always liked realistic simulation, or rather been fascinated by the concept. It reminds me of the “digital twin” idea I encountered as an undergraduate, yet I had never actually tried it.

The opportunity came when K mentioned playing Euro Truck Simulator lately, living the dream of “working at work and continuing to work after work.” Inspired by this, and suffering from a bout of gamer impotence (nothing sounded fun anymore), I decided to try a simulator. A colleague happened to mention that he had always wanted to play Microsoft Flight Simulator 2024. After a little research online, I decided to buy it.

![Image from the web](https://blog-img.774352199.xyz/2025/73bd42514ceb45fe9eed37b39d420e3b.webp)

### First impressions of MSFS2024

I bought the standard edition on Steam during lunch that day: HKD 498 in the Hong Kong store. At that price, the poor are safe from getting ripped off. Counterintuitively, the game itself is only about 8 GB. Maps, scenery, weather, building models, and other data download in real time as you play. This streaming demands a good connection; Reddit mentions needing at least 80 Mbps to the relevant Microsoft servers, which are overseas. A good game accelerator or some special networking arrangements are necessary for a decent experience. Otherwise, you may not even get through the initial launch and Xbox sign-in.

PC and Xbox accounts are linked, so after launching through Steam, you must sign into Xbox again inside the game to sync your edition and purchases. MSFS 2024 includes a store selling airports and aircraft. There are three editions: Standard, Deluxe, and Premium Deluxe—medium, large, and extra-large. They differ only in the airports and planes unlocked.

MSFS2024 adds a career mode with something like a main storyline: complete missions, earn money, buy aircraft, fly bigger missions, and repeat. As a complete beginner, though, I wanted tutorials. Counterintuitively, these are hidden under “Activities”; finding them took quite a while.

The tutorials cover basic instrument identification, controls, takeoffs, and landings. Fixed-wing training uses a Cessna 172, whose cockpit is impressively realistic and immersive. But playing on a keyboard is honestly a bit torturous. Rudder control is especially difficult: keeping turns smooth requires endless little taps. The throttle is much the same. Fundamentally, a keyboard's discrete controls are a poor match for equipment requiring continuous adjustment.

![Cessna 172](https://blog-img.774352199.xyz/2025/aa206be1b0d4e56f7ffd42b98471f150.webp)

### Thrustmaster TCA Captain Pack Airbus Edition

How do we resolve that mismatch? With analog controls, of course. A gamepad is the simplest option, but its limited buttons mean you still need a keyboard in some situations.

The more advanced and realistic option is a dedicated flight stick, reproducing the feel and operation of real controls and improving realism **when flying the corresponding aircraft type**. Broadly, flight controls come in Airbus and Boeing styles. Airbus uses the stick you would imagine—literally a stick—while Boeing uses a steering-wheel-shaped yoke.

After several rounds of comparison on Taobao and JD, I chose Thrustmaster's TCA Captain Pack Airbus Edition. A little expensive at RMB 1,800. SF Express was efficient: it arrived the next day.

![Stick, throttle, and flap controls](https://blog-img.774352199.xyz/2025/9962f3f424062f81391112987de19b60.jpg)

The equipment is small, but the boxes were huge. The two items shipped separately, and the two enormous boxes almost blocked my door. Overpackaged or not, the protection was certainly maxed out.

Setup is simple. The stick is plug-and-play. Assemble the throttle and flap controls, connect them to the computer, and install a [driver](https://support.thrustmaster.com/zh/product/tca-captain-pack-x-airbus-ed-zh/) from Thrustmaster's website. The game recognizes them on launch afterward.

Check the button mappings in the game's settings. One useful trick is to find an action by its keyboard binding first, then locate the corresponding joystick binding. Most mappings are intuitive. So far I have only changed trim: by default, adjusting trim requires holding button7 and moving the small stick on top, which takes both hands and is awkward. The top stick normally moves the camera, unnecessary when using a mouse or VR, so I remapped it directly to trim.

### PICO, you little...

Whether racing, trucking, or flying, VR is hard to avoid discussing. I happened to own a Pico 4 Pro, so I decided to experiment.

I started with Pico's own Pico Connect. The results were underwhelming, launching it was cumbersome, and there were various bugs. One obvious problem: if MSFS2024 had not entered VR mode when Pico Connect connected, VR controller clicks stopped working. Even after leaving VR, the game no longer responded to mouse clicks; it had to be restarted. A simple workaround was to enter VR mode in MSFS2024 using the mouse before connecting the headset, then connect Pico Connect and SteamVR.

In short, a hassle.

Some Googling pointed to Virtual Desktop. Good news: it works on Pico and can be downloaded from the Pico store. Bad news: it is absent from the Chinese store, and my Pico is a China-market model.

More browsing and various complete and incomplete solutions led to the ultimate fix: flash the international firmware. Download the ROM [here](https://pico.crx.moe/docs/picoos-research/version-table), create a dload folder under internal storage, and put the ROM archive there. Choose local upgrade in General Settings. After the update, you have international firmware.

International firmware naturally needs an international account. I suggest registering on your phone and simply signing in on the Pico. Download the international Pico app from [APKPure](https://apkpure.com/pico-vr/com.picovr.assistantphone.global). In my testing, Virtual Desktop still did not appear in the headset store's search. Buy it in the phone app, then download it from your purchase history in the headset's store.

For Virtual Desktop's OpenXR setting, I recommend choosing VD's own environment to bypass SteamVR for a better experience.

### Afterword

Setting all this up took an entire weekend. After flying two short routes, I somehow came down with a fever and ended up in bed.
