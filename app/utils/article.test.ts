import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
// eslint-disable-next-line test/no-import-node-test -- Use the project's built-in Node test runner.
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { orderBy } from 'es-toolkit/array'
import { computed, ref, toValue } from 'vue'

function source(path: string) {
	return stripTypeScriptTypes(readFileSync(new URL(path, import.meta.url), 'utf8')
		.replace(/^import .*\n/gm, '')
		.replace(/^export /gm, ''))
}

test('article and preview lists query only the requested language collection', () => {
	for (const locale of ['zh', 'en', 'ja']) {
		for (const path of ['posts/%', 'previews/%']) {
			const collection = `content_${locale}`
			const rows = [{ path: '/daily/example', title: locale }]
			let selected: string[] = []
			const query = {
				where(field: string, operator: string, pattern: string) {
					assert.deepEqual([field, operator, pattern], ['stem', 'LIKE', path])
					return query
				},
				select(...fields: string[]) {
					selected = fields
					return query
				},
				all: () => rows,
			}
			const result = runInNewContext(`${source('./article.ts')}\nqueryArticleIndex(collection, path)`, {
				collection,
				path,
				queryCollection: (name: string) => {
					assert.equal(name, collection)
					return query
				},
			})
			assert.equal(result, rows)
			assert.ok(selected.includes('date'))
			assert.ok(selected.includes('path'))
			assert.ok(!selected.includes('updated'), 'The local content schema has no updated field')
		}
	}
})

test('article sorting stays reactive and newest-first without mutating the source list', () => {
	const list = ref([
		{ path: '/old', date: '2024-01-01' },
		{ path: '/new', date: '2026-01-01' },
	])
	const { listSorted } = runInNewContext(`${source('../composables/useArticleSort.ts')}\nuseArticleSort(list)`, {
		list,
		computed,
		toValue,
		orderBy,
	})
	assert.deepEqual(listSorted.value.map((item: { path: string }) => item.path), ['/new', '/old'])
	assert.deepEqual(list.value.map(item => item.path), ['/old', '/new'])
	list.value.push({ path: '/latest', date: '2026-09-01' })
	assert.equal(listSorted.value[0].path, '/latest')
})
