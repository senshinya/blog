export interface ReadingHeading {
	id: string
	text: string
	depth: number
	rootId: string
	top: number
	height: number
	ratio: number
}

interface HeadingLink {
	id: string
	text: string
	depth: number
	children?: HeadingLink[]
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Match the reference's article-based progress, excluding comments and footer. */
export function readingPercent(scroll: number, top: number, height: number, viewport: number) {
	if (height <= 0)
		return 0
	return Math.floor(clamp((scroll - top + Math.min(scroll, viewport)) / height * 100, 0, 100))
}

export function flattenReadingHeadings(links: HeadingLink[], rootId?: string): ReadingHeading[] {
	return links.flatMap(link => [
		{ id: link.id, text: link.text, depth: link.depth, rootId: rootId ?? link.id, top: 0, height: 0, ratio: 0 },
		...flattenReadingHeadings(link.children ?? [], rootId ?? link.id),
	])
}

export function activeReadingHeading(headings: ReadingHeading[], scroll: number, viewport: number) {
	return headings.find(heading => heading.top + heading.height > scroll + 100 && heading.top < scroll + viewport - 100)
		?? headings.findLast(heading => heading.top < scroll + 100)
}

/** SVG geometry stays independent of Vue and DOM measurements. All units are pixels. */
export function createReadingRail(height: number, position: number, focus: number, amplitude: number, time = 0) {
	height = Math.max(0, height)
	const y = clamp(position, 0, height)
	const halfLength = Math.max(1, 56 + 2.2 * amplitude)
	const edge = clamp(Math.min(y / halfLength, (height - y) / halfLength), 0, 1)
	const bulge = clamp(focus, 0, 1) * (10.4 + 0.6 * Math.sin(time / 9000 * Math.PI * 2) + amplitude) * edge
	const start = Math.max(0, y - halfLength)
	const end = Math.min(height, y + halfLength)
	const x = 8 + bulge
	return {
		y,
		bulge,
		path: `M8 0 L8 ${start} C8 ${y - halfLength * 0.45},${x} ${y - halfLength * 0.3},${x} ${y} C${x} ${y + halfLength * 0.3},8 ${y + halfLength * 0.45},8 ${end} L8 ${height}`,
		dotX(dotY: number) {
			const distance = Math.abs(dotY - y)
			return distance < halfLength ? 8 + bulge * Math.cos(distance / halfLength * Math.PI / 2) ** 2 : 8
		},
	}
}
