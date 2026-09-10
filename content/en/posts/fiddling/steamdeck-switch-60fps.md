---
title: "A Second Life for the Steam Deck: Switch Emulation and Frame Generation at 60 FPS"
description: "This counts as NTR too, surely."
date: 2026-09-09 23:59:00
categories: [fiddling]
tags: ["Steam Deck", "Switch", "EmuDeck", "Eden", "Lossless Scaling"]
---

### Introduction

I've been planning a trip for the National Day holiday and have already spent quite a bit, so I thought I'd sell some unused stuff to recoup a little money. While taking stock, I dug out the Hong Kong Steam Deck I'd imported a while back. I'd paid over 4,000 yuan for it, and the buyback service 爱回收 quoted over 3,000. Tempting enough that I booked a pickup.

While waiting, I plugged it in to reset the system and wipe my data. The more I used it, the more comfortable it felt. Looking at this machine in pristine condition, which I'd barely played since buying it, I suddenly felt bad about letting it go. After some thought, I canceled the pickup. Lately I've had less and less desire to sit at my computer for an hour or two of gaming. I've lost patience with sprawling, narrative-heavy games, and the desk and chair in my rented place have been putting my shoulders, neck, lower back, hips, and legs through quite an ordeal. (Age catches up with you. Three or four years ago, I could still sit on a hard stool playing Genshin Impact until four in the morning.) I decided to return to games that take less mental effort, something I can pick up and put down whenever I like. The Steam Deck fits the bill.

So I updated the system and redownloaded P5R and Civilization VII, both games I'd bought and never found time to play. While browsing YouTube for game recommendations, I came across a video about installing a Switch emulator on the Steam Deck. From the overview, the setup seemed quite mature. With some upscaling and frame-generation mods, most games could apparently even hold a steady 60 FPS, giving you a better experience than on the Switch. I was sold, so I went through the setup myself. Some of the instructions had aged, and I hit a few snags along the way.

Here's the YouTube video:

::video-embed{type="youtube" id="WZ8UunuMLqc"}
::

### Installing EmuDeck

::alert{type="tip"}
Carry out all the steps below on the Steam Deck itself. All software should be installed on the Steam Deck.
::

First, install EmuDeck to manage the emulators on your Steam Deck and import emulated games into Steam so you can launch them from there.

::link-card{link="https://www.emudeck.com" title="EmuDeck"}
::

Scroll to the bottom of the page and download the SteamOS version.

If you download it using Firefox on the Steam Deck, the file will have an extra `.download` extension, such as `EmuDeck.desktop.download`. Rename it to remove the `.download` extension.

Double-click to launch it. A terminal will open and start downloading, followed by the setup process once the download finishes.

1. Select Custom Mode.
2. ROM Directory is where you'll store your game ROMs later. If you don't have an external SD card, select Internal Storage.
3. For Device, select Steam Deck.
4. Set Level of Integration to Highest. We need Steam Rom Manager.
5. Uncheck everything under Emulators and tools for Steam Deck.
6. Under Emulator and Tools Configuration, leave only EmulationStation DE checked.
7. Configure Controller Layout handles button mappings. Choose whichever layout you prefer; you can change it later.

After making these selections, continue to the next step. You'll see a Sonic screen while the selected components download and install in the background. Once that finishes, you'll reach Post Installation, where you configure ROMs and firmware. Since we haven't downloaded any emulators yet, you can skip this step.

Next, launch EmuDeck from the desktop or application menu. Find Steam Rom Manager under Manage Emulators. If Update Configuration is available, run it, then run Reset Configuration. Go back, open EmulationStation-DE, click Install, and run Reset Configuration again.

Launch Steam ROM Manager from EmuDeck's left-hand menu. Check that the background shows the Steam Deck design. Select your account under Choose, click Save, then Next.

### Installing Eden and Importing Games

Find the latest release on Eden's Git release page and download the Steam Deck PGO AppImage.

::link-card{link="https://git.eden-emu.dev/eden-emu/eden/releases" title="Eden Releases"}
::

Rename the downloaded file to `Eden.AppImage` and move it into `Home/Application`.

Double-click to launch it. You'll get a message about missing keys. Click No to skip installing them for now.

The emulator requires a physical Switch console to extract the keys and firmware for import. If you don't have one...

Well... I'll leave a website here for you to look into yourself.

::link-card{link="https://prodkeys.net/" title="prodkeys.net"}
::

Once you have the keys and firmware, extract the keys and keep the firmware as a ZIP archive. Go to Eden - Tools - Install Decryption Keys and select the extracted keys folder to install them. Then go to Eden - Tools - Install Firmware - From ZIP and select the firmware archive.

You can now import game ROMs. Eden supports ROMs in xci and nsp formats. You should obtain your game ROMs from a physical Switch console. If you still don't have one...

Well... here's another website for you to look into yourself.

