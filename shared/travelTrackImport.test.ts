import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Use the repository's Node test runner.
import test from 'node:test'

const point = (time: number, lng: number, lat = -44) => ({ time, lng, lat })
const window = { chapter: 0, day: 1, start: '1970-01-01T00:00:00Z', end: '1970-01-02T00:00:00Z' }

test('DoL parsing handles BOM and quoted fields while rejecting invalid coordinates and timestamps', async () => {
	const { parseTrackCsv } = await import('./travelTrackImport.ts')
	const parsed = parseTrackCsv('\uFEFFtimestamp,longitude,latitude,speed\r\n"10","170","-44",0\r\n11,170,95,0\r\nno,170,-44,0\r\n12,,-44,0\r\n')
	assert.deepEqual(parsed, [{ ...point(10, 170), speed: 0 }])
	assert.throws(() => parseTrackCsv('foo,latitude\n1,2'), /timestamp.*longitude.*latitude/)
})

test('CSV flight telemetry is optional and unknown sentinels do not mark surface points as airborne', async () => {
	const { parseTrackCsv } = await import('./travelTrackImport.ts')
	assert.deepEqual(parseTrackCsv('timestamp,longitude,latitude,speed,altitude\n10,170,-44,250,10000\n11,170.01,-44,-1,-9999\n12,170.02,-44,,\n'), [
		{ ...point(10, 170), speed: 250, altitude: 10000 },
		point(11, 170.01),
		point(12, 170.02),
	])
})

test('a source change during cruise is repaired between normal flight anchors instead of leaving a break', async () => {
	const { buildTravelTracks } = await import('./travelTrackImport.ts')
	const flight = [0, 1, 2, 3, 4, 5, 6].map(step => ({ ...point(step * 30, 170 + (step < 3 ? step : step + 1) * 0.09), speed: 240, altitude: 10000 }))
	const result = buildTravelTracks(flight, [window])
	assert.equal(result.tracks[0]!.segments.length, 1)
	assert.equal(result.report[0]!.flightRepairs.length, 1)
	assert.ok(result.report[0]!.flightRepairs[0]!.removedPoints > 0)
	assert.deepEqual(result.tracks[0]!.segments[0]![0], [flight[0]!.lng, -44])
	assert.deepEqual(result.tracks[0]!.segments[0]!.at(-1), [flight.at(-1)!.lng, -44])
})

test('flight repair keeps layovers, surface jumps and unsupported large jumps disconnected', async () => {
	const { buildTravelTracks } = await import('./travelTrackImport.ts')
	const base = [0, 1, 2, 3, 4, 5, 6].map(step => ({ ...point(step * 30, 170 + (step < 3 ? step : step + 1) * 0.09), speed: 240, altitude: 10000 }))
	const surface = base.map(p => ({ ...p, altitude: 0 }))
	const layover = base.map((p, i) => ({ ...p, time: p.time + (i >= 3 ? 10800 : 0) }))
	const unsupported = base.map((p, i) => ({ ...p, lng: p.lng + (i >= 3 ? 20 : 0) }))
	for (const points of [surface, layover, unsupported]) {
		const result = buildTravelTracks(points, [window])
		assert.equal(result.tracks[0]!.segments.length, 2)
		assert.equal(result.report[0]!.flightRepairs.length, 0)
	}
})

test('chapter windows respect DST offsets, exclude unrelated dates and never join separate chapters', async () => {
	const { buildTravelTracks } = await import('./travelTrackImport.ts')
	const boundary = Date.parse('2026-09-28T00:00:00+13:00') / 1000
	const windows = [
		{ chapter: 1, day: 2, start: '2026-09-27T00:00:00+12:00', end: '2026-09-28T00:00:00+13:00' },
		{ chapter: 2, day: 3, start: '2026-09-28T00:00:00+13:00', end: '2026-09-29T00:00:00+13:00' },
	]
	const result = buildTravelTracks([point(0, 100), point(boundary - 10, 170), point(boundary - 1, 170.001), point(boundary, 170.002), point(boundary + 10, 170.003)], windows)
	assert.deepEqual(result.tracks.map(t => [t.chapter, t.day, t.segments[0]]), [
		[1, 2, [[170, -44], [170.001, -44]]],
		[2, 3, [[170.002, -44], [170.003, -44]]],
	])
})

