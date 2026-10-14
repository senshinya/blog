import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
// eslint-disable-next-line test/no-import-node-test -- Use the repository's Node test runner.
import test from 'node:test'
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript'

const fixture = {
	'https://example.com/photo.jpg': { w: 1600, h: 900, lqip: '986cc921' },
	'https://example.com/cover.png': { w: 1619, h: 971, lqip: '986cc921', transparent: true },
}
const source = readFileSync(new URL('./img.ts', import.meta.url), 'utf8')
	.replace('import imageMeta from \'~/assets/image-meta.json\'', `const imageMeta = ${JSON.stringify(fixture)}`)
const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ESNext } }).outputText
const { getImgMeta, getLqipStyle } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

test('transparent images reserve their dimensions without an opaque placeholder background', () => {
	assert.equal(getLqipStyle('https://example.com/cover.png'), undefined)
	assert.equal(getImgMeta('https://example.com/cover.png').w, 1619)
	assert.equal(getImgMeta('https://example.com/cover.png').h, 971)
})

test('opaque images retain their color placeholder and unknown images have no placeholder', () => {
	assert.deepEqual(getLqipStyle('https://example.com/photo.jpg'), { '--lqip': '#986cc921' })
	assert.equal(getLqipStyle('https://example.com/missing.png'), undefined)
})
