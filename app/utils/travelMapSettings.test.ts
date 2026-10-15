import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Repository Node test runner.
import test from 'node:test'
import { createTravelBasemapLoader, normalizeTravelBasemap, normalizeTravelTrackColor, travelMapInteractive, travelTrackColors } from './travelMapSettings.ts'

test('invalid saved settings fall back to the existing map and muted blue', () => {
	for (const value of [null, '', 'invalid', '__proto__', 3]) {
		assert.equal(normalizeTravelBasemap(value), 'simple')
		assert.equal(normalizeTravelTrackColor(value), 'blue')
	}
	assert.equal(normalizeTravelBasemap('hybrid'), 'hybrid')
	assert.equal(normalizeTravelTrackColor('sage'), 'sage')
	assert.equal(Object.keys(travelTrackColors).length, 5)
})

test('satellite exploration locks all input while the simple map remains interactive', () => {
	assert.equal(travelMapInteractive('simple', true), true)
	assert.equal(travelMapInteractive('simple', false), false)
	assert.equal(travelMapInteractive('satellite', true), false)
	assert.equal(travelMapInteractive('hybrid', true), false)
})

test('ArcGIS styles load only on demand and share concurrent and subsequent requests', async () => {
	const requests: string[] = []
	const loader = createTravelBasemapLoader('test-key', 'zh', async (url) => {
		requests.push(String(url))
		return { ok: true, json: async () => ({ version: 8, sources: { imagery: { type: 'raster', attribution: 'Esri, imagery providers' } }, layers: [] }) } as Response
	})
	assert.equal(requests.length, 0)
	const [a, b] = await Promise.all([loader('satellite'), loader('satellite')])
	assert.equal(a, b)
	await loader('satellite')
	assert.equal(requests.length, 1)
	assert.ok(requests[0]!.includes('/imagery/standard?'))
	await loader('hybrid')
	assert.equal(requests.length, 2)
	const url = new URL(requests[1]!)
	assert.equal(url.searchParams.get('language'), 'zh-CN')
	assert.equal(url.searchParams.get('token'), 'test-key')
})

test('failed styles can retry and errors never expose the token', async () => {
	let attempts = 0
	const loader = createTravelBasemapLoader('secret-key', 'en', async () => {
		attempts++
		if (attempts === 1)
			return { ok: true, json: async () => ({ error: { code: 498, message: 'secret-key' } }) } as Response
		return { ok: true, json: async () => ({ version: 8, sources: {}, layers: [] }) } as Response
	})
	await assert.rejects(loader('hybrid'), error => error instanceof Error && !error.message.includes('secret-key'))
	await loader('hybrid')
	assert.equal(attempts, 2)
	await assert.rejects(createTravelBasemapLoader('', 'en')('satellite'))
})

test('OpenStreetMap Carto works without an ArcGIS key and uses only the standard OSM tile source', async () => {
	let requests = 0
	const loader = createTravelBasemapLoader('', 'zh', async () => {
		requests++
		throw new Error('OSM must not request an ArcGIS style')
	})
	assert.equal(normalizeTravelBasemap('osm'), 'osm')
	assert.equal(travelMapInteractive('osm', true), true)
	assert.equal(travelMapInteractive('osm', false), false)
	const style = await loader('osm')
	assert.equal(requests, 0)
	assert.equal(Object.keys(style.sources).length, 1)
	const source = style.sources.osm
	assert.equal(source?.type, 'raster')
	assert.deepEqual('tiles' in source! ? source.tiles : [], ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'])
	assert.ok('attribution' in source! && source.attribution?.includes('OpenStreetMap'))
})
