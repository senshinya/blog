---
# https://vitepress.dev/reference/default-theme-home-page
layout: home
layoutClass: 'm-home-layout'

hero:
  name: "信也のブログ"
  tagline: 写代码的
  image:
    src: /bg.png
    alt: background
  actions:
    - theme: brand
      text: 进入博客
      link: /blog
    - theme: alt
      text: 看看 Github
      link: https://github.com/senshinya

features:
  - icon: 🏛️
    title: 项目
    details: 知者行之始，行者知之成<br />穷则默默造轮，达则四处推广
    link: /projects
  - icon: 📖
    title: 笔记
    details: 学而不思则欠拟合，思而不学则过拟合<br />今日不学习，明日变垃圾
    link: /learn
  - icon: 💡
    title: 折腾
    details: 日常穷折腾<br /><br /><small>上班摸鱼首选</small>
    link: /fiddling
  - icon: 🌟
    title: 日常
    details: 我们所经历的每个平凡的日常<br />也许就是连续发生的奇迹
    link: /daily
  - icon: 🧾
    title: 碎碎念
    details: 就当我在扯淡
    link: /balabala
  - icon: 💯
    title: 持心若水，执念如山。
    details: '<small class="bottom-small">喜欢代码，讨厌上班</small>'
    link: /shinya
---

<ClientOnly><Heatmap /></ClientOnly>

<style>
.m-home-layout .details small {
  opacity: 0.8;
}

.m-home-layout .item:last-child .details {
  display: flex;
  justify-content: flex-end;
  align-items: end;
}

@media (min-width: 768px) {
  .VPHome {
    margin-bottom: 50px !important;
  }
}
</style>