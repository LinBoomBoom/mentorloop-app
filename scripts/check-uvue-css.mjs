/**
 * uvue 护栏静态检查（样式 + 组件事件）
 *
 * 一、样式（硬闸）：uni-app x 原生 App 端不支持 gap / gap-x-* / gap-y-* / space-x-* / space-y-*，
 * 这些类在真机上会静默失效，导致布局错乱。vite.config.ts 里已把 uvueUnsupported 设为 'error'
 * （编译期拦截），本脚本作为提交前 / CI 的第二道闸门。
 *
 * 二、组件事件（提醒不拦截）：`<ml-button>` 声明 defineEmits(['tap'])，只对外发 tap；
 * 页面写 `@click` 拿不到该事件，表现为「按钮点了没反应」（2026-10-16 真机确认，全仓曾 18 处）。
 * 按 SOP-05 §7.2 新检查须先以「提醒不拦截」入链，故本条只告警、不阻断，观察后再评估升硬闸。
 *
 * 用法：node scripts/check-uvue-css.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'unpackage',
  'dist',
  '.temp',
  'static',
  'coverage'
])

// 命中的正则：class 属性里出现的受限原子类
const RULES = [
  { re: /\bclass="[^"]*\bgap(-[xypsteblrt])?-\d/, name: 'gap-*' },
  { re: /\bclass="[^"]*\bspace-[xy]-\d/, name: 'space-x-* / space-y-*' },
  // uvue 样式不继承：容器上写 text-* / font-* 对 <text> 无效是常见误用，仅提示不阻断
  { re: /\bclass="[^"]*\bbg-gradient-to-/, name: '渐变（原生端不支持）' }
]

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, acc)
    else if (full.endsWith('.uvue')) acc.push(full)
  }
  return acc
}

const files = walk(ROOT)
const problems = []

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  src.split(/\r?\n/).forEach((line, idx) => {
    for (const rule of RULES) {
      if (rule.re.test(line)) {
        problems.push({
          file: relative(ROOT, file),
          line: idx + 1,
          text: line.trim().slice(0, 120),
          name: rule.name
        })
      }
    }
  })
}

// ── 组件事件规则（提醒不拦截，SOP-05 §7.2 观察期）──────────────────────────
// ml-button 只对外发 tap：写 @click 在真机上点了没反应（构建 / lint / typecheck 均不报错）
const eventWarnings = []
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const tagRe = /<ml-button[\s\S]*?>/g
  let m = tagRe.exec(src)
  while (m !== null) {
    if (/@click\s*=/.test(m[0])) {
      eventWarnings.push({
        file: relative(ROOT, file),
        line: src.slice(0, m.index).split(/\r?\n/).length
      })
    }
    m = tagRe.exec(src)
  }
}

if (problems.length > 0) {
  console.error('\n[uvue-css] 检测到 uni-app x 原生端不支持的原子类：\n')
  for (const p of problems) {
    console.error(`  ${p.file}:${p.line}  ->  ${p.name}`)
    console.error(`    ${p.text}\n`)
  }
  console.error('请改用显式 mt-* / ml-*（垂直间距用 mt-*，水平间距用 ml-*）。\n')
  process.exit(1)
}

if (eventWarnings.length > 0) {
  console.warn(
    '\n[uvue-events] 提醒：<ml-button> 上用了 @click —— 该组件只发 tap，真机点了没反应（不阻断）：\n'
  )
  for (const w of eventWarnings) console.warn(`  ${w.file}:${w.line}`)
  console.warn('\n请改为 @tap="handler"。\n')
}

console.log(
  `[uvue-css] OK — 已检查 ${files.length} 个 .uvue 文件，未发现受限原子类（组件事件提醒 ${eventWarnings.length} 条）。`
)
