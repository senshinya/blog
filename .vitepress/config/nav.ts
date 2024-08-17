import type { DefaultTheme } from 'vitepress'

export const nav: DefaultTheme.NavItem[] = [
  {
    text: '项目',
    activeMatch: '^/projects',
    items: [
      {
        text: '学无止境',
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
        text: '学无止境',
        items: [
          { text: '6.5840', link: '/notes/6.5840/mapreducepaper' },
          { text: '系统架构设计师', link: '/notes/system_architect/knowledge/knowledge1' },
        ]
      },
    ]
  },
  {
    text: '折腾',
    link: '/fiddling/fake-ip-based-transparent-proxy',
    activeMatch: '^/fiddling'
  },
  {
    text: '日常',
    link: '/daily/plan2024',
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