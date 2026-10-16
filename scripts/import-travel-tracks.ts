import { Buffer } from 'node:buffer'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import process from 'node:process'
import { buildTravelTracks, parseTrackCsv } from '../shared/travelTrackImport.ts'

const [source, output = 'app/travels/zh/nz-202609.tracks.json'] = process.argv.slice(2)
if (!source)
	throw new Error('Usage: node scripts/import-travel-tracks.ts <DoL CSV> [output]')

// All thirteen chapters. Day 1 spans China departure and NZ arrival;
// the 27 September chapter is 23 hours because NZ enters daylight saving time.
const windows = [
	{ chapter: 0, day: 1, start: '2026-09-25T00:00:00+08:00', end: '2026-09-27T00:00:00+12:00' },
	{ chapter: 1, day: 2, start: '2026-09-27T00:00:00+12:00', end: '2026-09-28T00:00:00+13:00' },
	{ chapter: 2, day: 3, start: '2026-09-28T00:00:00+13:00', end: '2026-09-29T00:00:00+13:00' },
	{ chapter: 3, day: 4, start: '2026-09-29T00:00:00+13:00', end: '2026-09-30T00:00:00+13:00' },
	{ chapter: 4, day: 5, start: '2026-09-30T00:00:00+13:00', end: '2026-10-01T00:00:00+13:00' },
	{ chapter: 5, day: 6, start: '2026-10-01T00:00:00+13:00', end: '2026-10-02T00:00:00+13:00' },
	// Chapter 7 ends after returning to the hotel (~16:12); the Skyline outing starts at 17:04.
	{ chapter: 6, day: 7, start: '2026-10-02T00:00:00+13:00', end: '2026-10-02T17:00:00+13:00' },
	{ chapter: 7, day: 7, start: '2026-10-02T17:00:00+13:00', end: '2026-10-03T00:00:00+13:00' },
	{ chapter: 8, day: 8, start: '2026-10-03T00:00:00+13:00', end: '2026-10-04T00:00:00+13:00' },
	{ chapter: 9, day: 9, start: '2026-10-04T00:00:00+13:00', end: '2026-10-05T00:00:00+13:00' },
	{ chapter: 10, day: 10, start: '2026-10-05T00:00:00+13:00', end: '2026-10-06T00:00:00+13:00' },
	{ chapter: 11, day: 11, start: '2026-10-06T00:00:00+13:00', end: '2026-10-07T00:00:00+13:00' },
	// Return spans both travel days; stop at the final photo at Pudong baggage claim.
	{ chapter: 12, day: 12, start: '2026-10-07T00:00:00+13:00', end: '2026-10-08T10:23:00+08:00', maxFlightRepairSeconds: 1800 },
]
const points = parseTrackCsv(readFileSync(source, 'utf8'))
const processing = { maxGapSeconds: 900, maxSpeed: 400, toleranceMeters: 8, maxPauseDistanceMeters: 25 }
const result = buildTravelTracks(points, windows, processing)
if (result.report.some(chapter => chapter.outputPoints === 0))
	throw new Error('Source CSV has no usable trajectory for one or more existing NZ chapters')
mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, `${JSON.stringify(result.tracks)}\n`)
mkdirSync('output/travel-tracks', { recursive: true })
writeFileSync('output/travel-tracks/import-report.json', `${JSON.stringify({ sourcePoints: points.length, windows, processing, ...result }, null, 2)}\n`)
console.log(JSON.stringify({ sourcePoints: points.length, output, bytes: Buffer.byteLength(JSON.stringify(result.tracks)), chapters: result.report }, null, 2))
