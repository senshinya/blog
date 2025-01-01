import type { Theme } from 'vitepress'
import { useData, useRoute } from 'vitepress';
import BlogTheme from '@sugarat/theme'
import VueCalendarHeatmap from 'vue3-calendar-heatmap'
import { h } from 'vue'
import Heatmap from './components/heatmap.vue'
import Memos from './components/memos.vue'

import codeblocksFold from 'vitepress-plugin-codeblocks-fold';
import 'vitepress-plugin-codeblocks-fold/style/index.css'

// import { 
//     NolebaseEnhancedReadabilitiesMenu, 
//     NolebaseEnhancedReadabilitiesScreenMenu,
//     Options, InjectionKey
// } from '@nolebase/vitepress-plugin-enhanced-readabilities/client'
// import '@nolebase/vitepress-plugin-enhanced-readabilities/client/style.css'

import {
  NolebaseHighlightTargetedHeading,
} from '@nolebase/vitepress-plugin-highlight-targeted-heading/client'
import '@nolebase/vitepress-plugin-highlight-targeted-heading/client/style.css'

import '@nolebase/vitepress-plugin-enhanced-mark/client/style.css'

// 自定义样式重载
import './style.scss'

// 自定义主题色
// import './user-theme.css'

if (typeof window !== 'undefined') {
  /* 注销 PWA 服务 */
  if (window.navigator && navigator.serviceWorker) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      for (let registration of registrations) {
        registration.unregister()
      }
    })
  }

  /* 删除浏览器中的缓存 */
  if ('caches' in window) {
    caches.keys().then(function (keyList) {
      return Promise.all(
        keyList.map(function (key) {
          return caches.delete(key)
        })
      )
    })
  }
}

export default {
  extends: BlogTheme,
  enhanceApp({ app }) {
    app.use(VueCalendarHeatmap);
    app.component('Heatmap', Heatmap);
    app.component('Memos', Memos);
    // app.provide(InjectionKey, { 
    //     spotlight: {
    //         defaultToggle: false
    //     }
    // } as Options) 
  },
  Layout() {
    return h(BlogTheme.Layout, null, {
      'home-banner-after': () => h(Heatmap),
      // 为较宽的屏幕的导航栏添加阅读增强菜单
      // 'nav-bar-content-after': () => h(NolebaseEnhancedReadabilitiesMenu),
      // 为较窄的屏幕（通常是小于 iPad Mini）添加阅读增强菜单
      // 'nav-screen-content-after': () => h(NolebaseEnhancedReadabilitiesScreenMenu),
      'layout-top': () => [
        h(NolebaseHighlightTargetedHeading),
      ],
    })
  },
  setup() {
    const { frontmatter } = useData();
    const route = useRoute();
    // basic use
    codeblocksFold({ route, frontmatter });
  }
} satisfies Theme
