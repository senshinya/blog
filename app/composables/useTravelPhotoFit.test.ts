import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
// eslint-disable-next-line test/no-import-node-test -- Use the repository's Node test runner.
import test from 'node:test'
import vm from 'node:vm'

function harness(maximum = '720px') {
	const frames = new Map<number, () => void>()
	let id = 0
	let resize = () => {}
	let dispose = () => {}
	let limit = ''
	const viewport = { clientHeight: 582, clientWidth: 1874 }
	const caption = { offsetHeight: 160 }
	const paper = { style: {
		getPropertyValue: () => limit,
		setProperty: (_key: string, value: string) => { limit = value },
		removeProperty: () => { limit = '' },
	} }
	const figure = { querySelector: (selector: string) => selector === '.photo-open' ? paper : caption }
	const layout = { display: 'grid', gridTemplateColumns: '493px 322px', rowGap: '28px', paddingTop: '26px', paddingBottom: '26px' }
	const win = {
		requestAnimationFrame(callback: () => void) {
			frames.set(++id, callback)
			return id
		},
		cancelAnimationFrame(key: number) { frames.delete(key) },
		getComputedStyle(target: unknown) {
			if (target === figure)
				return layout
			if (target === caption)
				return { marginTop: '22px', marginBottom: '0px' }
			return { paddingTop: '4px', paddingBottom: '4px', borderTopWidth: '1px', borderBottomWidth: '1px', getPropertyValue: (key: string) => key === '--photo-max-height' ? maximum : '1' }
		},
		ResizeObserver: class {
			constructor(callback: () => void) { resize = callback }
			observe() {}
			disconnect() { resize = () => {} }
		},
	}
	const root = { value: { ownerDocument: { defaultView: win }, querySelector: () => viewport, querySelectorAll: () => [figure] } }
	const source = stripTypeScriptTypes(readFileSync(new URL('./useTravelPhotoFit.ts', import.meta.url), 'utf8')).replace(/^import .*$/gm, '').replace('export function', 'function')
	vm.runInNewContext(`${source}\nuseTravelPhotoFit(root, { value: [] })`, {
		watch: (_source: unknown, callback: () => void) => { callback() },
		onScopeDispose: (callback: () => void) => { dispose = callback },
		root,
	})
	const flush = () => {
		const pending = [...frames.values()]
		frames.clear()
		pending.forEach(callback => callback())
	}
	flush()
	return { viewport, caption, layout, frames, flush, resize: () => resize(), dispose: () => dispose(), height: () => Number.parseFloat(limit) }
}

test('portrait paper fits a short desktop viewport including page padding and tilt clearance', () => {
	const h = harness()
	assert.ok(h.height() > 400)
	assert.ok(h.height() + 10 + 52 + 24 <= h.viewport.clientHeight)
	h.viewport.clientHeight = 1000
	h.resize()
	h.flush()
	assert.equal(h.height(), 720)
})

test('stacked photo pages reserve actual caption height and reflow when the text changes', () => {
	const h = harness()
	h.layout.gridTemplateColumns = '600px'
	h.resize()
	h.flush()
	assert.ok(h.height() + 10 + 52 + 24 + 160 + 22 + 28 <= h.viewport.clientHeight)
	const previous = h.height()
	h.caption.offsetHeight += 80
	h.resize()
	h.flush()
	assert.equal(h.height(), previous - 80)
})

test('resize notifications batch into one frame and disposal cancels pending layout work', () => {
	const h = harness()
	h.resize()
	h.resize()
	assert.equal(h.frames.size, 1)
	h.dispose()
	assert.equal(h.frames.size, 0)
	h.flush()
	h.resize()
	assert.equal(h.frames.size, 0)
})

test('uncapped mobile photos use the remaining page height and still reserve long captions', () => {
	const h = harness('none')
	h.layout.display = 'grid'
	h.layout.gridTemplateColumns = '335px'
	h.layout.rowGap = '20px'
	h.layout.paddingTop = '24px'
	h.layout.paddingBottom = '24px'
	h.viewport.clientWidth = 375
	h.viewport.clientHeight = 1100
	h.resize()
	h.flush()
	assert.equal(h.height(), 816)
	h.viewport.clientHeight = 682
	h.caption.offsetHeight = 325
	h.resize()
	h.flush()
	assert.equal(h.height(), 233)
	assert.ok(h.height() + 10 + 48 + 24 + 325 + 22 + 20 <= h.viewport.clientHeight)
})
