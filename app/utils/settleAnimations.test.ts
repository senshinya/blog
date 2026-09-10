import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test -- Use the project's built-in Node test runner.
import test from 'node:test'

function animation(endTime: number) {
	let resolve!: () => void
	let reject!: (reason: Error) => void
	const finished = new Promise<void>((ok, fail) => {
		resolve = ok
		reject = fail
	})
	return { value: { finished, effect: { getComputedTiming: () => ({ endTime }) } } as unknown as Animation, resolve, reject }
}

test('waits for the capsule and its children before allowing a page snapshot', async () => {
	const { settleAnimations } = await import('./settleAnimations.ts')
	const width = animation(420)
	const label = animation(250)
	let ready = false
	const waiting = settleAnimations({ getAnimations: (options) => {
		assert.deepEqual(options, { subtree: true })
		return [width.value, label.value]
	} }).then(() => { ready = true })
	label.resolve()
	await Promise.resolve()
	assert.equal(ready, false)
	width.resolve()
	await waiting
	assert.equal(ready, true)
})

test('a cancelled transition does not prevent language navigation', async () => {
	const { settleAnimations } = await import('./settleAnimations.ts')
	const cancelled = animation(420)
	const waiting = settleAnimations({ getAnimations: () => [cancelled.value] })
	cancelled.reject(new Error('Animation cancelled'))
	await assert.doesNotReject(waiting)
})

test('reduced motion and infinite decorations add no waiting', async () => {
	const { settleAnimations } = await import('./settleAnimations.ts')
	await settleAnimations(null)
	await settleAnimations({ getAnimations: () => [] })
	await settleAnimations({ getAnimations: () => [animation(Infinity).value] })
})

test('bounds the remaining close animation without slowing an almost finished transition', async () => {
	const { settleAnimations } = await import('./settleAnimations.ts')
	const rates: number[] = []
	const animations = [
		{ endTime: 420, currentTime: 0 },
		{ endTime: 400, currentTime: 330 },
	].map(({ endTime, currentTime }) => ({
		currentTime,
		playbackRate: 1,
		finished: Promise.resolve(),
		effect: { getComputedTiming: () => ({ endTime }) },
		updatePlaybackRate: (rate: number) => rates.push(rate),
	}) as unknown as Animation)
	await settleAnimations({ getAnimations: () => animations }, 140)
	assert.deepEqual(rates, [3])
})
