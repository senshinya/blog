import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Use the repository's Node test runner.
import test from 'node:test'
import { travelCaptionParts } from './travelCaption.ts'

test('caption links retain surrounding text, newlines, queries and Chinese punctuation', () => {
	const text = '推荐。\n官网：https://breakone.co.nz，另见 https://example.com/path?a=1&b=2。'
	const parts = travelCaptionParts(text)
	assert.equal(parts.map(part => part.text).join(''), text)
	assert.deepEqual(parts.filter(part => part.href).map(part => part.href), ['https://breakone.co.nz', 'https://example.com/path?a=1&b=2'])
})

test('caption content remains plain text and only HTTP URLs become links', () => {
	const text = '<img src=x onerror=alert(1)> javascript:alert(1)\nhttp://example.com/" onclick="bad'
	const parts = travelCaptionParts(text)
	assert.equal(parts.map(part => part.text).join(''), text)
	assert.deepEqual(parts.filter(part => part.href).map(part => part.href), ['http://example.com/'])
})
