import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
// eslint-disable-next-line test/no-import-node-test -- The project uses Node's built-in test runner.
import test from 'node:test'
import vm from 'node:vm'
import { defaultTravelTrackColor, normalizeTravelBasemap, normalizeTravelTrackColor } from '../utils/travelMapSettings.ts'

test('new travel readers enable tracks by default even when optional storage is unavailable', () => {
	const mounted: (() => void)[] = []
	const source = stripTypeScriptTypes(readFileSync(new URL('./useTravelMapSettings.ts', import.meta.url), 'utf8'))
		.replace(/^import .*$/gm, '')
		.replace('export function', 'function')
	const settings = vm.runInNewContext(`${source}\nuseTravelMapSettings()`, {
		ref: (value: unknown) => ({ value }),
		onMounted: (callback: () => void) => mounted.push(callback),
		defaultTravelTrackColor,
		normalizeTravelBasemap,
		normalizeTravelTrackColor,
		localStorage: { getItem() { throw new Error('Blocked') } },
	})
	assert.equal(settings.tracksVisible.value, true)
	assert.equal(settings.trackColor.value, 'orange')
	mounted.forEach(callback => callback())
	assert.equal(settings.tracksVisible.value, true)
	assert.equal(settings.trackColor.value, 'orange')
	settings.tracksVisible.value = false
	assert.equal(settings.tracksVisible.value, false)
})
