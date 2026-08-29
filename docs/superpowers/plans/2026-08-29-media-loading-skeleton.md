# Media Loading Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the visible `/media` initial and filter-reload text with eight card-shaped loading placeholders while leaving pagination feedback unchanged.

**Architecture:** Add one presentation-only `MediaCardSkeleton` component that mirrors `MediaCard` dimensions and owns its shimmer styles. Keep loading-state orchestration in `app/pages/media/index.vue`, where the existing `loading` branch renders eight placeholders in the existing responsive grid plus one screen-reader status message.

**Tech Stack:** Nuxt 4, Vue 3 SFC templates, scoped SCSS, Node's built-in test runner.

---

## File map

- Create `app/pages/media/index.test.ts`: source-contract regression tests for the loading branch and skeleton accessibility/motion requirements.
- Create `app/components/media/CardSkeleton.vue`: one non-interactive card skeleton matching the real media card geometry.
- Modify `app/pages/media/index.vue`: replace the visible loading paragraph with an eight-item skeleton grid and visually hidden status text.

### Task 1: Add the eight-card loading state

**Files:**
- Create: `app/pages/media/index.test.ts`
- Create: `app/components/media/CardSkeleton.vue`
- Modify: `app/pages/media/index.vue:179-186,323-341`

- [ ] **Step 1: Write the failing loading-state contract tests**

Create `app/pages/media/index.test.ts`:

```ts
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
// eslint-disable-next-line test/no-import-node-test -- Vitest is not a project dependency; use Node's built-in runner.
import test from 'node:test'

const pagePath = new URL('./index.vue', import.meta.url)
const skeletonPath = new URL('../../components/media/CardSkeleton.vue', import.meta.url)

test('renders eight accessible media card placeholders during full-page loading', async () => {
	const page = await readFile(pagePath, 'utf8')

	assert.match(page, /<template v-else-if="loading">/)
	assert.match(page, /v-for="index in 8"/)
	assert.match(page, /<MediaCardSkeleton\s*\/>/)
	assert.match(page, /aria-hidden="true"/)
	assert.match(page, /role="status"/)
	assert.match(page, /正在加载娱乐收藏/)
	assert.doesNotMatch(page, /<p v-else-if="loading" class="media-tip">/)
})

test('keeps media skeleton motion optional', async () => {
	const skeleton = await readFile(skeletonPath, 'utf8')

	assert.match(skeleton, /@media \(prefers-reduced-motion: reduce\)/)
	assert.match(skeleton, /animation: none/)
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test app/pages/media/index.test.ts`

Expected: FAIL because the page still contains the visible loading paragraph and `CardSkeleton.vue` does not exist.

- [ ] **Step 3: Create the card skeleton component**

Create `app/components/media/CardSkeleton.vue`:

```vue
<template>
<div class="bgm-card-skeleton">
	<span class="skeleton-block skeleton-cover" />
	<div class="skeleton-info">
		<span class="skeleton-block skeleton-title" />
		<div class="skeleton-meta">
			<span class="skeleton-block" />
			<span class="skeleton-block" />
		</div>
		<div class="skeleton-summary">
			<span class="skeleton-block" />
			<span class="skeleton-block skeleton-summary-short" />
		</div>
	</div>
</div>
</template>

<style lang="scss" scoped>
.bgm-card-skeleton {
	display: flex;
	overflow: hidden;
	height: 180px;
	border: 1px solid var(--c-border);
	border-radius: 8px;
	background-color: var(--c-bg-3);
}

.skeleton-block {
	display: block;
	border-radius: 4px;
	background: linear-gradient(90deg, var(--c-bg-2) 25%, var(--c-bg-3) 50%, var(--c-bg-2) 75%) 0 0 / 200% 100%;
	animation: media-skeleton-shimmer 1.4s infinite linear;
}

.skeleton-cover {
	flex-shrink: 0;
	width: 120px;
	height: 100%;
	border-radius: 0;
}

.skeleton-info {
	display: flex;
	min-width: 0;
	flex: 1;
	flex-direction: column;
	padding: 12px;
}

.skeleton-title {
	width: 72%;
	height: 16px;
	margin-bottom: 12px;
}

.skeleton-meta {
	display: flex;
	gap: 12px;

	> .skeleton-block {
		width: 58px;
		height: 10px;
	}

	> .skeleton-block:last-child {
		width: 42px;
	}
}

.skeleton-summary {
	display: flex;
	flex-direction: column;
	gap: 7px;
	margin-top: auto;

	> .skeleton-block {
		height: 11px;
	}
}

.skeleton-summary-short {
	width: 64%;
}

@keyframes media-skeleton-shimmer {
	to {
		background-position-x: -200%;
	}
}

@media (prefers-reduced-motion: reduce) {
	.skeleton-block {
		animation: none;
	}
}
</style>
```

- [ ] **Step 4: Replace the page loading paragraph**

Replace the current `v-else-if="loading"` paragraph in `app/pages/media/index.vue` with:

```vue
<template v-else-if="loading">
	<span class="media-loading-status" role="status">
		正在加载娱乐收藏
	</span>
	<ol class="media-grid" aria-hidden="true">
		<li v-for="index in 8" :key="index">
			<MediaCardSkeleton />
		</li>
	</ol>
</template>
```

Add this scoped style after `.media-footer`:

```scss
.media-loading-status {
	position: absolute;
	overflow: hidden;
	width: 1px;
	height: 1px;
	clip-path: inset(50%);
	white-space: nowrap;
}
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `node --test app/pages/media/index.test.ts`

Expected: 2 tests pass.

- [ ] **Step 6: Run static checks**

Run: `pnpm exec eslint app/pages/media/index.vue app/pages/media/index.test.ts app/components/media/CardSkeleton.vue && pnpm exec stylelint app/pages/media/index.vue app/components/media/CardSkeleton.vue`

Expected: exit 0 with no errors.

- [ ] **Step 7: Commit the loading skeleton implementation**

```bash
git add app/pages/media/index.vue app/pages/media/index.test.ts app/components/media/CardSkeleton.vue
git commit -m "feat(media): add loading skeleton cards"
```

### Task 2: Verify behavior and responsive presentation

**Files:**
- Verify: `app/pages/media/index.vue`
- Verify: `app/components/media/CardSkeleton.vue`

- [ ] **Step 1: Run the full project tests**

Run: `node --test app/**/*.test.ts app/**/**/*.test.ts`

Expected: all discovered Node tests pass with zero failures.

- [ ] **Step 2: Run repository lint**

Run: `pnpm lint`

Expected: ESLint and Stylelint exit 0.

- [ ] **Step 3: Run the production build**

Run: `pnpm build`

Expected: Nuxt production build exits 0.

- [ ] **Step 4: Inspect the loading state in a browser**

Start `pnpm dev`, open `/media`, throttle or intercept the Bangumi collection request so the loading state remains visible, and verify:

- desktop: eight placeholders use the same two-column grid and 180px card outline as loaded content;
- 375px: eight placeholders collapse to one column without horizontal overflow;
- the visible “加载中...” paragraph is absent;
- switching category or status shows the same eight placeholders;
- “加载更多” retains the existing button spinner/text rather than adding placeholders;
- reduced-motion emulation leaves the skeleton static.

- [ ] **Step 5: Review the final diff**

Run: `git diff HEAD^ --check && git show --stat --oneline HEAD`

Expected: no whitespace errors; only the planned media loading files changed in the implementation commit.
