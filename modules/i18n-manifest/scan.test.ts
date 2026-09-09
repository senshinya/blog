import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// eslint-disable-next-line test/no-import-node-test -- Vitest is not a project dependency; use Node's built-in runner.
import test from 'node:test'

function fixture() {
	const root = mkdtempSync(join(tmpdir(), 'i18n-scan-'))
	const content = join(root, 'content')
	const travels = join(root, 'travels')
	for (const l of ['zh', 'en', 'ja']) {
		mkdirSync(join(content, l, 'posts', 'daily'), { recursive: true })
		mkdirSync(join(travels, l), { recursive: true })
	}
	// 中英有译文，日文没有
	writeFileSync(join(content, 'zh/posts/daily/gastritis.md'), '---\ntitle: 胃炎\n---\n')
	writeFileSync(join(content, 'en/posts/daily/gastritis.md'), '---\ntitle: Gastritis\n---\n')
	// 只有中文
	writeFileSync(join(content, 'zh/friends.md'), '---\ntitle: 友链\n---\n')
	// 游记：中文与日文
	writeFileSync(join(travels, 'zh/kansai-202504.yaml'), 'slug: kansai-202504\ntitle: 近畿地方\n')
	writeFileSync(join(travels, 'ja/kansai-202504.yaml'), 'slug: kansai-202504\ntitle: 近畿地方\n')
	// 草稿：生产环境应被排除
	writeFileSync(join(travels, 'zh/secret-202601.yaml'), 'slug: secret-202601\ndraft: true\n')
	return { content, travels }
}

test('maps each route path to the locales that have it', async () => {
	const { scanLocaleTrees } = await import('./scan.ts')
	const { content, travels } = fixture()
	const manifest = scanLocaleTrees({
		contentDir: content,
		travelsDir: travels,
		locales: ['zh', 'en', 'ja'],
		isDev: false,
		hidePostPrefix: true,
	})
	assert.deepEqual(manifest['/daily/gastritis'], ['en', 'zh'])
	assert.deepEqual(manifest['/friends'], ['zh'])
	assert.deepEqual(manifest['/travels/kansai-202504'], ['ja', 'zh'])
})

test('strips the /posts prefix from article paths', async () => {
	const { scanLocaleTrees } = await import('./scan.ts')
	const { content, travels } = fixture()
	const manifest = scanLocaleTrees({ contentDir: content, travelsDir: travels, locales: ['zh', 'en', 'ja'], isDev: false, hidePostPrefix: true })
	assert.equal(Object.keys(manifest).some(k => k.startsWith('/posts/')), false)
})

test('keeps the /posts prefix when hidePostPrefix is false', async () => {
	const { scanLocaleTrees } = await import('./scan.ts')
	const { content, travels } = fixture()
	const manifest = scanLocaleTrees({ contentDir: content, travelsDir: travels, locales: ['zh', 'en', 'ja'], isDev: false, hidePostPrefix: false })
	assert.deepEqual(manifest['/posts/daily/gastritis'], ['en', 'zh'])
})

test('uses the frontmatter permalink instead of the derived path', async () => {
	const { scanLocaleTrees } = await import('./scan.ts')
	const { content, travels } = fixture()
	writeFileSync(join(content, 'zh/posts/daily/custom.md'), '---\ntitle: 自定义链接\npermalink: /custom/path\n---\n')
	const manifest = scanLocaleTrees({ contentDir: content, travelsDir: travels, locales: ['zh', 'en', 'ja'], isDev: false, hidePostPrefix: true })
	assert.deepEqual(manifest['/custom/path'], ['zh'])
	assert.equal(manifest['/daily/custom'], undefined)
})

test('does not mistake a body line that looks like permalink for frontmatter', async () => {
	const { scanLocaleTrees } = await import('./scan.ts')
	const { content, travels } = fixture()
	writeFileSync(
		join(content, 'zh/posts/daily/not-permalink.md'),
		'---\ntitle: 正文里有 permalink\n---\n\n介绍：\npermalink: /not-this\n结束。\n',
	)
	const manifest = scanLocaleTrees({ contentDir: content, travelsDir: travels, locales: ['zh', 'en', 'ja'], isDev: false, hidePostPrefix: true })
	assert.deepEqual(manifest['/daily/not-permalink'], ['zh'])
	assert.equal(manifest['/not-this'], undefined)
})

test('excludes draft travels outside development', async () => {
	const { scanLocaleTrees } = await import('./scan.ts')
	const { content, travels } = fixture()
	const prod = scanLocaleTrees({ contentDir: content, travelsDir: travels, locales: ['zh', 'en', 'ja'], isDev: false, hidePostPrefix: true })
	assert.equal(prod['/travels/secret-202601'], undefined)
	const dev = scanLocaleTrees({ contentDir: content, travelsDir: travels, locales: ['zh', 'en', 'ja'], isDev: true, hidePostPrefix: true })
	assert.deepEqual(dev['/travels/secret-202601'], ['zh'])
})
