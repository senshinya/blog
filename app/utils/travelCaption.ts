interface CaptionPart { text: string, href?: string }

export function travelCaptionParts(text: string): CaptionPart[] {
	const parts: CaptionPart[] = []
	let cursor = 0
	for (const match of text.matchAll(/https?:\/\/[^\s<>"'，。！？、；：（）【】]+/g)) {
		const href = match[0].replace(/[.,!?;:]+$/, '')
		try {
			if (!new URL(href).hostname)
				continue
		}
		catch { continue }
		if (match.index > cursor)
			parts.push({ text: text.slice(cursor, match.index) })
		parts.push({ text: href, href })
		cursor = match.index + href.length
	}
	if (cursor < text.length)
		parts.push({ text: text.slice(cursor) })
	return parts
}