::link-card{link="https://nswpedia.com/" title="nswpedia.com"}
::

Move your ROMs into `Home/Emulation/roms/switch`. Put the base games in the root of that folder. I suggest creating an Update folder for DLC and update packages.

In Eden, double-click the add-folder icon and select `Home/Emulation/roms/switch`. It will scan all the base games, updates, and DLC.

### Connecting Eden to EmuDeck

With Eden installed, we need EmuDeck to recognize it. Open Steam ROM Manager from EmuDeck, go to Settings, and set Select Theme to Classic. Find `Nintendo Switch - Eden` in the left-hand menu. The Executable field on the right contains a default path; change it to the Eden.AppImage in Application. The displayed value should be `/home/deck/Applications/Eden.AppImage`. Save, then return to Settings and change Theme back to EmuDeck.

Click Parsers in the bottom-right corner. Turn off all the parsers, then enable Eden alone. Click Add Games, and you'll see the games you added to Eden. There's one snag: DLC and updates also show up as separate entries. Click Exclude Games in the bottom-right corner and gray out all DLC and updates, leaving only the base games highlighted, then click Save Excludes. Click Save to Steam and wait until `Done adding/removing entries` appears in the top-right corner.

Return to Steam Gaming Mode, and you'll find the games in the Non-Steam section of your Steam library, grouped into their own Collection. Before playing, though, configure the button mappings and install the gyroscope driver.

::pic{src="https://blog-img.774352199.xyz/xo23fk.jpeg" width="1280" height="800"}
::

### Configuring Buttons and the Gyroscope

Return to Desktop Mode, launch EmuDeck, and click Gyroscope - Install in the left-hand menu to install the gyroscope driver.

Once that's done, return to Steam Gaming Mode and launch Emulation Station from your library. Select Emulators Various, then Eden to launch it.

::folding{title="If Eden is missing from Emulators Various, or Emulators Various itself is missing, follow these steps"}
1. Return to Desktop Mode.
2. Select Eden, then Reset Configuration.
3. Select ES-DE, then Reset Configuration.
4. Restart the Steam Deck.
::

In Eden, go to Emulation - Configure - Controls. Make sure Controller is set to Pro Controller and Input Device to Steam Virtual Gamepad 0.

Under Face Button, you can configure the XYAB button mappings. My suggestion is to keep AB mapped to AB and map XY to YX, though it comes down to personal preference.

Motion 1 configures the gyroscope. Click until it shows `Shake!`, then shake the Steam Deck so Eden can detect the gyroscope driver. Now rotate the Steam Deck. If the cube at the top center of the on-screen Pro Controller rotates along with it, the gyroscope is working.

Click OK to save your configuration.

### Frame Generation with the Little Yellow Duck

At this point, most games will run at around 30 FPS. That frame rate feels rough on the Steam Deck: the picture stutters and the controls feel sluggish.

Time to bring in the famous little yellow duck, Lossless Scaling, for frame generation. Lossless Scaling can't run natively on the Steam Deck, so it takes a few extra steps.

::alert{type="info"}
Before any of this, you need to buy Lossless Scaling and install the lsfg-vk version.
::

First, install Decky Loader. Download and run it in Desktop Mode to complete the installation.

::github{repo="SteamDeckHomebrew/decky-loader"}
::

Once installed, switch to Steam Gaming Mode and press the QAM button (the ... button at the bottom right). You'll see a Decky menu at the bottom of the sidebar.

Next, install Decky LSFG-VK by downloading the ZIP from Releases. I recommend the Pre-release version.

::github{repo="xXJSONDeruloXx/decky-lsfg-vk"}
::

In the Decky menu, open Settings - General and enable Developer Mode. Then use the developer menu's Install Plugin from ZIP File option and select the Decky LSFG-VK archive to install it.

Open the LSFG-VK menu in Decky. Click the + next to FPS Multiplier until it reaches 2X, and enable Present Mode. If you can't reach 60 FPS later, you can enable Performance Mode. It uses a faster model, at the cost of ghosting when you move the camera. Finally, click Copy Launch Option.

For each game that needs frame generation (which is pretty much every Switch game), open its menu - Properties - Shortcut - Launch Options. Paste what you copied after `vblank_mode=0`, then delete the duplicate `%command%`. The final launch options should look like this: `vblank_mode=0 ~/lsfg %command% -f -g ...`.

Since Lossless Scaling only works with Vulkan, you'll also need to switch Eden to Vulkan. Launch Eden through Emulation Station, open Emulation - Configure - Graphics, set API to Vulkan and VSync Mode to Mailbox, then click OK to save.

Everything is ready. Launch a game, and after a brief period of fluctuation, the frame rate should settle at around 60 FPS.

Enjoy

::pic{src="https://blog-img.774352199.xyz/FeC82s.jpeg" width="1280" height="800" caption="I wanted a screenshot with the performance overlay, but the default screenshot function hides overlays."}
::
