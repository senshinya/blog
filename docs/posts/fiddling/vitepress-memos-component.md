---
title: 在 VitePress 中实现一个动态说说功能
tags: ["VitePress","Memos","CloudFlare"]
category: 折腾
date: 2025-01-29T21:58:00+08:00
---
# 在 VitePress 中实现一个动态说说功能

### 前言

很多动态博客中都有一个说说的功能，本质就是一种特殊的博文，借助动态博客的实时性，可以做到随写随发

静态博客由于是在本地或服务器上静态编译成 html 后再部署，实时性比较差。写一篇博文长篇大论自然可以在电脑前，走 git 推送部署也不算麻烦，但是发一篇说说还要打开电脑，心智负担就有些重了，手机上操作 git 也比较麻烦，不是很优雅，干脆一想就不发算了

于是实现了一套说说系统的前后端，效果就是本博客的[碎碎念](/balabala)。后端使用 CloudFlare Workers 实现，存储当然也就近存储在大善人的 KV 里，简单写了个管理页面。博客框架是 VitePress，前端也就做成了个 Vue 组件，直接嵌入一个页面作为说说页

前端效果不再多说，后端管理页面效果
![Memo 管理页面](https://blog-img.shinya.click/2025/8551751fe98e55c4159d28b9ff5b9473.png)

### 后端 CloudFlare Workers + KV

#### 基本概述

后端包含以下功能：
- 支持说说的增删改（基本功能）
- 页面和所有写接口都有鉴权，足够安全
- Markdown 格式实时预览（by marked）

KV 中存储一个 `index` key，value 是一个 uid 的数组，作为全部说说的索引。其他所有说说都存储在以 `uid` 为 key 的条目中，value 格式如

```js
{
    "uid":"唯一id",
    "createTime":"发布时间",
    "content":"说说内容",
}
```

#### 实现

首先要创建一个 CloudFlare 的 KV Space，专门存储说说相关的 KV 对。位置在`账户首页 - 存储和数据库 - KV`，点击创建，名字不太重要，记住就行了，我这里简单命名为 `memos`

接着就是创建 CloudFlare Workers，用于逻辑处理。位置在`账户首页 - 计算（Workers）- Workers 和 Pages`，点击创建，名字依然不太重要，我简单命名为 `memos-api`。创建完成后，点击 Workers 名称进入 Workers 详情，在`设置 - 绑定`中添加一个绑定关系，选择绑定 `KV命名空间`，变量名称为 `KV`，KV 命名空间选择刚刚创建的 KV Space 名称，我的是 `memos`。这样绑定完成后，就可以在代码中直接使用 `env.KV` 操作 `memos` 这个 KV 空间了。最后点击顶栏右侧的`编辑代码`按钮

下面就是 Code Time！

首先创建一个 `index.html`，用来存放管理页面的 html、css 和 js

```html
<!DOCTYPE html>
<html>

<head>
    <title>Memos 管理</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        :root {
            --primary-color: #2c3e50;
            --secondary-color: #34495e;
            --accent-color: #3498db;
            --background-color: #f5f6fa;
            --text-color: #2c3e50;
            --border-color: #dcdde1;
            --hover-color: #f1f2f6;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background-color: var(--background-color);
            color: var(--text-color);
            line-height: 1.6;
        }

        #auth-panel {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.95);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            backdrop-filter: blur(5px);
        }

        #auth-form {
            background: white;
            padding: 2rem;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            width: 300px;
        }

        #auth-form input {
            width: 100%;
            padding: 0.8rem;
            margin-bottom: 1rem;
            border: 1px solid var(--border-color);
            border-radius: 5px;
            font-size: 1rem;
        }

        .container {
            max-width: 1400px;
            margin: 2rem auto;
            padding: 0 1rem;
            display: flex;
            gap: 2rem;
            height: calc(100vh - 4rem);
        }

        .memo-list {
            width: 350px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            display: flex;
            flex-direction: column;
        }

        .memo-list-header {
            padding: 1rem;
            border-bottom: 1px solid var(--border-color);
            font-weight: 600;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .memo-items {
            flex: 1;
            overflow-y: auto;
            padding: 0.5rem;
        }

        .memo-item {
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 0.5rem;
            cursor: pointer;
            transition: all 0.2s ease;
            border: 1px solid var(--border-color);
            height: auto;
            /* 移除固定高度 */
            overflow: hidden;
            position: relative;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .memo-item:hover {
            background-color: var(--hover-color);
            transform: translateY(-2px);
        }

        .memo-item.active {
            border-color: var(--accent-color);
            background-color: var(--hover-color);
        }

        .memo-detail {
            flex: 1;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            display: flex;
            flex-direction: column;
        }

        .memo-detail-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .memo-item-header {
            display: flex;
            justify-content: space-between;
            font-size: 0.8rem;
            color: #666;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 0.5rem;
        }

        .memo-item-content {
            font-size: 0.9rem;
            line-height: 1.4;
            max-height: 4.2em;
            /* 显示3行文本 */
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
        }

        .memo-uid {
            font-family: monospace;
            color: var(--accent-color);
        }

        .memo-info {
            font-size: 0.9rem;
            color: #666;
            margin-left: 10px;
            margin-top: 10px;
        }

        .memo-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            padding: 1rem;
            gap: 1rem;
        }

        .memo-edit {
            flex: 1;
        }

        .memo-edit textarea {
            width: 100%;
            height: 100%;
            border: 1px solid var(--border-color);
            border-radius: 5px;
            padding: 1rem;
            font-size: 1rem;
            resize: vertical;
            font-family: inherit;
        }

        .memo-preview {
            flex: 1;
            padding: 1rem;
            border: 1px solid var(--border-color);
            border-radius: 5px;
            overflow-y: auto;
            overflow-x: hidden;
            background-color: var(--background-color);
        }

        .memo-preview img {
            max-width: 100%;
            max-height: 150px;
            object-fit: contain;
            display: block;
            /* 避免图片底部空隙 */
            margin: 5px 0;
        }

        .memo-preview blockquote {
            border-left: 2px solid #e2e2e3;
            padding-left: 16px;
            color: rgba(60, 60, 67, .78);
        }

        .memo-actions {
            padding: 1rem;
            border-top: 1px solid var(--border-color);
            display: flex;
            justify-content: flex-end;
            gap: 1rem;
        }

        .pagination {
            padding: 1rem;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 1rem;
            border-top: 1px solid var(--border-color);
        }

        button {
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 0.9rem;
            background-color: var(--primary-color);
            color: white;
        }

        button:hover {
            opacity: 0.9;
        }

        button.secondary {
            background-color: var(--secondary-color);
        }

        button.danger {
            background-color: #e74c3c;
        }

        .create-btn {
            padding: 0.5rem 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-right: 10px;
            margin-top: 10px;
        }

        /* Responsive Design */
        @media (max-width: 768px) {
            .container {
                flex-direction: column;
                height: auto;
            }

            .memo-list {
                width: 100%;
                height: 300px;
            }

            .memo-detail {
                height: calc(100vh - 400px);
            }

            .memo-preview img {
                max-height: 100px;
            }
        }

        /* Markdown Preview Styles */
        .memo-preview h1,
        .memo-preview h2,
        .memo-preview h3 {
            margin-top: 1rem;
            margin-bottom: 0.5rem;
        }

        .memo-preview p {
            margin-bottom: 1rem;
        }

        .memo-preview code {
            background-color: #f8f9fa;
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
            font-family: monospace;
        }

        .memo-preview pre {
            background-color: #f8f9fa;
            padding: 1rem;
            border-radius: 5px;
            overflow-x: auto;
        }

        /* Loading Spinner */
        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 2px solid rgba(0, 0, 0, 0.1);
            border-radius: 50%;
            border-top-color: var(--accent-color);
            animation: spin 1s ease-in-out infinite;
        }

        @keyframes spin {
            to {
                transform: rotate(360deg);
            }
        }
    </style>
</head>

<body>
    <div id="auth-panel">
        <form id="auth-form">
            <h2 style="margin-bottom: 1rem;">Memos 管理</h2>
            <input type="password" id="password" placeholder="Enter password" required>
            <button type="submit" style="width: 100%">登录</button>
        </form>
    </div>

    <div class="container">
        <div class="memo-list">
            <div class="memo-list-header">
                <span>已发布</span>
                <span id="memo-count"></span>
            </div>
            <div class="memo-items" id="memo-items"></div>
            <div class="pagination">
                <button onclick="prevPage()" class="secondary">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <span id="page-info">新 Memo</span>
                <button onclick="nextPage()" class="secondary">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        </div>

        <div class="memo-detail">
            <div class="memo-detail-header">
                <div class="memo-info" id="memo-info"></div>
                <button class="create-btn" onclick="createMemo()">
                    <i class="fas fa-plus"></i> 发布新 Memo
                </button>
            </div>
            <div class="memo-content">
                <div class="memo-edit">
                    <textarea id="memo-content" placeholder="Write your memo here..."></textarea>
                </div>
                <div class="memo-preview" id="memo-preview"></div>
            </div>
            <div class="memo-actions">
                <button onclick="saveMemo()" id="save-btn">
                    <i class="fas fa-save"></i> 保存
                </button>
                <button onclick="deleteMemo()" class="danger" id="delete-btn">
                    <i class="fas fa-trash"></i> 删除
                </button>
            </div>
        </div>
    </div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/2.0.3/marked.min.js"></script>
    <!-- JavaScript代码与之前相同，但需要添加以下功能增强 -->
    <script>
        let password = '';
        let currentMemo = null;
        let offset = 0;
        const limit = 10;
        let total = 0;
        let currentPageMap = {};

        // Authentication
        document.getElementById('auth-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            password = document.getElementById('password').value;
            try {
                const response = await fetch('/api/auth', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ password }),
                });
                if (response.ok) {
                    document.getElementById('auth-panel').style.display = 'none';
                    loadMemos();
                } else {
                    showNotification('密码错误', 'error');
                }
            } catch (error) {
                showNotification('密码错误', 'error');
            }
        });

        // Load memos
        async function loadMemos() {
            try {
                const response = await fetch(`/api/memos?offset=${offset}&limit=${limit}`);
                const data = await response.json();
                displayMemos(data.data);
                currentPageMap = data.data.reduce((acc, item) => {
                    acc[item.uid] = item;
                    return acc;
                }, {})
                total = data.total;
                updatePagination();
                document.getElementById('memo-count').textContent = `${total} memos`;
            } catch (error) {
                showNotification('加载列表错误', 'error');
            }
        }

        function displayMemos(memos) {
            const container = document.getElementById('memo-items');
            container.innerHTML = memos.map(memo => `
        <div class="memo-item" data-id="${memo.uid}" onclick="selectMemo('${memo.uid}')">
            <div class="memo-item-header">
                <span class="memo-uid">${memo.uid.slice(0, 8)}...</span>
                <span>${new Date(memo.createTime).toLocaleString()}</span>
            </div>
            <div class="memo-item-content">
                ${escapeHtml(memo.content)}
            </div>
        </div>
    `).join('');
        }

        async function selectMemo(uid) {
            try {
                const memo = currentPageMap[uid];
                currentMemo = memo;
                displayMemoDetail(memo);

                // Update selected state
                document.querySelectorAll('.memo-item').forEach(item => {
                    item.classList.remove('active');
                });
                document.querySelector(`.memo-item[data-id="${uid}"]`)?.classList.add('active');
            } catch (error) {
                showNotification('加载 Memo 错误', 'error');
            }
        }

        function displayMemoDetail(memo) {
            document.getElementById('memo-info').innerHTML = memo.uid;
            document.getElementById('memo-content').value = memo.content;
            updatePreview();
        }

        function updatePreview() {
            const content = document.getElementById('memo-content').value;
            document.getElementById('memo-preview').innerHTML = marked(content);
        }

        document.getElementById('memo-content').addEventListener('input', updatePreview);

        async function saveMemo() {
            const content = document.getElementById('memo-content').value;
            if (!content.trim()) {
                showNotification('Memo 内容不得为空', 'error');
                return;
            }

            try {
                showLoading(true);

                if (currentMemo) {
                    // Update existing memo
                    await fetch(`/api/memos/${currentMemo.uid}`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': password,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ content })
                    });
                } else {
                    // Create new memo
                    await fetch('/api/memos', {
                        method: 'POST',
                        headers: {
                            'Authorization': password,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ content })
                    });
                }

                showNotification('保存 Memo 成功');
                loadMemos();
            } catch (error) {
                showNotification('保存 Memo 失败', 'error');
            } finally {
                showLoading(false);
            }
        }

        async function deleteMemo() {
            if (!currentMemo) return;

            if (confirm('确定要删除这条 Memo 吗？')) {
                try {
                    showLoading(true);
                    await fetch(`/api/memos/${currentMemo.uid}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': password
                        }
                    });
                    showNotification('删除 Memo 成功');
                    loadMemos();
                    clearMemoDetail();
                } catch (error) {
                    showNotification('删除 Memo 失败', 'error');
                } finally {
                    showLoading(false);
                }
            }
        }

        function createMemo() {
            currentMemo = null;
            clearMemoDetail();
        }

        function clearMemoDetail() {
            document.getElementById('memo-info').innerHTML = '新 Memo';
            document.getElementById('memo-content').value = '';
            document.getElementById('memo-preview').innerHTML = '';
        }

        function prevPage() {
            if (offset - limit >= 0) {
                offset -= limit;
                loadMemos();
            }
        }

        function nextPage() {
            if (offset + limit < total) {
                offset += limit;
                loadMemos();
            }
        }

        function updatePagination() {
            const currentPage = Math.floor(offset / limit) + 1;
            const totalPages = Math.ceil(total / limit);
            document.getElementById('page-info').textContent =
                `Page ${currentPage} of ${totalPages}`;
        }

        function showLoading(show) {
            const saveBtn = document.getElementById('save-btn');
            if (show) {
                saveBtn.innerHTML = '<div class="loading"></div> 保存中...';
                saveBtn.disabled = true;
            } else {
                saveBtn.innerHTML = '<i class="fas fa-save"></i> 保存';
                saveBtn.disabled = false;
            }
        }

        function showNotification(message, type = 'success') {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.textContent = message;
            notification.style.position = 'fixed';
            notification.style.top = '20px';
            notification.style.right = '20px';
            notification.style.padding = '1rem';
            notification.style.borderRadius = '5px';
            notification.style.backgroundColor = type === 'success' ? '#2ecc71' : '#e74c3c';
            notification.style.color = 'white';
            notification.style.zIndex = '1000';
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
        }

        // 用于防止XSS攻击的辅助函数
        function escapeHtml(html) {
            const div = document.createElement('div');
            div.textContent = html;
            return div.innerHTML;
        }

        // 初始化marked配置
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: false
        });
    </script>
