/**
 * uvue 不支持的 Tailwind 原子类静态检查
 *
 * 背景：uni-app x 原生 App 端不支持 gap / gap-x-* / gap-y-* / space-x-* / space-y-*，
 * 这些类在真机上会静默失效，导致布局错乱。
 * vite.config.ts 里已把 uvueUnsupported 设为 'error'（编译期拦截），
 * 本脚本作为提交前 / CI 的第二道闸门，在写入阶段就拦住。
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

if (problems.length > 0) {
  console.error('\n[uvue-css] 检测到 uni-app x 原生端不支持的原子类：\n')
  for (const p of problems) {
    console.error(`  ${p.file}:${p.line}  ->  ${p.name}`)
    console.error(`    ${p.text}\n`)
  }
  console.error('请改用显式 mt-* / ml-*（垂直间距用 mt-*，水平间距用 ml-*）。\n')
  process.exit(1)
}

console.log(`[uvue-css] OK — 已检查 ${files.length} 个 .uvue 文件，未发现受限原子类。`)