test('a recording gap preserves separate segments rather than drawing an invented shortcut', async () => {
	const { buildTravelTracks } = await import('./travelTrackImport.ts')
	const { tracks } = buildTravelTracks([point(0, 170), point(10, 170.001), point(2000, 171), point(2010, 171.001)], [window])
	assert.deepEqual(tracks[0]!.segments, [[[170, -44], [170.001, -44]], [[171, -44], [171.001, -44]]])
})

test('a pause near the same location reconnects without adding synthetic coordinates', async () => {
	const { buildTravelTracks } = await import('./travelTrackImport.ts')
	const points = [point(0, 170), point(10, 170.001), point(2000, 170.0011), point(2010, 170.002)]
	const result = buildTravelTracks(points, [window])
	assert.equal(result.tracks[0]!.segments.length, 1)
	assert.equal(result.report[0]!.rejoinedPauses, 1)
	assert.deepEqual(result.tracks[0]!.segments, [[[170, -44], [170.002, -44]]])
	assert.deepEqual(buildTravelTracks(points, [window], { maxPauseDistanceMeters: 0 }).tracks[0]!.segments, [
		[[170, -44], [170.001, -44]],
		[[170.0011, -44], [170.002, -44]],
	])
})

test('a pause longer than the local uncertainty radius remains disconnected', async () => {
	const { buildTravelTracks } = await import('./travelTrackImport.ts')
	const result = buildTravelTracks([point(0, 170), point(10, 170.001), point(2000, 170.0015), point(2010, 170.002)], [window])
	assert.equal(result.tracks[0]!.segments.length, 2)
	assert.equal(result.report[0]!.rejoinedPauses, 0)
})

test('real hairpins, closed walking loops and fast flight paths retain their geometry', async () => {
	const { buildTravelTracks } = await import('./travelTrackImport.ts')
	const hairpin = [point(0, 170), point(10, 170.001), point(20, 170.0001, -44.0002), point(30, 170.001, -44.0004)]
	const loop = [point(0, 170), point(20, 170.001), point(40, 170.001, -44.001), point(60, 170, -44.001), point(80, 170)]
	const flight = [point(0, 170), point(10, 170.03), point(20, 170.06, -44.002), point(30, 170.09, -44.001)]
	for (const points of [hairpin, loop, flight]) {
		const result = buildTravelTracks(points, [window])
		assert.deepEqual(result.tracks[0]!.segments[0], points.map(p => [p.lng, p.lat]))
		assert.equal(result.report[0]!.removedSpikes, 0)
	}
})

test('isolated impossible GPS spikes are removed without losing the surrounding real route', async () => {
	const { buildTravelTracks } = await import('./travelTrackImport.ts')
	const result = buildTravelTracks([point(0, 170), point(10, 170.001), point(11, 175), point(20, 170.002), point(30, 170.003)], [window])
	assert.equal(result.report[0]!.removedSpikes, 1)
	assert.deepEqual(result.tracks[0]!.segments, [[[170, -44], [170.003, -44]]])
})

test('simplification removes redundant straight points but retains turns and segment endpoints', async () => {
	const { buildTravelTracks } = await import('./travelTrackImport.ts')
	const { tracks } = buildTravelTracks([point(0, 170), point(10, 170.001), point(20, 170.002), point(30, 170.002, -44.001), point(40, 170.002, -44.002)], [window])
	assert.deepEqual(tracks[0]!.segments, [[[170, -44], [170.002, -44], [170.002, -44.002]]])
})

test('long flights measure simplification error at each latitude instead of averaging the whole route', async () => {
	const { buildTravelTracks } = await import('./travelTrackImport.ts')
	const points = [point(0, 0, 0), point(60, 0.000055, 0.0005), point(120, 0, 0.001), point(50000, 0, 80), point(50100, 0, 80.001), point(50200, 0, 80.002)]
	const { tracks } = buildTravelTracks(points, [window], { maxGapSeconds: 86400, toleranceMeters: 5 })
	assert.ok(tracks[0]!.segments[0]!.some(([lng, lat]) => lng === 0.000055 && lat === 0.0005), 'a real deviation over five metres near the equator must survive a flight into higher latitudes')
})
