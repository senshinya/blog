import type { TravelTrack } from '../app/types/travel.ts'

interface TrackPoint { time: number, lng: number, lat: number, speed?: number, altitude?: number }
export interface TrackWindow { chapter: number, day: number, start: string, end: string }
interface FlightRepair { estimated: true, start: number, end: number, removedPoints: number, originalJumpMeters: number, bridgeMeters: number, bridgeSeconds: number }

function csvFields(line: string): string[] {
	return (line.match(/(?:"(?:[^"]|"")*"|[^,]*)(?:,|$)/g) ?? [])
		.filter((field, index, fields) => index < fields.length - 1 || field !== '')
		.map(field => field.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim())
}

export function parseTrackCsv(source: string): TrackPoint[] {
	const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/)
	const header = csvFields(lines.shift() ?? '')
	const indices = ['timestamp', 'longitude', 'latitude'].map(name => header.indexOf(name))
	if (indices.some(index => index < 0))
		throw new Error('CSV requires timestamp, longitude and latitude columns')
	return lines.flatMap((line) => {
		const fields = csvFields(line)
		const values = indices.map(index => fields[index])
		if (values.some(value => value === undefined || value === ''))
			return []
		const [time, lng, lat] = values.map(Number) as [number, number, number]
		if (![time, lng, lat].every(Number.isFinite) || Math.abs(lng) > 180 || Math.abs(lat) > 90)
			return []
		const point: TrackPoint = { time, lng, lat }
		for (const key of ['speed', 'altitude'] as const) {
			const field = fields[header.indexOf(key)]
			const value = field ? Number(field) : Number.NaN
			if (Number.isFinite(value) && (key === 'speed' ? value >= 0 : value !== -9999))
				point[key] = value
		}
		return [point]
	})
}

function distance(a: TrackPoint, b: TrackPoint): number {
	const rad = Math.PI / 180
	const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2
	return 12742000 * Math.asin(Math.min(1, Math.sqrt(h)))
}

function bearing(a: TrackPoint, b: TrackPoint): number {
	const rad = Math.PI / 180
	const delta = (b.lng - a.lng) * rad
	return Math.atan2(Math.sin(delta) * Math.cos(b.lat * rad), Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos(delta)) / rad
}
function headingDifference(a: number, b: number) {
	return Math.abs(((a - b + 540) % 360) - 180)
}
function airborne(point: TrackPoint) {
	return (point.speed ?? 0) >= 70 && (point.altitude ?? 0) >= 1000
}

/** Reconcile short cruise-source jumps using recorded anchors, never through a layover. */
function repairFlightJumps(points: TrackPoint[], maxSpeed: number, maxGapSeconds: number) {
	const removed = new Set<number>()
	const repairs: FlightRepair[] = []
	const jumps = points.map((p, i) => i > 0 && distance(points[i - 1]!, p) / (p.time - points[i - 1]!.time) > maxSpeed ? 1 : 0)
	for (let i = 1; i < points.length; i++) {
		const previous = points[i - 1]!
		const point = points[i]!
		if (!jumps[i] || !airborne(previous) || !airborne(point) || point.time - previous.time > Math.min(600, maxGapSeconds) || removed.has(i - 1) || removed.has(i))
			continue
		let best: { left: number, right: number, seconds: number, metres: number } | undefined
		for (let left = i - 1; left > 0; left--) {
			const a = points[left]!
			if (previous.time - a.time > 300 || !airborne(a))
				break
			if (!airborne(points[left - 1]!))
				continue
			for (let right = i; right < points.length - 1; right++) {
				const b = points[right]!
				if (b.time - point.time > 300 || !airborne(b))
					break
				const seconds = b.time - a.time
				if (seconds > Math.min(600, maxGapSeconds) || (best && seconds >= best.seconds) || !airborne(points[right + 1]!))
					continue
				if (points.slice(left, right + 1).some((_, offset) => removed.has(left + offset)) || jumps.slice(left + 1, right + 1).reduce<number>((sum, jump) => sum + jump, 0) !== 1)
					continue
				const metres = distance(a, b)
				const expected = (a.speed! + b.speed!) / 2
				const speed = metres / seconds
				const direction = bearing(a, b)
				if (distance(points[left - 1]!, a) / (a.time - points[left - 1]!.time) > maxSpeed || distance(b, points[right + 1]!) / (points[right + 1]!.time - b.time) > maxSpeed)
					continue
				if (speed < expected * 0.75 || speed > Math.min(maxSpeed, expected * 1.25) || headingDifference(bearing(points[left - 1]!, a), direction) > 15 || headingDifference(direction, bearing(b, points[right + 1]!)) > 15)
					continue
				best = { left, right, seconds, metres }
			}
		}
		if (!best)
			continue
		for (let index = best.left + 1; index < best.right; index++)
			removed.add(index)
		repairs.push({ estimated: true, start: points[best.left]!.time, end: points[best.right]!.time, removedPoints: best.right - best.left - 1, originalJumpMeters: Math.round(distance(previous, point)), bridgeMeters: Math.round(best.metres), bridgeSeconds: best.seconds })
	}
	return { points: points.filter((_, index) => !removed.has(index)), repairs }
}

