export type TravelSnapKind = 'cover' | 'chapter' | 'photo'

export interface TravelSnapRange {
	start: number
	end: number
	kind?: TravelSnapKind
}

interface SnapProfile {
	radius: number
	strength: number
	commit: number
}

export interface TravelSnapField {
	stops: number[]
	ranges: TravelSnapRange[]
	kinds: (TravelSnapKind | undefined)[]
	profiles: SnapProfile[]
	free: TravelSnapRange[]
	max: number
	viewport: number
	asymmetric: boolean
}

function snapProfile(kind: TravelSnapKind | undefined, viewport: number, asymmetric: boolean): SnapProfile {
	if (kind === 'chapter')
		return { radius: Math.max(80, Math.min(120, viewport * 0.12)), strength: 0.38, commit: asymmetric ? Math.max(36, Math.min(72, viewport * 0.06)) : Math.max(52, Math.min(84, viewport * 0.08)) }
	if (asymmetric && kind === 'photo')
		return { radius: Math.max(170, Math.min(280, viewport * 0.3)), strength: 0.88, commit: Math.max(40, Math.min(72, viewport * 0.06)) }
	if (asymmetric)
		return { radius: Math.max(100, Math.min(210, viewport * 0.23)), strength: 0.86, commit: Math.max(40, Math.min(70, viewport * 0.06)) }
	if (kind === 'photo')
		return { radius: Math.max(170, Math.min(280, viewport * 0.3)), strength: 0.88, commit: Math.max(164, Math.min(310, viewport * 0.31)) }
	return { radius: Math.max(100, Math.min(210, viewport * 0.23)), strength: 0.86, commit: Math.max(64, Math.min(160, viewport * 0.18)) }
}

export function createSnapField(ranges: TravelSnapRange[], footer: number, max: number, viewport: number, asymmetric = false): TravelSnapField {
	const clamp = (point: number) => Math.max(0, Math.min(max, point))
	const stops = [...new Set([...ranges.flatMap(range => range.end - range.start > 8 ? [range.start, range.end] : [range.start]), footer].map(clamp))].sort((a, b) => a - b)
	const types = new Map<number, TravelSnapKind | undefined>()
	for (const range of ranges) {
		types.set(clamp(range.start), range.kind)
		if (range.end - range.start > 8)
			types.set(clamp(range.end), range.kind)
	}
	return {
		stops,
		ranges,
		kinds: stops.map(point => types.get(point)),
		profiles: stops.map(point => snapProfile(types.get(point), viewport, asymmetric)),
		free: ranges.filter(range => range.end - range.start > 8),
		max,
		viewport,
		asymmetric,
	}
}

function boundaryProfile(field: TravelSnapField, index: number, neighborIndex: number): SnapProfile {
	const a = field.kinds[index]
	const b = field.kinds[neighborIndex]
	if ((a === 'photo' && b === 'chapter') || (a === 'chapter' && b === 'photo'))
		return { radius: Math.max(60, Math.min(90, field.viewport * 0.085)), strength: 0.16, commit: Math.max(18, Math.min(32, field.viewport * 0.03)) }
	return field.profiles[index]!
}

function freeScrollPosition(value: number, field: TravelSnapField): boolean {
	return field.free.some(range => value >= range.start && value <= range.end)
}

function pullToAnchor(value: number, anchor: number, radius: number, strength: number): number {
	const distance = value - anchor
	if (radius < 1 || Math.abs(distance) >= radius)
		return value
	const t = Math.abs(distance) / radius
	return anchor + distance * (1 - strength * (1 - t) ** 2)
}

export function magneticScrollPosition(value: number, field: TravelSnapField, origin?: number): number {
	const y = Math.max(0, Math.min(field.max, value))
	if (freeScrollPosition(y, field))
		return y
	const sourceIndex = field.asymmetric && origin !== undefined ? field.stops.findIndex(point => Math.abs(point - origin) < 0.5) : -1
	if (sourceIndex >= 0) {
		const source = field.stops[sourceIndex]!
		const direction = Math.sign(y - source)
		const neighborIndex = sourceIndex + direction
		const neighbor = field.stops[neighborIndex]
		if (direction && neighbor !== undefined) {
			const gap = Math.abs(neighbor - source)
			const traveled = Math.abs(y - source)
			if (gap > 1 && traveled <= gap) {
				const departure = boundaryProfile(field, sourceIndex, neighborIndex)
				const radius = Math.min(departure.commit, gap * 0.18)
				// The current stop owns a small departure zone; the neighbor owns the rest.
				// Both curves meet at the same position and slope, in either direction.
				if (traveled <= radius)
					return pullToAnchor(y, source, radius, departure.strength)
				return pullToAnchor(y, neighbor, gap - radius, boundaryProfile(field, neighborIndex, sourceIndex).strength)
			}
		}
	}
	const index = field.stops.reduce((best, point, i) => Math.abs(point - y) < Math.abs(field.stops[best]! - y) ? i : best, 0)
	const anchor = field.stops[index]!
	const distance = y - anchor
	const neighborIndex = distance < 0 ? index - 1 : index + 1
	const neighbor = field.stops[neighborIndex]
	const profile = boundaryProfile(field, index, neighborIndex)
	const radius = neighbor === undefined ? profile.radius : Math.min(profile.radius, Math.abs(neighbor - anchor) * 0.44)
	return pullToAnchor(y, anchor, radius, profile.strength)
}

export function inverseMagneticPosition(position: number, field: TravelSnapField, origin?: number): number {
	const resting = field.stops.find(point => Math.abs(point - position) < 0.5)
	if (resting !== undefined)
		return resting
	let lo = 0
	let hi = field.max
	for (let i = 0; i < 28; i++) {
		const mid = (lo + hi) / 2
		if (magneticScrollPosition(mid, field, origin) < position)
			lo = mid
		else
			hi = mid
	}
	return (lo + hi) / 2
}

export function chooseMagneticSnap(value: number, origin: number, field: TravelSnapField): number | null {
	const y = magneticScrollPosition(value, field, origin)
	if (freeScrollPosition(y, field))
		return null
	let target = field.stops.reduce((best, point) => Math.abs(point - y) < Math.abs(best - y) ? point : best, field.stops[0]!)
	const source = field.ranges.findLast(range => range.start <= origin + 1)
	const direction = Math.sign(value - origin)
	let gateOrigin = origin
	if (source && source.end - source.start > 8) {
		if (direction > 0 && value > source.end)
			gateOrigin = Math.max(origin, source.end)
		else if (direction < 0 && value < source.start)
			gateOrigin = source.start
	}
	const index = field.stops.reduce((best, point, i) => Math.abs(point - gateOrigin) < Math.abs(field.stops[best]! - gateOrigin) ? i : best, 0)
	const anchor = field.stops[index]!
	const commit = boundaryProfile(field, index, index + direction).commit
	if (Math.abs(value - gateOrigin) >= commit && direction * (target - anchor) < 1) {
		const next = direction > 0 ? field.stops.find(point => point > anchor + 1) : [...field.stops].reverse().find(point => point < anchor - 1)
		if (next !== undefined)
			target = next
	}
	return target
}

/** Exponential input smoothing with the same response at different refresh rates. */
export function smoothTravelScrollPosition(position: number, target: number, elapsedMs: number, responseMs = 65): number {
	return position + (target - position) * (1 - Math.exp(-Math.max(0, elapsedMs) / Math.max(1, responseMs)))
}
