import type { Travel } from '../types/travel.ts'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// eslint-disable-next-line test/no-import-node-test -- Use the repository's Node test runner.
import test from 'node:test'
import { parse } from 'yaml'
import { atlasSelection } from '../components/travel/editorial/atlas-geometry.ts'
import { flattenTravelPhotos, hasTravelCoordinates } from './travelStory.ts'

test('localized annotations identify the same photographs and retain day metadata', () => {
	for (const slug of ['kansai-202504', 'korea-202510']) {
		const localized = ['zh', 'en', 'ja'].map((locale) => {
			const travel = parse(readFileSync(new URL(`../travels/${locale}/${slug}.yaml`, import.meta.url), 'utf8')) as Travel
			return flattenTravelPhotos(travel)
		})
		const expected = localized[0]!.filter(photo => photo.mapView === 'day').map(photo => photo.src)
		assert.equal(expected.length, slug === 'kansai-202504' ? 6 : 7)
		for (const photos of localized) {
			assert.deepEqual(photos.filter(photo => photo.mapView === 'day').map(photo => photo.src), expected)
			for (const photo of photos.filter(photo => photo.mapView === 'day')) {
				const selection = atlasSelection(photos, `photo-${photo.index}`)
				assert.deepEqual(selection.points.map(point => point.index), photos.filter(point => point.day === photo.day && hasTravelCoordinates(point)).map(point => point.index))
				assert.ok(selection.points.every(point => point.day === photo.day))
				assert.equal(selection.selected?.src, photo.src)
			}
		}
	}
})
