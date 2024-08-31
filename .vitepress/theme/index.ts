// https://vitepress.dev/guide/custom-theme
import { watch } from 'vue'
import type { Theme } from 'vitepress'
import { EnhanceAppContext } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import layout from './layout.vue'
import VueCalendarHeatmap from 'vue3-calendar-heatmap'

import '@nolebase/vitepress-plugin-enhanced-mark/client/style.css'
import './styles/index.scss'

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
  extends: DefaultTheme,
  Layout: layout,

  enhanceApp({ app, router }: EnhanceAppContext) {
    if (typeof window !== 'undefined') {
      watch(
        () => router.route.data.relativePath,
        () => updateHomePageStyle(location.pathname === '/'),
        { immediate: true }
      )
    }
    app.use(VueCalendarHeatmap);
  }

  // Layout: () => {
  //   return h(DefaultTheme.Layout, null, {
  //     // https://vitepress.dev/guide/extending-default-theme#layout-slots
  //   })
  // },
  // enhanceApp({ app, router, siteData }) {
  //   // ...
  // }
} satisfies Theme

if (typeof window !== 'undefined') {
  // detect browser, add to class for conditional styling
  const browser = navigator.userAgent.toLowerCase()
  if (browser.includes('chrome')) {
    document.documentElement.classList.add('browser-chrome')
  } else if (browser.includes('firefox')) {
    document.documentElement.classList.add('browser-firefox')
  } else if (browser.includes('safari')) {
    document.documentElement.classList.add('browser-safari')
  }
}

let homePageStyle: HTMLStyleElement | undefined

// Speed up the rainbow animation on home page
function updateHomePageStyle(value: boolean) {
  if (value) {
    if (homePageStyle) return

    homePageStyle = document.createElement('style')
    homePageStyle.innerHTML = `
    :root {
      animation: rainbow 12s linear infinite;
    }`
    // console.log(homePageStyle);
    document.body.appendChild(homePageStyle)
  } else {
    // console.log(111);
    if (!homePageStyle) return

    homePageStyle.remove()
    homePageStyle = undefined
  }
}