</body>

</html>
```

从 JS 代码中即可看出，后端包含如下两个端点

- `POST /api/auth`：页面鉴权
- `GET /api/memos`：获取说说详情，支持分页
- `POST /api/memos`: 发布新说说
- `PUT /api/memos/{uid}`: 更新说说
- `DELETE /api/memos/{uid}`：删除说说

随后编辑 `worker.js` 实现这些端点即可

```js
import html from './index.html';

const CORRECT_PASSWORD = 'CORRECT_PASSWORD';        // 设置你的密码    // [!code highlight]
const CALLBACK_URL = 'https://CALLBACK_URL';        // 设置回调 URL   // [!code highlight]
const ALLOWED_ORIGINS = ['https://example.com'];    // 允许请求的域名  // [!code highlight]

// 生成随机 UID
function generateUID() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 22; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    result += chars[randomIndex];
  }
  return result;
}
// CORS 处理
function handleCORS(request) {
  const origin = request.headers.get('Origin');
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
  return corsHeaders;
}
function getCurrentTimeInISOFormat() {
  const now = new Date();
  // 获取各个部分
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0'); // 月份从零开始
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const seconds = String(now.getUTCSeconds()).padStart(2, '0');
  // 组装成 ISO 8601 格式字符串
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
}
async function handleRequest(request, env) {
  const url = new URL(request.url);
  function validateAuth(request) {
    const auth = request.headers.get('Authorization');
    return auth === CORRECT_PASSWORD;
  }
  async function shouldNotify(uid) {
    const indexStr = await env.KV.get('index');
    if (!indexStr) return false;
    const index = JSON.parse(indexStr);
    return index.indexOf(uid) < 10;
  }
  async function executeCallback() {
    try {
      await fetch(CALLBACK_URL);
    } catch (error) {
      console.error('Callback failed:', error);
    }
  }
  const corsHeaders = handleCORS(request);
  
  // 处理 CORS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: handleCORS(request),
    });
  }
  // 管理页面
  if (url.pathname === '/manage') {
    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  }
  // 验证密码
  if (url.pathname === '/api/auth' && request.method === 'POST') {
    const { password } = await request.json();
    return new Response(
      JSON.stringify({ success: password === CORRECT_PASSWORD }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
      }
    );
  }
  // API 路由处理
  if (url.pathname.startsWith('/api/memos')) {
    // 获取说说列表
    if (request.method === 'GET') {
      const offset = parseInt(url.searchParams.get('offset')) || 0;
      const limit = parseInt(url.searchParams.get('limit')) || 10;
      const indexStr = await env.KV.get('index');
      const index = indexStr ? JSON.parse(indexStr) : [];
      const pageUids = index.slice(offset, offset + limit);
      const posts = await Promise.all(
        pageUids.map(uid => env.KV.get(uid).then(JSON.parse))
      );
      return new Response(JSON.stringify({
        offset,
        limit,
        data: posts,
        total: index.length,
        hasMore: (offset + limit) < index.length,
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
      });
    }
    // 需要验证的操作
    if (!validateAuth(request)) {
      return new Response('Unauthorized', {
        status: 401,
        headers: corsHeaders
      });
    }
    // 发布新说说
    if (request.method === 'POST') {
      const { content } = await request.json();
      if (!content || !content.trim()) {
        return new Response('Content cannot be empty', {
          status: 400,
          headers: corsHeaders
        });
      }
      const indexStr = await env.KV.get('index');
      const index = indexStr ? JSON.parse(indexStr) : [];
      let uid = generateUID();
      while (true) {
        if (!index.includes(uid)) {
          break;
        }
        uid = generateUID();
      }
      const post = {
        uid,
        createTime: getCurrentTimeInISOFormat(),
        content: content.trim()
      };
      index.unshift(uid);
      await Promise.all([
        env.KV.put('index', JSON.stringify(index)),
        env.KV.put(uid, JSON.stringify(post))
      ]);
      await executeCallback();
      return new Response(JSON.stringify(post), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
      });
    }
    // 编辑说说
    if (request.method === 'PUT') {
      const uid = url.pathname.split('/').pop();
      const { content } = await request.json();
      if (!content || !content.trim()) {
        return new Response('Content cannot be empty', {
          status: 400,
          headers: corsHeaders
        });
      }
      const postStr = await env.KV.get(uid);
      if (!postStr) {
        return new Response('Post not found', {
          status: 404,
          headers: corsHeaders
        });
      }
      const post = JSON.parse(postStr);
      post.content = content.trim();
      await env.KV.put(uid, JSON.stringify(post));
      // 检查是否需要回调
      if (await shouldNotify(uid)) {
        await executeCallback();
      }
      return new Response(JSON.stringify(post), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
      });
    }
    // 删除说说
    if (request.method === 'DELETE') {
      const uid = url.pathname.split('/').pop();
      const indexStr = await env.KV.get('index');
      if (!indexStr) {
        return new Response('Post not found', {
          status: 404,
          headers: corsHeaders
        });
      }
      const needCallback = await shouldNotify(uid);
      const index = JSON.parse(indexStr);
      const newIndex = index.filter(id => id !== uid);
      await Promise.all([
        env.KV.put('index', JSON.stringify(newIndex)),
        env.KV.delete(uid)
      ]);
      if (needCallback) {
        await executeCallback();
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        },
      });
    }
  }
  return new Response('Not Found', {
    status: 404,
    headers: corsHeaders
  });
}
export default {
  async fetch(request, env) {
    try {
      return handleRequest(request, env);
    } catch (error) {
      return new Response(`Internal Server Error: ${error.message}`, {
        status: 500,
        headers: handleCORS(request)
      });
    }
  },
};
```
最顶上三个常量需要配置：

- `CORRECT_PASSWORD`，页面密码
- `CALLBACK_URL`，发布新说说或更新/删除说说后触发的回调地址
- `ALLOWED_ORIGINS`，跨域处理，允许访问的域名列表，至少两个：你的博客域名和管理页面域名

配置完成后点击发布

由于墙的原因，默认的 `workers.dev` 域名很难访问，最好为 worker 配置一个新的域名。在 `memos 详情页面 - 设置 - 域和路由`，添加一个自定义域，填入一个在 Cloudflare 上托管的域名即可。注意这个域名也要添加到 `worker.js` 的 `ALLOWED_ORIGINS` 中

完成后就可以使用这个管理页面了，管理页面的 URL 为 `https://{你的域名}/manage`，进入页面需要输入密码，then enjoy！

