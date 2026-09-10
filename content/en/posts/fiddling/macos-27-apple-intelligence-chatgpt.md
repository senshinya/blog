---
authorship: ai-human-reviewed
title: "Getting Apple Intelligence Working on a China-Market Mac: Region Changes and Extracting ChatGPT"
description: "Another WWDC brings new Apple Intelligence features in macOS 27. The workarounds from macOS 26 no longer get through, so the battle of wits with Apple continues."
date: 2026-06-11 10:00:00
categories: [fiddling]
tags: ["Tinkering", "macOS", "Apple Intelligence", "ChatGPT"]
---

Another annual tech extravaganza, WWDC, and macOS 27 arrived on schedule. Skins changed, version numbers increased, but its biggest upgrade, Apple Intelligence, remains unavailable on China-market devices. Another update for everywhere around mainland China, and we remain second-class citizens.

Last year's [macOS 26](/en/fiddling/macos-26-trial) did not bother me much. This year, with the machine already in my hands, I decided to tinker. It is a China-market MacBook Air M5 running macOS 27 (26A5353q). The process has two parts: enabling Apple Intelligence with a kernel extension, then enabling the ChatGPT extension, whose own geofencing is much stricter than Apple Intelligence's general regional controls.

## How it works

Apple Intelligence's overall regional restrictions can be reduced to this:

```
MGGetStringAnswer("RegionCode") == "CH"  →  Apple 智能关闭
```

`RegionCode` is read in real time from the `region-info` property of `IOPlatformExpertDevice` in IORegistry. On China-market machines it is `CH/A`. In macOS 27, `eligibilityd` recalculates eligibility in real time using SwiftData, so the old plist-editing and `uchg`-locking tricks no longer work. Changes disappear on reboot.

The fundamental fix is to change `region-info` at the IORegistry level. That is how GitHub's [RegionSpoof](https://github.com/SkyBlue997/enableMacosAI) works: load a kext matching `IOPlatformExpertDevice`, then in `start()` set `region-info` to `LL/A` (US) and `country-of-origin` to `USA`. Every process reads the US region directly at the source. Eligibility, model delivery, and the frontend UI all become available without injecting into each process separately.

::github{repo="SkyBlue997/enableMacosAI"}
::

The approach is simple and thorough, but requires loading a kernel extension. That means disabling SIP.

## SIP is unavoidable

Loading a third-party kext on Apple Silicon requires disabling System Integrity Protection (SIP), switching to Permissive security mode, and allowing third-party kernel extensions. This requires Recovery mode.

Shut down, hold the power button to enter Recovery, open Terminal, and run:

```bash
csrutil disable
```

Reboot into the system, then run this in the project directory:

```bash
sudo ./install.sh
```

The script checks SIP and Apple Silicon status, installs the kext, configures a LaunchDaemon for startup, and refreshes the Apple Intelligence daemons. macOS blocks the first kext load; allow it under System Settings → Privacy & Security, then reboot.

There is a trap here:

::alert{type="warning" title="Do not disable AMFI along the way"}
Many guides tell you to add the `amfi_get_out_of_my_way=1` boot argument when disabling SIP. With AMFI disabled, the SEP refuses to provide hardware attestation for Private Cloud Compute. Cloud AI becomes unavailable, leaving only on-device features. Tone rewriting, Image Playground, and other PCC-dependent features will not work.
::

After installation, check and verify the status with:

```bash
sudo ./install.sh status     # SIP / AMFI / region / kext / 资格 一览
ioreg -ard1 -c IOPlatformExpertDevice | plutil -p - | grep region-info   # 应为 0x4c4c2f41 即 "LL/A"
```

`region-info` should be `LL/A`, and eligibility domain GREYMATTER should be 4 (eligible). Reboot and open Settings: Apple Intelligence options appear, and Writing Tools, Genmoji, Image Playground, and Foundation Models all work normally.

Perfect!

## The ChatGPT extension

The problem was Siri's ChatGPT extension. Siri settings should show a ChatGPT extension toggle and allow account sign-in. Siri also displayed “Apple Intelligence support for ChatGPT is still downloading.”

