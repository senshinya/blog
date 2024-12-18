import type { DefaultTheme } from 'vitepress'

export const nav: DefaultTheme.NavItem[] = [
  {
    text: '项目',
    activeMatch: '^/projects',
    items: [
      {
        items: [
          { text: 'MYDB', link: '/projects/mydb/mydb0' },
        ]
      },
    ]
  },
  {
    text: '笔记',
    activeMatch: '^/notes',
    items: [
      {
        items: [
          { text: '6.5840', link: '/notes/6.5840/mapreducepaper' },
          { text: '系统架构设计师', link: '/notes/system_architect/knowledge/knowledge1' },
        ]
      },
    ]
  },
  {
    text: '折腾',
    link: '/fiddling/more-accurate-chnroute',
    activeMatch: '^/fiddling'
  },
  {
    text: '生活',
    link: '/daily/work-for-3-years',
    activeMatch: '^/daily'
  },
  {
    text: '碎碎念',
    link: '/balabala',
    activeMatch: '^/balabala'
  },
  {
    text: '归档',
    link: '/archive',
  },
  {
    text: '朋友们',
    link: '/friends',
  },
  {
    text: '关于我',
    link: '/shinya',
  }
]