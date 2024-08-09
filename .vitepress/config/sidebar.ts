import type { DefaultTheme } from 'vitepress'
import fs from 'fs'
import fg from 'fast-glob'
import matter from 'gray-matter'

const sync = fg.sync;

export const sidebar: DefaultTheme.Sidebar = {
    '/projects/mydb': getItemsByCategory('posts/projects/mydb'),
    '/notes/6.5840': getItemsByCategory('posts/notes/6.5840'),
    '/fiddling': getItemsByDate('posts/fiddling'),
    '/daily': getItemsByDate('posts/daily'),
}

// 定义新类型，继承DefaultTheme.SidebarItem，并增加新字段
export type SidebarItem = DefaultTheme.SidebarItem & {
    date?: string,
    sort?: number
};

function getItemsByDate(path: string) {
    let groups: SidebarItem[] = [];
    // 侧边栏分组数组
    let items: SidebarItem[] = [];
    // 当分组内文章总数显示超过 20 篇时，自动折叠分组
    const titleCollapsedSize = 20;

    // 获取路径下的所有文章
    sync(`${path}/*.md`, {
        onlyFiles: true,
        objectMode: true,
        ignore: ['**/index.md']
    }).forEach((article) => {
        const { data } = matter.read(`${article.path}`);
        // 向前追加标题
        items.push({
            text: data.title,
            link: `/${article.path}`.replace('posts/', ''),
            date: data.date,
            sort: data.sort,
        });
    })

    // 按时间倒序
    sortArticleItems(items, false);

    // 分组
    const yearSet = new Set<number>();
    const articlesByYear = new Map<number, SidebarItem[]>();
    items.forEach((article) => {
        if (article.date !== undefined) {
            // 解析日期，获取年份
            const year = new Date(article.date).getFullYear();
            yearSet.add(year);
            // 根据年份分组文章
            if (!articlesByYear.has(year)) {
                articlesByYear.set(year, []);
            }
            articlesByYear.get(year)?.push(article);
        }
    })

    // 按年份分组得到结果
    const yearList = Array.from(yearSet).sort((a, b) => b - a);
    yearList.forEach(year => {
        const articles = articlesByYear.get(year) || []; // 获取对应年份的文章列表，若不存在则为 []

        groups.push({
            text: `${year.toString()}`,
            items: articles,
            collapsed: articles.length > titleCollapsedSize,
        })
    })

    return groups
}

// 根据 posts/分类/标题.md的目录格式, 获取侧边栏分组及分组下标题
function getItemsByCategory(path: string) {
    let groups: SidebarItem[] = [];
    // 侧边栏分组数组
    let items: SidebarItem[] = [];
    let total = 0;
    // 当分组内文章数量少于 2 篇或文章总数显示超过 20 篇时，自动折叠分组
    const titleCollapsedSize = 20;

    // 获取章节标题
    let chapter: string = '';
    let showChapterCount: boolean = true;
    let showChapterCountName: string = '';
    let needRoute: boolean = false;
    if (fs.existsSync(`${path}/index.md`)) {
        const { data } = matter.read(`${path}/index.md`);
        data.title !== undefined ? chapter = data.title : chapter = path;
        data.showChapterCount !== undefined ? showChapterCount = data.showChapterCount : showChapterCount = true;
        data.showChapterCountName !== undefined ? showChapterCountName = data.showChapterCountName : showChapterCountName = '篇';
        data.needRoute !== undefined ? needRoute = data.needRoute : needRoute = false;
    }

    // 2. 获取分组下的所有文章
    sync(`${path}/*.md`, {
        onlyFiles: true,
        objectMode: true,
        ignore: ['**/index.md']
    }).forEach((article) => {
        const { data } = matter.read(`${article.path}`);
        // 向前追加标题
        items.push({
            text: data.title,
            link: `/${article.path}`.replace('posts/', ''),
            date: data.date,
            sort: data.sort,
        });
        total += 1;
    })

    // 排序
    sortArticleItems(items, true);

    groups.push({
        text: `${chapter !== '' ? chapter : path} ${showChapterCount && items.length > 0 ? `(${items.length}${showChapterCountName})` : ''}`,
        link: `${needRoute ? `/${path}`.replace('posts/', '') : ''}`,
        items: items,
        // collapsed: items.length < groupCollapsedSize || total > titleCollapsedSize,
        collapsed: total > titleCollapsedSize,
    })

    return groups;
}

// 根据date 排序, 逆序
function sortArticleItems(items: SidebarItem[], incr: boolean) {
    items.sort((a, b) => {
        if (a.sort && b.sort) {
            return a.sort - b.sort;
        }

        if (a.date && b.date) {
            if (incr) {
                return new Date(a.date).getTime() - new Date(b.date).getTime()
            } else {
                return new Date(b.date).getTime() - new Date(a.date).getTime()
            }
        }
        return 0;
    });

    items.forEach((item) => {
        item.text = `📝 ${item.text}`;
    });
}