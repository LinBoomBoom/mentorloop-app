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
  getCurrentPages: 'readonly',
  UniInputEvent: 'readonly',
  UniSystemInfo: 'readonly',
  OnLoadOption: 'readonly'
}

// ---------- 本地规则：.uvue 静态属性误写表达式 ----------
// 背景：`label="'项目经历 ' + parsed.projects + ' 段'"` 这类写法缺 `:` 前缀，
// Vue 不解析其中的表达式，会把整段当字面字符串传给组件（渲染出表达式文本）。
// 该写法在本仓仅出现过一次（2026-10-14 修复），此规则用于防止复发。
//
// 判定方式：把静态属性的值按 JS 表达式解析（typescript-eslint 的 parseForESLint），
// 再按 AST 判断“像代码”的形状，而非字符串匹配，因此能覆盖无引号场景（如 `a + b`）。
// 排除项（真静态值，避免误报）：
//   1. 解析失败 → 视为普通文本（含 `#EEF1FF`、`88rpx`、`flex-row items-center`、URL、中文句子）；
//   2. 纯字面量 / 纯标识符 → 静态值常态（`primary`、`16`、`解析结果`）；
//   3. 连字符减法（`ml-tag`、`w-1.5`）与 CSS 值函数（`rgba(...)`、`linear-gradient(...)`）。
const CSS_VALUE_FUNCS = new Set([
  'rgba',
  'rgb',
  'hsla',
  'hsl',
  'var',
  'calc',
  'url',
  'min',
  'max',
  'clamp',
  'linear-gradient',
  'radial-gradient',
  'translate',
  'translateX',
  'translateY',
  'scale',
  'rotate',
  'cubic-bezier'
])

/** 形状上“像表达式”的节点类型 */
const EXPRESSION_LIKE = new Set([
  'ConditionalExpression',
  'LogicalExpression',
  'TemplateLiteral',
  'SequenceExpression',
  'AssignmentExpression',
  'ArrowFunctionExpression',
  'FunctionExpression',
  'ArrayExpression',
  'ObjectExpression',
  'MemberExpression',
  'CallExpression',
  'NewExpression',
  'TaggedTemplateExpression',
  'AwaitExpression',
  'UpdateExpression'
])

function walkAst(node, visit) {
  if (node == null || typeof node.type !== 'string') return
  visit(node)
  for (const key of Object.keys(node)) {
    if (key === 'parent') continue
    const child = node[key]
    if (Array.isArray(child)) {
      for (const item of child) walkAst(item, visit)
    } else {
      walkAst(child, visit)
    }
  }
}

/** 值文本是否是一个“忘了加 : 前缀”的表达式 */
function looksLikeExpression(raw) {
  // 整个值被引号包起来（静态属性无需引号，多半是误写）→ 例如 label="'已填'"
  if (/^(['"])[\s\S]*\1$/.test(raw.trim())) return true
  let ast
  try {
    ast = tseslint.parser.parseForESLint(`(${raw})`, {
      ecmaVersion: 'latest',
      sourceType: 'module'
    }).ast
  } catch {
    return false // 解析失败 → 普通静态文本
  }
  const stmt = ast.body[0]
  if (stmt == null || stmt.type !== 'ExpressionStatement') return false
  const expr = stmt.expression
  if (expr == null) return false
  // 纯字面量 / 纯标识符：静态值常态
  if (expr.type === 'Literal' || expr.type === 'Identifier') return false

  let hit = false
  walkAst(expr, (node) => {
    if (hit) return
    if (node.type === 'BinaryExpression') {
      if (node.operator === '+') hit = true // 字符串拼接；减法是连字符值，忽略
      return
    }
    if (node.type === 'CallExpression') {
      const callee = node.callee
      const name = callee != null && callee.type === 'Identifier' ? callee.name : ''
      if (CSS_VALUE_FUNCS.has(name)) return // rgba(...) 等静态 CSS 值
      hit = true
      return
    }
    if (EXPRESSION_LIKE.has(node.type)) hit = true
  })
  return hit
}

const uvueLocalPlugin = {
  rules: {
    'no-expression-in-static-attr': {
      meta: {
        type: 'problem',
        docs: {
          description: '禁止在 .uvue 静态属性中写表达式（应使用 : 绑定）'
        },
        messages: {
          staticAttrExpression:
            '静态属性「{{name}}」的值是一个表达式但缺少 : 前缀，会被当作字面字符串渲染；请改为 :{{name}}="..."。'
        },
        schema: []
      },
      create(context) {
        const sourceCode = context.sourceCode ?? context.getSourceCode()
        const services = sourceCode.parserServices
        if (services == null || typeof services.defineTemplateBodyVisitor !== 'function') return {}
        return services.defineTemplateBodyVisitor({
          VAttribute(node) {
            if (node.directive) return // :prop / v-bind 已是绑定属性
            if (node.value == null) return
            const raw = node.value.value
            if (typeof raw !== 'string' || raw.length === 0) return
            if (!looksLikeExpression(raw)) return
            context.report({
              node,
              messageId: 'staticAttrExpression',
              data: { name: node.key.name }
            })
          }
        })
      }
    }
  }
}

export default [
  {
    ignores: [
      'node_modules/**',
      'unpackage/**',
      'dist/**',
      '**/dist/**',
      '.temp/**',
      'static/**',
      'coverage/**',
      'env.d.ts',
      // UTS 原生层（Kotlin/Swift）由 HBuilderX 编译，本地 JS 工具链不解析（编译验证归 P3-14）
      'utssdk/*/app-android/**',
      'utssdk/*/app-ios/**',
      // 多端 UI 学习手册：自包含 HTML 交付物 + 第三方/压缩 JS，非仓库源码
      'multi-platform-ui-handbook/**'
    ]
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
    plugins: { uvue: uvueLocalPlugin },
    rules: {
      // 蒸汽模式 / uvue 约束
      'vue/multi-word-component-names': 'off',
      // 静态属性不得承载拼接表达式（缺 : 会原样渲染），本地规则
      'uvue/no-expression-in-static-attr': 'error',
      // uvue 样式不继承，文字必须用 <text> 包裹并单独设置样式
      'vue/no-v-text': 'error',
      // uvue 脚本即 UTS，uni API 回调常需 any（与 .uts 块同口径）
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      // 格式类规则交给 Prettier（README：ESLint 与 Prettier 分工，避免规则冲突）
      'vue/singleline-html-element-content-newline': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/html-self-closing': 'off',
      'vue/attributes-order': 'off',
      // 长行换行由 Prettier 决断，二者冲突时以 Prettier 为准（与 lint-staged 顺序一致）
      'vue/multiline-html-element-content-newline': 'off',
      'vue/html-closing-bracket-newline': 'off'
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
      '@typescript-eslint/no-explicit-any': 'off',
      // mock / 契约占位参数以 _ 前缀豁免
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ]
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
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ]
    }
  },

  {
    files: ['**/*.uvue', '**/*.uts'],
    rules: { 'no-console': 'off' }
  }
]
