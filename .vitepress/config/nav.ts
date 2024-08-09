import type { DefaultTheme } from 'vitepress'

export const nav: DefaultTheme.NavItem[] = [
  {
    text: '项目',
    activeMatch: '^/projects',
    items: [
      {
        text: '学无止境',
        items: [
          { text: 'MYDB', link: '/projects/mydb' },
        ]
      },
    ]
  },
  {
    text: '笔记',
    activeMatch: '^/notes',
    items: [
      {
        text: '学无止境',
        items: [
          { text: '6.5840', link: '/notes/6.5840' },
        ]
      },
    ]
  },
  {
    text: '折腾',
    link: '/fiddling',
    activeMatch: '^/fiddling'
  },
  {
    text: '日常',
    link: '/daily',
    activeMatch: '^/daily'
  },
  {
    text: '碎碎念',
    link: '/balabala',
    activeMatch: '^/balabala'
  },
  {
    text: '关于我',
    link: '/shinya',
  }
]