### 前端

Thanks to VitePress，我们可以很方便地通过 Vue 组件的方式，编写说说前端并嵌入博客

首先安装 markedjs 依赖，pnpm 可使用如下命令：

```shell
pnpm add marked
```

在你的博客的主题配置文件（通常为 `docs/.vitepress/theme/index.ts`，文件路径和拓展名也许会有区别）的同级目录下，新建一个 `components` 文件夹（已有则无需新建），在其中新建 `memos.vue`

```js
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
import memosRaw from '../../../../memos.json'       // [!code highlight]

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
    const url = `https://{你的域名}/api/memos?limit=${PAGE_SIZE}&offset=${data.offset}`;   // [!code highlight]
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
```

注意将 `{你的域名}` 替换为 CloudFlare Worker 的域名

眼尖的同学可能注意到了，这个组件初始化加载的内容不是通过请求 Worker 接口获取到的，而是从一个 json 文件获取的（`import memosRaw from '../../../../memos.json'`）。只有点击加载更多，才会通过 Worker 接口获取更多内容。这是为什么呢？

- 从体验上来说，进入说说页面时，如果初始数据从接口获取，那么这时页面在获取到数据之前会空白一会儿，体验不佳
- 从<mark>省钱</mark>的角度上来说，CloudFlare Worker 免费版是限制请求次数的，初始化数据静态获取可以极大地降低请求次数

这个 `memos.json`，则是在项目编译时，从接口获取到的前十条说说。这也就是为什么，Worker 代码中会添加一个 `CALLBACK_URL`，这个 URL 是在你发布新说说，或者删改前十条说说时重新触发编译使用的，具体 URL 可以根据你的部署平台自行搜索。如果完全动态获取说说内容的话，这里可以不用设置这么一个回调

下面的代码用于在编译时生成 `memos.json`，在主题配置文件（通常为 `docs/.vitepress/theme/index.ts`，文件路径和拓展名也许会有区别）的同级目录下，新建一个 `utils` 文件夹（已有则无需新建），在其中新建 `memos.js`

```js
import https from 'https';
import { promises as fs } from 'fs';

