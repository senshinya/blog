import { getFixedDelay } from '~/utils/anim'

/** Written by 02.entrance.global.ts before the new page is mounted. */
export const ENTRANCE_SKIP_KEY = 'entrance:skip'

/**
 * Locale motion owns this transition; replaying card entrances would double it.
 * Snapshot the flag so resetting navigation state cannot restart CSS animations.
 * Keep --delay unchanged because hover transitions also use it.
 */
export function useEntranceDelay() {
	const skip = useState<boolean>(ENTRANCE_SKIP_KEY, () => false).value
	return (seconds: number) => skip ? { '--entrance': 'none' } : getFixedDelay(seconds)
}
