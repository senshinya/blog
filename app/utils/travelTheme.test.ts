import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- The project uses Node's built-in test runner.
import test from 'node:test'
import { neutralTravelPaint, normalizeTravelAppearance, normalizeTravelPalette, travelMapColors } from './travelTheme.ts'

test('unknown saved preferences resolve to pure/system, including object prototype names', () => {
	for (const value of [null, undefined, '', 'unknown', 'toString', '__proto__'])
		assert.equal(normalizeTravelPalette(value), 'mono')
	assert.equal(normalizeTravelPalette('moss'), 'moss')
	assert.equal(normalizeTravelAppearance('dark'), 'dark')
	assert.equal(normalizeTravelAppearance('invalid'), 'system')
})
test('pure palette keeps soft light/dark backgrounds and separate colored selection accents', () => {
	assert.equal(travelMapColors('mono', 'light').paper, '#f5f5f7')
	assert.equal(travelMapColors('mono', 'dark').paper, '#1d1d1f')
	assert.equal(travelMapColors('mono', 'light').accent, '#a4513e')
	assert.equal(travelMapColors('mono', 'dark').accent, '#dc9a78')
})
test('basemap neutralization preserves expression structure and alpha', () => {
	assert.deepEqual(neutralTravelPaint(['interpolate', ['linear'], ['zoom'], 3, '#f00', 9, 'rgba(0,0,255,0.4)']), ['interpolate', ['linear'], ['zoom'], 3, 'rgba(54,54,54,1)', 9, 'rgba(18,18,18,0.4)'])
	assert.equal(neutralTravelPaint('transparent'), 'transparent')
	assert.equal(neutralTravelPaint(0.55), 0.55)
})
