import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Use the project's built-in Node test runner.
import test from 'node:test'
import { createExpression, latest } from '@maplibre/maplibre-gl-style-spec'
import { getTravelMapLabelField } from './travelMapLocale.ts'

function label(locale: string, properties: Record<string, string>) {
	const compiled = createExpression(getTravelMapLabelField(locale), latest.layout_symbol['text-field'])
	assert.equal(compiled.result, 'success')
	if (compiled.result !== 'success')
		throw new Error('Invalid map label expression')
	return compiled.value.evaluate({ zoom: 10 }, { type: 'Point', properties }).toString()
}

const kyoto = { 'name': '京都市', 'name:zh': '京都', 'name:en': 'Kyoto', 'name:ja': '京都市' }

for (const [locale, expected] of [['zh', '京都'], ['en', 'Kyoto'], ['ja', '京都市']]) {
	test(`map labels follow ${locale}`, () => {
		assert.equal(label(locale!, kyoto), expected)
	})
}

test('uses the local name when the requested translation is absent', () => {
	assert.equal(label('ja', { 'name': '서울', 'name:zh': '首尔' }), '서울')
})

test('supports CARTO legacy English names', () => {
	assert.equal(label('en', { name: '京都市', name_en: 'Kyoto' }), 'Kyoto')
})

test('empty translated names do not make places disappear', () => {
	assert.equal(label('en', { 'name:en': '', 'name': '京都市' }), '京都市')
})

test('falls back to a Latin name, then an empty label for unnamed features', () => {
	assert.equal(label('zh', { 'name:latin': 'Kyoto' }), 'Kyoto')
	assert.equal(label('ja', {}), '')
})