const url = 'https://{你的域名}/api/memos?limit=10';// [!code highlight]

const requestOptions = {
    headers: {
      'Accept-Encoding': '',
    }
};

// 发出 GET 请求
https.get(url, requestOptions, (resp) => {
  let data = [];

  // 逐步接收数据
  resp.on('data', (chunk) => {
    data.push(chunk);
  });

  // 完成接收数据
  resp.on('end', async () => {
    try {
      // 将 Buffer 数组合并为一个 Buffer
      const buffer = Buffer.concat(data);
      const decodedData = buffer.toString('utf-8'); // 假设返回的数据是 UTF-8 编码

      // 保存 JSON 数据到文件
      await fs.writeFile('memos.json', decodedData);
      console.log('JSON 数据已保存到 data.json');
    } catch (e) {
      console.error('解析 JSON 时出错:', e);
    }
  });

}).on('error', (err) => {
  console.error('获取数据时出错:', err);
});
```

接着编辑博客根目录下的 `package.json`，在 dev 和 build 的命令前都添加 `node docs/.vitepress/theme/utils/memos.js`。这里的添加位置可能因人而异，以我为例：

```json
{
  ...
  "scripts": {
    "dev": "node docs/.vitepress/theme/utils/memos.js && vitepress dev docs",
    "build": "node docs/.vitepress/theme/utils/memos.js && vitepress build docs",
    "serve": "vitepress serve docs"
  },
  ...
}
```

这样在 dev 阶段和 build 阶段都会首先调用 `memos.js`，在博客根目录下生成 `memos.json`。注意根据目录层级调整 `memos.vue` 中 import 的路径

这样组件和数据都准备好了，下面这个组件注册为全局组件

在主题配置文件（通常为 `docs/.vitepress/theme/index.ts`，文件路径和拓展名也许会有区别）中引入这个组件，并注册

```js
...
import Memos from './components/memos.vue'
...
export default {
    ...
    enhanceApp({ app }) {
        ...
        app.component('Memos', Memos);// [!code highlight]
    }
} satisfies Theme
```

这样在博客的任何地方，都可以通过 `<Memos />` 直接引入这个组件了

最后就是创建一个单页，专门用于放置这个组件

> 什么？你说你从来没有在 vitepress 中使用过单页？
> 
> 这样，你先在根目录下新建一个 pages 文件夹，再在 VitePress 核心配置文件中（注意不是主题配置文件，通常为 docs/.vitepress/config.ts，文件路径和拓展名也许会有区别）中新增一个 rewrites 规则 `'pages/:file.md': ':file.md'`，这样 pages 下的内容都可以直接通过 `/文件名` 访问了。关于 rewrites，见[官方文档](https://vitepress.dev/guide/routing#route-rewrites)

pages 文件夹下新建 balabala.md，内容为

```markdown
---
title: 碎碎念
hidden: true
comment: false
sidebar: false
aside: false
readingTime: false
showMeta: false
---

<Memos />
```

完事收工
