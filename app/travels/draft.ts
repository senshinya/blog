export function isTravelDraftSource(source: string) {
	return /^draft:[ \t]*true[ \t]*(?:#.*)?\r?$/m.test(source)
}

export function getVisibleTravels<T extends { draft?: boolean }>(travels: T[], isDev: boolean) {
	return isDev ? travels : travels.filter(travel => !travel.draft)
}
