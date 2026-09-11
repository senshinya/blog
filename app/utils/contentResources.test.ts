import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Use the project's built-in Node test runner.
import test from 'node:test'
import { contentResourceLinks, contentResourceNeeds, localeFontLinks } from './contentResources.ts'

test('plain content and literal math/code examples request no optional resources', () => {
	assert.deepEqual(contentResourceNeeds({ body: { value: [['p', {}, 'Price $5, class="katex", <code>']] } }), { math: false, serif: false, monospace: false })
})

test('rendered minimark math and code request their resources', () => {
	const needs = contentResourceNeeds({ body: { value: [['p', {}, ['span', { class: 'katex' }, 'formula']], ['pre', {}, ['code', {}, 'const n = 1']]] } })
	assert.deepEqual(needs, { math: true, serif: false, monospace: true })
})

test('HAST math and inline code are recognized along with serif story titles', () => {
	assert.deepEqual(contentResourceNeeds({ type: 'story', body: { children: [{ type: 'element', tagName: 'span', properties: { className: ['katex-display'] } }, { type: 'element', tagName: 'code' }] } }), { math: true, serif: true, monospace: true })
})

test('custom prose code and explicitly serif classes request fonts', () => {
	assert.deepEqual(contentResourceNeeds({ body: { value: [['prose-code', { code: 'test' }], ['span', { class: 'text-story' }, 'story']] } }), { math: false, serif: true, monospace: true })
})

test('serif links use the correct locale and never bring along monospace or sans', () => {
	for (const locale of ['zh', 'en', 'ja']) {
		const links = contentResourceLinks({ serif: true }, locale)
		assert.equal(links.length, 1)
		assert.match(links[0]!.href, locale === 'ja' ? /Noto\+Serif\+JP/ : /Noto\+Serif\+SC/)
		assert.doesNotMatch(links[0]!.href, /JetBrains|Sans/)
	}
})

test('resource keys deduplicate per-font requests and omit unused stylesheets', () => {
	assert.deepEqual(contentResourceLinks({}, 'zh'), [])
	const links = contentResourceLinks({ math: true, monospace: true }, 'ja')
	assert.equal(links.length, 2)
	assert.equal(new Set(links.map(link => link.key)).size, 2)
	assert.ok(links.some(link => link.href.includes('katex@0.16.44')))
	assert.ok(links.some(link => link.href.includes('JetBrains+Mono')))
})

test('Japanese shell loads only Japanese sans; other locales retain Douyin', () => {
	assert.match(localeFontLinks('ja')[0]!.href, /Noto\+Sans\+JP/)
	assert.doesNotMatch(localeFontLinks('ja')[0]!.href, /Serif|DOUYIN/)
	for (const locale of ['zh', 'en'])
		assert.match(localeFontLinks(locale)[0]!.href, /DOUYINSANSBOLD-GB/)
})
