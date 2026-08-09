import antfu from '@antfu/eslint-config'

export default antfu({
	ignores: ['*.yaml'],
	stylistic: {
		indent: 'tab',
	},
	pnpm: true,
	// @keep-sorted
	rules: {
		'jsonc/indent': ['error', 2],
		'vue/block-lang': ['warn', {
			script: { lang: ['ts', 'tsx'] },
			style: { lang: ['scss'] },
		}],
		'vue/enforce-style-attribute': ['warn', {
			allow: ['scoped'],
		}],
		'vue/html-indent': ['error', 'tab', { baseIndent: 0 }],
		'yaml/indent': ['error', 2],
	},
}, {
	files: ['app/pages/**/*.vue'],
	rules: {
		'vue/valid-v-slot': 'off',
	},
}, {
	files: ['**/*.json'],
	ignores: ['content/**'],
	rules: {
		'style/eol-last': ['warn', 'never'],
	},
}, {
	// 只匹配 markdown processor 抽出的 JSON 代码块虚拟文件。
	// 不能写成 content/**：md 文件本体走 @eslint/markdown 的 language 模式，
	// SourceCode 没有 parserServices，jsonc 规则的守卫会直接抛 TypeError
	files: ['content/**/*.md/**/*.json'],
	rules: {
		'jsonc/comma-dangle': ['warn', 'always'],
	},
}, {
	files: ['content/**'],
	// @keep-sorted
	rules: {
		'antfu/consistent-list-newline': 'off',
		'eqeqeq': 'off',
		'no-irregular-whitespace': 'off',
		'no-sequences': 'off',
		'prefer-arrow-callback': 'off',
		'prefer-template': 'off',
		'style/indent': 'off',
		'style/no-mixed-spaces-and-tabs': 'off',
		'style/quotes': 'off',
		'style/semi': 'off',
		'unicorn/prefer-includes': 'off',
	},
})