At first I assumed the download really was stuck. Capturing `generativeexperiencesd` logs revealed that downloading was not the issue at all: the provider below had been marked hidden.

```
Retrieved provider status for ChatGPT: .forciblyHidden, info:
  partnerNotSelected,
  useCaseDoesNotAllowCurrentIPCountryCode,
  useCaseDoesNotAllowUserLocaleRegion
```

There are three reasons. `partnerNotSelected` is a consequence of the missing toggle, so set that aside. The real problems are the other two: the current IP country code and the system region do not qualify.

Interesting. The kext had already changed the device to the US region, and `RegionCode` was US. But the ChatGPT extension does not read the device's `RegionCode`; it uses `countryd`'s real-time estimate of the country you are physically in.

## Dealing with countryd

I connected a Japanese proxy node and confirmed that my exit IP was Japanese. Even Apple's own GeoIP endpoint returned JP:

```bash
curl -s https://gspe1-ssl.ls.apple.com/pep/gcc   # 返回 JP
```

In principle, this should lift the restriction. But after restarting `generativeexperiencesd` to reevaluate, `isDisabled` remained `true`. Examining `countryd` revealed a surprisingly complicated mechanism.

`countryd` determines the country using this priority order:

```
WiFiAP (优先级 1)  >  Location 定位 (优先级 4)  >  GeoIP (优先级 5)
```

The proxy only affects IP, the lowest-priority GeoIP source. Higher-priority sources include Wi-Fi access-point positioning and coordinates from Location Services. Both located me in mainland China.

Location Services was easy: disable it and the `LatLonLocation` signal disappears. The locale was easy too: change the region from mainland China to Japan in System Settings. `AppleLocale` changes from `zh_CN` to `zh-Hans_JP`, satisfying `useCaseDoesNotAllowUserLocaleRegion`.

Wi-Fi was trickier. I assumed switching to a phone hotspot would work: surely its BSSID would not be in Apple's location database. I connected and captured logs. Initially, things looked as expected:

```
21:49:42  "WiFi AP update", "countryCode":""     ← 热点本身查不到国家，是空的
21:49:51  "WiFi AP update", "countryCode":"CN"   ← 9 秒后又变回 CN
```

The hotspot's own BSSID returned nothing. Nine seconds later, however, the country was CN again. Apple's Wi-Fi positioning does not just inspect the access point you are connected to; it scans **all** nearby Wi-Fi signals. I was on my hotspot, but my home router, my neighbors' routers, and those throughout the building still located me in China.

As long as Wi-Fi is on, the hotspot you connect to makes no difference. Nearby Chinese access points keep giving you away.

~~Only Apple Can Do~~

## Turning off Wi-Fi

Disable Wi-Fi and use a wired connection, and `countryd` loses all physical location signals, leaving GeoIP as its only source.

I used iPhone USB tethering plus a global Japanese proxy on the Mac, keeping Wi-Fi off. Checking `countryd` again, GeoIP finally showed Japan:

```
"CACHE: Geo IP country code changing", "from":"CN", "to":"JP, priority = 5 (GeoIP)"
```

But the overall estimate was still CN. Investigation showed that turning Wi-Fi off does not send a “clear” event. `countryd` caches its last `WiFiAP=CN` result on disk and reloads it on every restart. Since it has the highest priority, GeoIP still cannot win.

Then delete the cache:

```bash
sudo plutil -p /var/db/com.apple.countryd/countryCodeCache.plist
```

Stop the service, remove the cache, and restart `countryd` with Wi-Fi off:

```bash
sudo launchctl bootout system/com.apple.countryd
sudo rm -f /var/db/com.apple.countryd/countryCodeCache.plist   # [!code highlight]
sudo launchctl bootstrap system /System/Library/LaunchDaemons/com.apple.countryd.plist
```

At last, `countryd`'s country became Japan. ChatGPT's `forciblyHidden` state cleared, and the extension toggle appeared in Settings.

Finally!

Once the toggle appears, enable ChatGPT. If you have a Plus or Pro account, you can sign in.

::alert{type="tip"}
Once the ChatGPT extension has been enabled once, it remains usable even after restoring Wi-Fi and your previous region settings.
::
