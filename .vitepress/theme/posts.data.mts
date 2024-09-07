import { createContentLoader } from 'vitepress'

interface Post {
  title: string
  url: string
  category: string
  date: {
    time: number
    string: string
  }
}

export declare const data: Post[]

export default createContentLoader('posts/**/*.md', {
  transform(raw): Post[] {
    return raw
      .filter(item => 'date' in item.frontmatter)
      .map(({ url, frontmatter }) => ({
        title: frontmatter.title,
        url: url.replace('/posts', ''),
        category: frontmatter.category,
        date: formatDate(frontmatter.date)
      }))
      .sort((a, b) => b.date.time - a.date.time)
  }
})

function formatDate(raw: string): Post['date'] {
  const date = new Date(raw)
  // date.setUTCHours(12)
  return {
    time: +date,
    string: raw,
  }
}