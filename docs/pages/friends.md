---
title: 朋友们
hidden: true
comment: false
sidebar: false
aside: false
readingTime: false
showMeta: false
---

<script setup>
import { VPTeamMembers } from 'vitepress/theme'

const blog_svg = '<svg version="1.1" id="_x32_" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"   width="800px" height="800px" viewBox="0 0 512 512" xml:space="preserve"><g> <path class="st0" d="M421.073,221.719c-0.578,11.719-9.469,26.188-23.797,40.094v183.25c-0.016,4.719-1.875,8.719-5.016,11.844 c-3.156,3.063-7.25,4.875-12.063,4.906H81.558c-4.781-0.031-8.891-1.844-12.047-4.906c-3.141-3.125-4.984-7.125-5-11.844V152.219 c0.016-4.703,1.859-8.719,5-11.844c3.156-3.063,7.266-4.875,12.047-4.906h158.609c12.828-16.844,27.781-34.094,44.719-49.906 c0.078-0.094,0.141-0.188,0.219-0.281H81.558c-18.75-0.016-35.984,7.531-48.25,19.594c-12.328,12.063-20.016,28.938-20,47.344 v292.844c-0.016,18.406,7.672,35.313,20,47.344C45.573,504.469,62.808,512,81.558,512h298.641c18.781,0,36.016-7.531,48.281-19.594 c12.297-12.031,20-28.938,19.984-47.344V203.469c0,0-0.125-0.156-0.328-0.313C440.37,209.813,431.323,216.156,421.073,221.719z"/> <path class="st0" d="M498.058,0c0,0-15.688,23.438-118.156,58.109C275.417,93.469,211.104,237.313,211.104,237.313 c-15.484,29.469-76.688,151.906-76.688,151.906c-16.859,31.625,14.031,50.313,32.156,17.656 c34.734-62.688,57.156-119.969,109.969-121.594c77.047-2.375,129.734-69.656,113.156-66.531c-21.813,9.5-69.906,0.719-41.578-3.656 c68-5.453,109.906-56.563,96.25-60.031c-24.109,9.281-46.594,0.469-51-2.188C513.386,138.281,498.058,0,498.058,0z"/></g></svg>'
const github_svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" xml:space="preserve"><path class="st0" d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>'

const members = [
  {
    avatar: 'https://blog-img.shinya.click/2024/5e107c1356d8cd90f1b98d170368c2df.jpg',
    name: 'Oliver Chen',
    title: '互联网新星',
    links: [
      { icon: { svg: github_svg}, link: 'https://github.com/oliverchen12' },
      { icon: { svg: blog_svg }, link: 'https://oliverchen12.github.io' }
    ]
  },
  {
    avatar: 'https://blog-img.shinya.click/2024/a63e3e016fdaf653fde08969916830eb.JPG',
    name: 'Sun Yushuo',
    title: '风雨湿征衣',
    links: [
      { icon: { svg: github_svg}, link: 'https://github.com/yyd-piren' },
      { icon: { svg: blog_svg }, link: 'https://yyd-piren.github.io/' }
    ]
  },
  {
    avatar: 'https://blog-img.shinya.click/2024/9387729ab1b3f7f1c9a7c644d306c851.PNG',
    name: '子行',
    title: '往日痕迹',
    links: [
      { icon: { svg: github_svg}, link: 'https://github.com/fallintodust' },
      { icon: { svg: blog_svg }, link: 'https://www.cnblogs.com/fallingdust ' }
    ]
  }
]
</script>

<style>
.st0 {
  fill: var(--vp-c-text-1)
}
</style>

::: tip 申请友链
先将本站加入友链，然后在前往[此表单](https://github.com/senshinya/blog/issues/new?assignees=senshinya&labels=&projects=&template=apply-friend-link.yml&title=%E7%94%B3%E8%AF%B7%E5%8F%8B%E9%93%BE%3A+)填写对应信息，提交即可
:::

<VPTeamMembers size="small" :members="members" />