function simplify(points: TrackPoint[], tolerance: number): [number, number][] {
	if (points.length < 2)
		return []
	const scale = 6371000 * Math.PI / 180
	const coordinates = points.map(p => [p.lng * scale, p.lat * scale])
	const keep = new Set([0, points.length - 1])
	const pending: [number, number][] = [[0, points.length - 1]]
	while (pending.length) {
		const [start, end] = pending.pop()!
		const [ax, ay] = coordinates[start] as [number, number]
		const [bx, by] = coordinates[end] as [number, number]
		const dx = bx - ax
		const dy = by - ay
		let maximum = tolerance ** 2
		let furthest = -1
		for (let i = start + 1; i < end; i++) {
			const [x, y] = coordinates[i] as [number, number]
			// Longitude metres vary across a long flight; measure error near this point.
			const cosine = Math.cos(points[i]!.lat * Math.PI / 180)
			const localDx = dx * cosine
			const localX = (x - ax) * cosine
			const along = localDx || dy ? Math.max(0, Math.min(1, (localX * localDx + (y - ay) * dy) / (localDx * localDx + dy * dy))) : 0
			const squared = (localX - along * localDx) ** 2 + (y - ay - along * dy) ** 2
			if (squared > maximum) {
				maximum = squared
				furthest = i
			}
		}
		if (furthest >= 0) {
			keep.add(furthest)
			pending.push([start, furthest], [furthest, end])
		}
	}
	return [...keep].sort((a, b) => a - b).map((index) => {
		const point = points[index]!
		return [Number(point.lng.toFixed(6)), Number(point.lat.toFixed(6))]
	})
}

export function buildTravelTracks(points: TrackPoint[], windows: TrackWindow[], { maxGapSeconds = 900, maxSpeed = 400, toleranceMeters = 8, maxPauseDistanceMeters = 25 } = {}) {
	const sorted = points.toSorted((a, b) => a.time - b.time).filter((point, index, all) => !index || point.time !== all[index - 1]!.time)
	const tracks: TravelTrack[] = []
	const report: { chapter: number, day: number, inputPoints: number, removedSpikes: number, rejoinedPauses: number, flightRepairs: FlightRepair[], segments: number, outputPoints: number }[] = []
	for (const window of windows) {
		const start = Date.parse(window.start) / 1000
		const end = Date.parse(window.end) / 1000
		if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end)
			throw new Error(`Invalid chapter window: ${window.chapter}`)
		const windowPoints = sorted.filter(p => p.time >= start && p.time < end)
		const { points: selected, repairs: flightRepairs } = repairFlightJumps(windowPoints, maxSpeed, maxGapSeconds)
		const segments: [number, number][][] = []
		let current: TrackPoint[] = []
		let removedSpikes = 0
		let rejoinedPauses = 0
		const finish = () => {
			const segment = simplify(current, toleranceMeters)
			if (segment.length > 1 && segment.some(p => p[0] !== segment[0]![0] || p[1] !== segment[0]![1]))
				segments.push(segment)
			current = []
		}
		for (let i = 0; i < selected.length; i++) {
			const point = selected[i]!
			const previous = current.at(-1)
			if (previous) {
				const elapsed = point.time - previous.time
				const displacement = distance(previous, point)
				const speed = displacement / elapsed
				const next = selected[i + 1]
				if (elapsed <= maxGapSeconds && speed > maxSpeed && next && next.time - previous.time <= maxGapSeconds && distance(previous, next) / (next.time - previous.time) <= maxSpeed && distance(point, next) / (next.time - point.time) > maxSpeed) {
					removedSpikes++
					continue
				}
				// Arrival and departure near the same stop need no invented long connector.
				// Only join within this chapter, using the two recorded endpoints unchanged.
				if (elapsed > maxGapSeconds && maxPauseDistanceMeters > 0 && displacement <= maxPauseDistanceMeters)
					rejoinedPauses++
				else if (elapsed > maxGapSeconds || speed > maxSpeed)
					finish()
			}
			current.push(point)
		}
		finish()
		tracks.push({ chapter: window.chapter, day: window.day, segments })
		report.push({ chapter: window.chapter, day: window.day, inputPoints: windowPoints.length, removedSpikes, rejoinedPauses, flightRepairs, segments: segments.length, outputPoints: segments.reduce((sum, segment) => sum + segment.length, 0) })
	}
	return { tracks, report }
}
