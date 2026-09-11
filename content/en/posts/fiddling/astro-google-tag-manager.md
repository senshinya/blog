---
authorship: human-only
title: "Adding Google Analytics to Astro with Tag Manager"
description: "After moving my blog to Astro, the usual Google Analytics integration no longer fit its performance goals. Adding event-reporting JavaScript directly to the head works, but hurts page performance. I used partytown to move the scripts off the main thread so they would not interfere with loading. With a few adjustments to the example code, Google Analytics finally worked, balancing performance with analytics."
date: 2025-05-28 22:09:00
categories: [fiddling]
tags: ["Astro","Google Analytics","Google Tag Manager","Partytown","Web analytics"]
image: "https://blog-img.774352199.xyz/Q0w4RN.webp"
seoDescription: "I fixed missing Google Analytics events in Astro with Partytown by defining window.gtag, setting script attributes, and adding gtag to the forward array."
---

### Introduction

Skip straight to the solution if you would rather avoid the rambling.

I had always used Google Analytics to check my blog traffic and analyze things like referrers. Static blog frameworks such as Hexo and Hugo make integration easy: just add some JavaScript to the head. I recently moved the blog to Astro. The old approach still works—execute JavaScript in the head to report events—but it comes at a performance cost. As everyone knows, Astro aims for the best possible frontend performance and as close to zero JavaScript execution as possible. Reporting events with JavaScript takes a bite out of that.

![A perfect performance score!](https://blog-img.774352199.xyz/2025/e1e778992ea6b393ed763a8642db3770.png)

After some searching, most tutorials recommended partytown to run scripts off the main thread, keeping loading unblocked and performance intact. They all included example code, so I adapted one for my blog. Here was the result:

![](https://blog-img.774352199.xyz/2025/e5005b9f2321f6946761eef52156e777.png)

Reported traffic dropped straight to zero.

I could barely believe it. A long debugging session followed, but I never found the cause. Every relevant example I could find online used the same approach as mine. Honestly, do these people ever test their tutorials? None of this worked.

I had to leave it alone for two months and temporarily switch to umami for analytics.

It came back to mind over the last couple of days, and I could not let it go. Another long search finally turned up a solution in an obscure [corner of GitHub](https://github.com/QwikDev/partytown/issues/382#issuecomment-1667675238).

### Solution

Install `@astrojs/partytown` with your package manager.

Add the following code to `<head>`.

```html
<script is:inline src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXX" type="text/partytown"></script>
<script is:inline type="text/partytown">
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
        dataLayer.push(arguments);
    };
  window.gtag('js', new Date());
  window.gtag('config', 'G-XXXXXXXXX');
</script>
```

A few things to keep in mind:
- `is:inline` indicates that the script runs on the client.
- `type="text/partytown"` tells partytown to execute the script off the main thread.
- `gtag` must be assigned as a function variable on the window object, rather than defined with a function declaration. Strange, I know.

Add the following to your Astro configuration file, usually `astro.config.ts` or `astro.config.mjs`.

```js
import partytown from '@astrojs/partytown'

export default defineConfig({
  // ...
  integrations: [partytown({ config: { forward: ['dataLayer.push', 'gtag'] } })],
});
```

Most tutorials leave out the fact that `gtag` also needs to go in the forward array.

Done! Once committed and deployed, Google Analytics can report statistics normally again.
