import js from '@eslint/js'
import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import vueParser from 'vue-eslint-parser'

// ESLint 9 flat config
// 说明：uni-app x 的页面/组件后缀是 .uvue，脚本语言是 uts，
// 这里通过 vue-eslint-parser + extraFileExtensions 让 Vue SFC 规则作用于 .uvue。

const uniGlobals = {
  uni: 'readonly',
  uniCloud: 'readonly',
  wx: 'readonly',
  getApp: 'readonly',
  getCurrentPages: 'readonly'
}

export default [
  {
    ignores: ['node_modules/**', 'unpackage/**', 'dist/**', '.temp/**', 'static/**', 'coverage/**']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  // ---------- .uvue（uni-app x 页面与组件）----------
  {
    files: ['**/*.uvue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.uvue'],
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      globals: { ...globals.browser, ...globals.node, ...uniGlobals }
    },
    rules: {
      // 蒸汽模式 / uvue 约束
      'vue/multi-word-component-names': 'off',
      // uvue 样式不继承，文字必须用 <text> 包裹并单独设置样式
      'vue/no-v-text': 'error'
    }
  },

  // ---------- .uts（UTS 强类型脚本）----------
  {
    files: ['**/*.uts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      globals: { ...globals.browser, ...globals.node, ...uniGlobals }
    },
    rules: {
      // UTS 不支持 interface 定义对象类型，必须用 type（uts_diff_ts 文档）
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSInterfaceDeclaration',
          message: 'UTS 不支持 interface 声明对象类型，请改用 type 命名对象类型。'
        }
      ],
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },

  // ---------- 构建配置 / 脚本 ----------
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off'
    }
  },

  {
    files: ['**/*.uvue', '**/*.uts'],
    rules: { 'no-console': 'off' }
  }
]
