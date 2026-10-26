import type { TravelTrack } from '../../../types/travel.ts'
import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Use the repository's Node test runner.
import test from 'node:test'

const tracks: TravelTrack[] = [{ chapter: 0, day: 1, segments: [[[170, -44], [171, -44]], [[172, -43], [173, -43]]] }]
function map() {
	const sources = new Map<string, any>()
	const layers = new Map<string, any>()
	return {
		sources,
		layers,
		addSource: (id: string, source: any) => sources.set(id, source),
		addLayer: (layer: any) => layers.set(layer.id, layer),
		getLayer: (id: string) => layers.get(id),
		setFilter: (id: string, filter: any) => { layers.get(id).filter = filter },
		setPaintProperty: (id: string, key: string, value: any) => { layers.get(id).paint[key] = value },
		setLayoutProperty: (id: string, key: string, value: any) => { layers.get(id).layout[key] = value },
	}
}

test('track layers preserve disconnected recordings and precede existing photo markers', async () => {
	const { installAtlasTracks } = await import('./atlas-tracks.ts')
	const target = map()
	installAtlasTracks(target as any, tracks)
	target.addLayer({ id: 'photo-points' })
	assert.deepEqual(target.sources.get('travel-tracks').data.features[0].geometry.coordinates, tracks[0]!.segments)
	assert.deepEqual([...target.layers.keys()], ['travel-track-halo', 'travel-track-line', 'photo-points'])
	assert.equal(target.layers.get('travel-track-line').layout['line-cap'], 'round')
})

test('reading, day overview and viewer scope follow the existing photo selection', async () => {
	const { installAtlasTracks, paintAtlasTracks } = await import('./atlas-tracks.ts')
	const target = map()
	installAtlasTracks(target as any, tracks)
	const colors = { track: '#637f91', paper: '#f5f5f7' }
	paintAtlasTracks(target as any, { chapter: 2, overview: false }, colors)
	assert.deepEqual(target.layers.get('travel-track-line').filter, ['==', ['get', 'chapter'], 2])
	paintAtlasTracks(target as any, { chapter: 2, overview: true, selected: { day: 3 } }, colors)
	assert.deepEqual(target.layers.get('travel-track-line').filter, ['==', ['get', 'day'], 3])
	paintAtlasTracks(target as any, { chapter: -1, overview: false }, { track: '#8ca2b2', paper: '#1d1d1f' })
	assert.equal(target.layers.get('travel-track-line').filter, null)
	assert.equal(target.layers.get('travel-track-line').paint['line-color'], '#8ca2b2')
	assert.equal(target.layers.get('travel-track-halo').paint['line-color'], '#1d1d1f')
})

test('travels without track data allocate no extra sources or layers', async () => {
	const { installAtlasTracks, paintAtlasTracks } = await import('./atlas-tracks.ts')
	const target = map()
	installAtlasTracks(target as any)
	paintAtlasTracks(target as any, { chapter: -1, overview: false }, { track: '#789', paper: '#fff' })
	assert.equal(target.sources.size, 0)
	assert.equal(target.layers.size, 0)
})

test('tracks start hidden and toggling changes both layers without replacing the route data', async () => {
	const { installAtlasTracks, paintAtlasTracks } = await import('./atlas-tracks.ts')
	const target = map()
	installAtlasTracks(target as any, tracks)
	const source = target.sources.get('travel-tracks')
	const colors = { track: '#637f91', paper: '#f5f5f7' }
	const scope = { chapter: 0, overview: false }
	for (const layer of target.layers.values())
		assert.equal(layer.layout.visibility, 'none')
	paintAtlasTracks(target as any, scope, colors, true)
	for (const layer of target.layers.values())
		assert.equal(layer.layout.visibility, 'visible')
	paintAtlasTracks(target as any, scope, colors, false)
	for (const layer of target.layers.values())
		assert.equal(layer.layout.visibility, 'none')
	assert.equal(target.sources.get('travel-tracks'), source)
})

test('configured cover tracks stay visible and filter by one-based chapters or actual days', async () => {
	const { installAtlasTracks, paintAtlasTracks } = await import('./atlas-tracks.ts')
	const target = map()
	installAtlasTracks(target as any, tracks)
	const colors = { track: '#637f91', paper: '#f5f5f7' }
	const scope = { chapter: -1, overview: false, coverMap: { tracks: { chapters: [1, 3], days: [7] } } }
	for (const visible of [false, true]) {
		paintAtlasTracks(target as any, scope, colors, visible)
		assert.deepEqual(target.layers.get('travel-track-line').filter, ['any', ['in', ['get', 'chapter'], ['literal', [0, 2]]], ['in', ['get', 'day'], ['literal', [7]]]])
		for (const layer of target.layers.values())
			assert.equal(layer.layout.visibility, 'visible')
	}
	paintAtlasTracks(target as any, { chapter: 0, overview: false }, colors, false)
	assert.equal(target.layers.get('travel-track-line').layout.visibility, 'none')
	assert.deepEqual(target.layers.get('travel-track-line').filter, ['==', ['get', 'chapter'], 0])
})

test('empty cover selections match no routes while an empty track object selects all routes', async () => {
	const { installAtlasTracks, paintAtlasTracks } = await import('./atlas-tracks.ts')
	const target = map()
	installAtlasTracks(target as any, tracks)
	const colors = { track: '#637f91', paper: '#f5f5f7' }
	paintAtlasTracks(target as any, { chapter: -1, overview: false, coverMap: { tracks: { days: [] } } } as any, colors)
	assert.deepEqual(target.layers.get('travel-track-line').filter, ['in', ['get', 'day'], ['literal', []]])
	paintAtlasTracks(target as any, { chapter: -1, overview: false, coverMap: { tracks: {} } } as any, colors)
	assert.equal(target.layers.get('travel-track-line').filter, null)
	assert.equal(target.layers.get('travel-track-line').layout.visibility, 'visible')
})
