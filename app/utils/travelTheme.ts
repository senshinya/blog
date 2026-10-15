export type TravelPalette = 'mono' | 'paper' | 'moss' | 'mist' | 'rose'
export type TravelAppearance = 'system' | 'light' | 'dark'
export type TravelTheme = 'light' | 'dark'

export const travelPalettes = {
	mono: { paper: '#f5f5f7', accent: '#a4513e', muted: '#777777', darkPaper: '#1d1d1f', darkAccent: '#dc9a78', darkMuted: '#888888' },
	paper: { paper: '#f7f4ec', accent: '#a4513e', muted: '#998b76', darkPaper: '#302c28', darkAccent: '#dc9a78', darkMuted: '#a49987' },
	moss: { paper: '#f1f5ec', accent: '#4e7157', muted: '#81917b', darkPaper: '#222e27', darkAccent: '#a2bf90', darkMuted: '#96aa94' },
	mist: { paper: '#eef3f7', accent: '#4d7291', muted: '#8294a0', darkPaper: '#252d36', darkAccent: '#8eb6d0', darkMuted: '#98aaba' },
	rose: { paper: '#f8f0ef', accent: '#93636d', muted: '#a18b8f', darkPaper: '#33282d', darkAccent: '#d8a0b0', darkMuted: '#b7a0a6' },
} as const

export function normalizeTravelPalette(value: unknown): TravelPalette {
	return typeof value === 'string' && Object.hasOwn(travelPalettes, value) ? value as TravelPalette : 'mono'
}
export function normalizeTravelAppearance(value: unknown): TravelAppearance {
	return value === 'light' || value === 'dark' ? value : 'system'
}
export function travelMapColors(palette: TravelPalette, theme: TravelTheme) {
	const colors = travelPalettes[palette]
	return theme === 'dark'
		? { paper: colors.darkPaper, accent: colors.darkAccent, muted: '#9a9a9a', track: '#8ca2b2' }
		: { paper: colors.paper, accent: colors.accent, muted: '#777777', track: '#637f91' }
}
/** Neutralize only basemap colors; photographs and selection layers keep their accents. */
export function neutralTravelPaint(value: unknown): unknown {
	if (Array.isArray(value))
		return value.map(neutralTravelPaint)
	if (value && typeof value === 'object')
		return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, neutralTravelPaint(item)]))
	if (typeof value !== 'string')
		return value
	let channels: number[] | undefined
	if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
		const hex = value.length === 4 ? [...value.slice(1)].map(c => c + c).join('') : value.slice(1)
		channels = [0, 2, 4].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16))
	}
	else if (/^rgba?\(/i.test(value)) {
		channels = value.slice(value.indexOf('(') + 1, -1).split(',').map(Number)
	}
	if (!channels || channels.length < 3 || channels.some(channel => !Number.isFinite(channel)))
		return value
	const gray = Math.round(channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722)
	return `rgba(${gray},${gray},${gray},${channels[3] ?? 1})`
}
