---
title: 一加7pro：真全面屏的绝唱
tags: ["一加7pro","全面屏","玩机","类原生"]
category: 折腾
date: 2025-02-22T17:21:00+08:00
---
# 一加7pro：真全面屏的绝唱

### 前言

我的第一部手机是高中毕业的暑假购买的 Vivo X9Plus，中规中矩的三大金刚键。那时候对各种手机的参数一无所知，对安卓苹果的了解也十分模糊，只知道要买一部可以安装 apk 的手机~~，因为网上找到的大部分安装包都是 apk 格式的~~。

大一刚开学，小米发布的 MIX2 作为"全球首款全面屏手机小米 MIX"的继任者。这部手机当时给我的惊艳感，现在已经很难描述出来了，只知道，我当时以 1500 的生活费，四处借钱省吃俭用凑出了 3299 入了首发，为此吃了很长时间的泡面。 ![泡面盖](https://blog-img.shinya.click/2025/fbbbef4b1e0edd821accb0f25694f59f.jpeg " =600x800")

而后就是全面屏彻底铺开，从 MIX2 的大下巴，到挖孔屏、水滴屏，再到现在的灵动岛。由于前置摄像头的存在，大部分方案都做了一些妥协，导致全面屏并不那么"全面"。

然而在 2019 年左右，出现过一类方案——升降式摄像头。它将前置摄像头隐藏在机身内，根据需要弹出，最大程度地保证了屏幕的完整性。其中的代表机型为一加 7Pro/7TPro 和红米 K20 系列，这两类机型至今仍有比较活跃的开发社区。可惜的是，这种方案在 2019 年发展到顶峰后日渐式微，升降结构的体积、防水性能等问题，让这个方案隐入了历史。

前几日在某~~转~~二手交易平台上，偶然看到一台成色近乎完美的一加 7Pro，当即心念一动，花 800 收入囊中，也算是圆了当年自己的一个梦想。

从下单，到收货，中间隔了 4 天，心痒难耐。

### 初见

上手的第一时间，就想到了一个词：温润如玉

<many-pictures :srcImgs='op7Imgs' :lazy='false' :config='imgCfg1'/>

玻璃后盖和屏幕触感冰凉，一整块屏幕完美无瑕，视觉冲击力很强，加之曲面屏，使得整部手机浑然天成，宛如艺术品。对比现在越来越厚的大边框手机，恍惚间回到了那个令人怀念的 2019 年。

<BiliVideo bvid="BV1aefHYKE7W" />

有些令我惊讶的是，作为一款 2019 年的机器，竟然没有"极其先进"的 3.5mm 耳机孔。耳机孔被淘汰的这么早吗，还是当年的一加已经走在了科技前沿了？我不知道。

即使以当下的眼光来看，这款手机的配置依然很能打：高通骁龙 855、相机模组 IMX586、90Hz 刷新率 2K 屏，日用基本是没问题的。可惜的是 8GB 内存和 256GB 闪存，应对起安卓平台的毒瘤们可能会有点力不从心，可能需要借助一些科技手段进行压制

### 玩机

作为玩机佬来说，入手一加，不刷机是不可能的。一加最大的优势就是可以随意解锁 bootloader，任意刷入各种 custom ROM 和 Root，可玩性大大提升。

有句老话说得好

> 愿你刷机半生，归来仍是 MIUI

可惜对于一加来说，大氢早已亡了，氧 OS 也早已在 2022 年停止更新，ColorOS 更是万万带不动的，国内的一些其他 UI 移植，如 Flyme、MIUI，也早已断更不再维护。

然而（此时一段铿锵的音乐响起），这台手机在海外仍有非常活跃的社区，CrDroid、EvolutionX 等类原生仍然有其官方维护，甚至比大多数最新款手机更早吃上了去年 9 月刚发布的安卓 15。

综合考虑之下，我还是选择了一款由国内开发者负责维护的 RisingOS，同为基于安卓 15 的系统，开发者集成了 Kernel Su，同时 RisingOS 的 UI 很对我胃口，可自定义的内容也更多。更具体的描述可见[发布帖](https://www.coolapk.com/feed/60253313?shareKey=NTM3NDA5ZDRkZWRhNjdiMmQxY2Y\~&shareUid=2189157&shareFrom=com.coolapk.app_15.0.3)。

<many-pictures :srcImgs='risingOsImgs' :lazy='false' :config='imgCfg'/>

刷机过程不再赘述了。

系统集成了机型欺骗，可以伪装成 Google Pixel XL，以享受 Google Photos 的无限量原画质的备份。Root 后的模块也没有使用很多，除了一些平衡性能功耗、去广告和美化的模块外，主要就是一个伪装机型为 pad 的模块，使得微信和 QQ 可以以平板登录，方便双持。

相机可以使用移植的 Google Camera，XDA 帖子在[这儿](https://xdaforums.com/t/guide-gcam-wichaya-oneplus-7-pro.4324373/)。

<script setup>
const op7Imgs = [
    {
        "link": "https://blog-img.shinya.click/2025/f8bedd5eaee97a477bc3494d778aac1a.jpg"
    },
    {
        "link": "https://blog-img.shinya.click/2025/381f9b978c7949b9a770e75332ce12a2.jpg"
    },
    {
        "link": "https://blog-img.shinya.click/2025/aed95cca0499f4b2332e0b4f43696b53.jpg"
    }
]
const risingOsImgs = [
    {
        "link": "https://blog-img.shinya.click/2025/d79c50563041906691d7e3294a3c583a.png"
    },
    {
        "link": "https://blog-img.shinya.click/2025/95588b8b8ddceea983b4a8ce241b876c.png"
    },
    {
        "link": "https://blog-img.shinya.click/2025/6e95022163e9ab78599033576972aa31.png"
    },
    {
        "link": "https://blog-img.shinya.click/2025/48a1220201c7f010402e33b4f7043543.png"
    },
    {
        "link": "https://blog-img.shinya.click/2025/fe78a9adcf351c68dcb94a81329a1689.png"
    },
    {
        "link": "https://blog-img.shinya.click/2025/ac962ee140ce359c7b2370f2dcbbff03.png"
    },
    {
        "link": "https://blog-img.shinya.click/2025/116755f5013bd4b1d7e6a5a4d27cbbe8.png"
    }
]
const imgCfg1 = {
    "height": 800,
    "noActiveWidth": 50,
    "activeWidth": 400,
    "margin": 5,
    "zIndex": 101
}
const imgCfg = {
    "height": 624,
    "noActiveWidth": 50,
    "activeWidth": 300,
    "margin": 5,
    "zIndex": 101
}
</script>