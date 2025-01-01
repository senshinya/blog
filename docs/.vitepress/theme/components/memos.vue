<template>
    <div class="memos-container">
        <div v-for="memo of memoList" :key="memo.uid">
            <div class="card">
                <div class="header">
                    <span class="time-text">{{ memo.createTime }}</span>
                </div>

                <div class="memo-content" v-html="memo.content" />
            </div>
        </div>
        <div v-if="hasMore" class="load-more">
            <button @click="loadMoreMemos" :disabled="isLoading" class="load-more-button">
                <span v-if="!isLoading">加载更多</span>
                <span v-else class="loading-spinner"></span>
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { marked, Tokens } from "marked"
import { reactive, toRefs, onMounted } from "vue"
import memosRaw from '../../../../memos.json'

interface memosRes {
    data: memo[]
    hasMore: boolean
}

interface image {
    name: string
    filename: string
    url: string
}

interface memo {
    uid: string
    createTime: string
    content: string
}

function convertToLocalTime(dateString: string, timeZone: string = 'Asia/Shanghai'): string {
    // 创建 Date 对象
    const date = new Date(dateString);

    // 提取所需的时间组件
    const options: Intl.DateTimeFormatOptions = {
        timeZone: timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false // 使用 24 小时制
    };

    const formatter = new Intl.DateTimeFormat('zh-CN', options);
    const parts = formatter.formatToParts(date);

    // 构建最终输出格式
    const year = parts.find(part => part.type === 'year')?.value;
    const month = parts.find(part => part.type === 'month')?.value;
    const day = parts.find(part => part.type === 'day')?.value;
    const hour = parts.find(part => part.type === 'hour')?.value;
    const minute = parts.find(part => part.type === 'minute')?.value;
    const second = parts.find(part => part.type === 'second')?.value;

    // 拼接成目标格式
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

const PAGE_SIZE = 10;
const data = reactive({
    memoList: [] as memo[],
    offset: 10, // 从文件加载了 10 条，所以初始 offset 为 10
    hasMore: true,
    isLoading: false
})
const { memoList, hasMore, isLoading } = toRefs(data);

const renderer = new marked.Renderer();
renderer.image = function({href, title, text}: Tokens.Image):string {
  return `
    <div class="img-container">
        <img class="imgwrp" loading="lazy" src="${href}" />
    </div>
  `
};
marked.use({
    renderer: renderer,
    breaks: true,
    gfm: true,
})

function processMemos(memos: memo[]) {
  return memos.map(memo => ({
    ...memo,
    content: marked.parse(memo.content) as string,
    createTime: convertToLocalTime(memo.createTime)
  }));
}

// 初始化数据
onMounted(() => {
  const initialMemos = memosRaw.data as memo[];
  data.memoList = processMemos(initialMemos);
});

async function loadMoreMemos() {
  if (!data.hasMore || data.isLoading) return;
  
  data.isLoading = true;
  try {
    const url = `https://memos.shinya.click/api/memos?limit=${PAGE_SIZE}&offset=${data.offset}`;
    const response = await fetch(url);
    const result: memosRes = await response.json();
    
    const processedMemos = processMemos(result.data);
    data.memoList.push(...processedMemos);
    data.offset += result.data.length;
    data.hasMore = result.hasMore;
  } catch (error) {
    console.error('Failed to load memos:', error);
  } finally {
    data.isLoading = false;
  }
}
</script>

<style lang="scss">
.card {
    border-style: solid;
    margin-bottom: .5rem;
    border-width: 1px; 
    position: relative;
    border-radius: .5rem;
    border-color: var(--vp-c-bg);
    padding-top: .75rem;
    padding-bottom: .75rem;
    padding-left: 1rem;
    padding-right: 1rem;
    background-color: var(--memo-bg);
    font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", Segoe UI Symbol, "Noto Color Emoji";

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .time-text {
            display: inline-block;
            font-size: .875rem;
            text-decoration: none;
            color: var(--memo-time)
        }
    }

    .memo-content {
        margin-top: 5px;
        font-size: 1rem;
        word-break: break-word;
        color: var(--memo-content);

        * {
            margin: 0;
        }

        *:not(:first-child):not([hidden]) {
            margin-top: .5rem;
        }

        .img-container {
            width: 40%;

            .imgwrp {
                width:100%;
                height: 100%;
            }
        }
    
    }
    
}

.card:hover {
    border-color: var(--memo-card-border);
}

.load-more {
  text-align: center;
  margin-top: 40px;
  margin-bottom: 40px;

  .load-more-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 120px; // 固定宽度
    height: 40px; // 固定高度
    background-color: transparent;
    color: var(--vp-c-text-2);
    border: 1px solid var(--vp-c-divider);
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;

    &:hover:not(:disabled) {
      background-color: var(--vp-c-bg-soft);
      color: var(--vp-c-text-1);
      border-color: var(--vp-c-text-2);
    }

    &:active:not(:disabled) {
      transform: translateY(1px);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .loading-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid var(--vp-c-text-3);
      border-radius: 50%;
      border-top-color: var(--vp-c-text-1);
      animation: spin 0.8s linear infinite;
    }
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>