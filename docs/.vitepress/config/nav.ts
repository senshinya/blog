import fg from 'fast-glob'
import type { DefaultTheme } from 'vitepress'
import matter from 'gray-matter'

function findLatest(path: string) : string {
  let date : number = 0;
  let res : string = '';
  fg.sync(`${path}/*.md`, {
    onlyFiles: true,
    objectMode: true,
    ignore: ['**/index.md']
  }).forEach((article) => {
    const { data } = matter.read(`${article.path}`);
    if (new Date(data.date).getTime() > date) {
      date = new Date(data.date).getTime();
      res = `/${article.path}`.replace('docs/posts/', '')
    }
  })
  return res;
}

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
    link: findLatest('docs/posts/fiddling'),
    activeMatch: '^/fiddling'
  },
  {
    text: '生活',
    link: findLatest('docs/posts/daily'),
    activeMatch: '^/daily'
  },
  {
    text: '碎碎念',
    link: '/balabala',
    activeMatch: '^/balabala'
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