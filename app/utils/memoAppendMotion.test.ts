import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Use the project's built-in Node test runner.
import test from 'node:test'
import { startMemoAppendMotion } from './memoAppendMotion.ts'

function createMotion(reducedMotion = false, distance = 400) {
	const running: { target: string, frames: Keyframe[], timing: KeyframeAnimationOptions, cancelled: number, finish: () => void }[] = []
	const element = (target: string, top: number, height: number) => ({
		dataset: {} as Record<string, string>,
		offsetTop: top,
		offsetHeight: height,
		getBoundingClientRect: () => ({ top, bottom: top + height, height }),
		animate: (frames: Keyframe[], timing: KeyframeAnimationOptions) => {
			let finish!: () => void
			let reject!: (reason: Error) => void
			const finished = new Promise<void>((resolve, fail) => {
				finish = resolve
				reject = fail
			})
			const entry = { target, frames, timing, cancelled: 0, finish }
			running.push(entry)
			return {
				finished,
				cancel: () => {
					entry.cancelled++
					reject(new Error('cancelled'))
				},
			}
		},
	})
	const cards = [element('old', 100, 200), element('first', 300, 100), element('second', 420, 280)]
	const list = { ...element('list', 100, 600), children: cards }
	const footer = element('footer', 320 + distance, 30)
	const previousMatchMedia = globalThis.matchMedia
	globalThis.matchMedia = (() => ({ matches: reducedMotion })) as typeof matchMedia
	try {
		const motion = startMemoAppendMotion(list as unknown as HTMLElement, footer as unknown as HTMLElement, { count: 1, height: 200, footerTop: 320 })
		return { motion, running, cards }
	}
	finally {
		globalThis.matchMedia = previousMatchMedia
	}
}

test('divider, list reveal and card entrances share a slower timeline based on card geometry', async () => {
	const { motion, running, cards } = createMotion()
	const [footer, list, first, second] = running
	assert.equal(footer!.timing.duration, 1100)
	for (const animation of running)
		assert.deepEqual(animation.timing, footer!.timing)
	assert.equal(list!.frames[0]!.clipPath, 'inset(0 -2px 400px -2px)')
	assert.equal(first!.frames[1]!.offset, 0, 'first card starts when the divider reaches its top')
	assert.equal(first!.frames[2]!.offset, 0.25)
	assert.equal(second!.frames[1]!.offset, 0.3, 'spacing and different card heights determine entrance timing')
	assert.equal(second!.frames[2]!.offset, 1)
	assert.equal(cards[0]!.dataset.nativeEntered, undefined)
	assert.equal(cards[1]!.dataset.nativeEntered, '')
	running.forEach(animation => animation.finish())
	await motion.finished
	assert.ok(running.every(animation => animation.cancelled === 1), 'finished animations release their fill styles')
})

test('long appended batches get more travel time with a bounded maximum', async () => {
	const medium = createMotion(false, 2400)
	const long = createMotion(false, 6000)
	assert.ok(Number(medium.running[0]!.timing.duration) > 1100)
	assert.equal(long.running[0]!.timing.duration, 2200)
	medium.motion.cancel()
	long.motion.cancel()
	await Promise.all([medium.motion.finished, long.motion.finished])
})

test('cancellation settles every animation and is safe to repeat', async () => {
	const { motion, running } = createMotion()
	motion.cancel()
	motion.cancel()
	await assert.doesNotReject(motion.finished)
	assert.ok(running.every(animation => animation.cancelled === 1))
})

test('reduced motion consumes CSS entrances without creating animations', async () => {
	const { motion, running, cards } = createMotion(true)
	await motion.finished
	assert.equal(running.length, 0)
	assert.equal(cards[1]!.dataset.nativeEntered, '')
})
