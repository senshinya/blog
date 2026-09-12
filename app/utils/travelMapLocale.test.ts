import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// eslint-disable-next-line test/no-import-node-test -- Use the project's built-in Node test runner.
import test from 'node:test'
import { createExpression, latest } from '@maplibre/maplibre-gl-style-spec'
import { parseAllDocuments } from 'yaml'
import { getTravelMapLabelField } from './travelMapLocale.ts'

test('MapLibre resolutions exclude GHSA-jrc7-96c5-q579 affected versions', () => {
	const documents = parseAllDocuments(readFileSync(new URL('../../pnpm-lock.yaml', import.meta.url), 'utf8'))
	const packages = documents.flatMap(document => Object.keys(document.toJSON().packages ?? {}))
		.filter(name => name.startsWith('maplibre-gl@'))
	assert.ok(packages.length > 0)
	for (const name of packages) {
		const [major, minor, patch] = name.split('@')[1]!.split('.').map(Number)
		assert.ok(major! > 6 || (major === 6 && (minor! > 4 || (minor === 4 && patch! >= 1))), `${name} is vulnerable`)
	}
})

test('travel map configures the bundled v6 worker before creating a map', () => {
	const source = readFileSync(new URL('../components/travel/Map.vue', import.meta.url), 'utf8')
	assert.ok(source.includes('import workerUrl from \'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url\''))
	const configureWorker = source.indexOf('maplibre.setWorkerUrl(workerUrl)')
	assert.ok(configureWorker > source.indexOf('await import(\'maplibre-gl\')'))
	assert.ok(configureWorker < source.indexOf('new maplibre.Map('))
})

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
