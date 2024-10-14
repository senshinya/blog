<!-- .vitepress/theme/Layout.vue -->

<script setup lang="ts">
import { useData, useRoute } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { nextTick, provide } from 'vue'
import comment from './components/comment.vue'
import navVistor from './components/navVisitor.vue'
import imageViewer from './components/imageViewer.vue'
import postFooter from './components/postFooter.vue'
import postCopyright from './components/postCopyright.vue'
import docTitle from './components/docTitle.vue'
import codeblocksFold from 'vitepress-plugin-codeblocks-fold'
import {  
  NolebaseHighlightTargetedHeading,  
} from '@nolebase/vitepress-plugin-highlight-targeted-heading/client'
import { SpeedInsights } from '@vercel/speed-insights/vue';
import { inject } from '@vercel/analytics';
import '@nolebase/vitepress-plugin-highlight-targeted-heading/client/style.css'
import 'vitepress-plugin-codeblocks-fold/style/index.css'

const { isDark, frontmatter } = useData()
const route = useRoute()

var customClass: string = ''
if (frontmatter.value?.layoutClass) {
  customClass = frontmatter.value.layoutClass
}

codeblocksFold({ route, frontmatter }, true, 400);

const enableTransitions = () =>
  'startViewTransition' in document &&
  window.matchMedia('(prefers-reduced-motion: no-preference)').matches

provide('toggle-appearance', async ({ clientX: x, clientY: y }: MouseEvent) => {
  if (!enableTransitions()) {
    isDark.value = !isDark.value
    return
  }

  const clipPath = [
    `circle(0px at ${x}px ${y}px)`,
    `circle(${Math.hypot(
      Math.max(x, innerWidth - x),
      Math.max(y, innerHeight - y)
    )}px at ${x}px ${y}px)`
  ]

  await document.startViewTransition(async () => {
    isDark.value = !isDark.value
    await nextTick()
  }).ready

  document.documentElement.animate(
    { clipPath: isDark.value ? clipPath.reverse() : clipPath },
    {
      duration: 300,
      easing: 'ease-in',
      pseudoElement: `::view-transition-${isDark.value ? 'old' : 'new'}(root)`
    }
  )
})

inject();
</script>

<template>
  <div :class="customClass">
  <DefaultTheme.Layout>
    <template #nav-bar-title-after>
      <navVistor />
    </template>
    <template #doc-after>
      <comment />
      <postFooter />
    </template>
    <template #doc-bottom>
      <imageViewer />
    </template>
    <template #doc-footer-before>
      <ClientOnly><postCopyright /></ClientOnly>
    </template>
    <template #doc-before>
      <ClientOnly><docTitle /></ClientOnly>
    </template>
    <template #layout-top>
      <ClientOnly><NolebaseHighlightTargetedHeading /></ClientOnly>
    </template>
  </DefaultTheme.Layout>
  </div>
  <ClientOnly><SpeedInsights /></ClientOnly>
</template>

<style>
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}

::view-transition-old(root),
.dark::view-transition-new(root) {
  z-index: 1;
}

::view-transition-new(root),
.dark::view-transition-old(root) {
  z-index: 9999;
}

.VPSwitchAppearance {
  width: 22px !important;
}

.VPSwitchAppearance .check {
  transform: none !important;
}
</style>