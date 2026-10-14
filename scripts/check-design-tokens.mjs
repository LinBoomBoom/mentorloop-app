#!/usr/bin/env node
/**
 * 设计 token 三载体一致性机检（任务卡 ds-1 §4 #3/#4 · 治理遗留 F4）
 *
 * 三载体（domain-design-sop §2）：main.css @theme（权威）↔ styles/theme.uts ↔ design-system/mentorloop/MASTER.md §A1
 *   检查 A  main.css ↔ theme.uts 名集合双向比对（kebab↔camel 直配，无别名键）
 *   检查 B  同名 token 值一致（trim + 空白折叠 + hex 小写化）
 *   检查 C  MASTER §A1 覆盖：颜色 token 名/通配/hex 三选一 + 非颜色八 token `--名` 字面量
 *   检查 D  .uvue 字号白名单：text-[Npx] 仅允许 12/14/16/18/22/28（§A2 字号阶梯）
 *   检查 E  硬编码 hex 白名单（全 .uvue）：须命中 @theme token 值（亮色族已 token 化，无例外）
 *   检查 F  ml-icon 静态图标名须存在于 ICON_GLYPH（miss 会静默消失）
 *
 * 静态比对，不注册 Tailwind 插件（ds-1 §5 对策）。退出码：0 = 全绿，1 = 存在发现。
 * 用法：node scripts/check-design-tokens.mjs [--root <repoRoot>]
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const args = process.argv.slice(2)
const rootIdx = args.indexOf('--root')
const ROOT = rootIdx >= 0 ? resolve(args[rootIdx + 1]) : resolve(import.meta.dirname, '..')

/** @type {string[]} */
const findings = []
const ok = (msg) => console.log(`✓ ${msg}`)
const fail = (msg) => {
  findings.push(msg)
  console.log(`✗ ${msg}`)
}

const NS = ['color', 'font', 'shadow', 'radius', 'duration', 'ease', 'size']
const FONT_SIZE_WHITELIST = new Set([12, 14, 16, 18, 22, 28])
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'unpackage',
  'dist',
  '.temp',
  'static',
  'coverage'
])

const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
const norm = (v) => v.trim().replace(/\s+/g, ' ').toLowerCase()
const rel = (p) => relative(ROOT, p).split('\\').join('/')

/** 切出 startRe 命中处到下一个行首 `}` 的块 */
function sliceBlock(text, startRe) {
  const m = startRe.exec(text)
  if (!m) return null
  const end = text.indexOf('\n}', m.index)
  return end < 0 ? text.slice(m.index) : text.slice(m.index, end)
}

/** 切出 fromRe 命中小节到 toRe 小节起点 */
function sliceSection(text, fromRe, toRe) {
  const from = text.search(fromRe)
  if (from < 0) return null
  const rest = text.slice(from)
  const to = rest.search(toRe)
  return to < 0 ? rest : rest.slice(0, to)
}

/** 解析 main.css @theme 块：full 后缀名（如 color-ink）→ { full, ns, logical, value } */
function parseMainCss(text) {
  const block = sliceBlock(text, /@theme\s*\{/)
  const tokens = new Map()
  if (!block) return tokens
  const re = /--([a-z][a-z0-9-]*)\s*:\s*([^;]+);/g
  let m
  while ((m = re.exec(block))) {
    const full = m[1]
    const ns = NS.find((n) => full.startsWith(`${n}-`))
    if (!ns) continue
    tokens.set(full, { full, ns, logical: full.slice(ns.length + 1), value: m[2] })
  }
  return tokens
}

/** 解析 uts 对象块条目（兼容双引号值内含单引号，如 fontSans） */
function parseEntries(block) {
  const entries = new Map()
  if (!block) return entries
  const re = /\b([A-Za-z][A-Za-z0-9]*)\s*:\s*(['"])([\s\S]*?)\2/g
  let m
  while ((m = re.exec(block))) entries.set(m[1], m[3])
  return entries
}

function walk(dir, out) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(join(dir, e.name), out)
    } else if (e.name.endsWith('.uvue')) {
      out.push(join(dir, e.name))
    }
  }
}

// ---------- 载体解析 ----------
const cssTokens = parseMainCss(read('main.css'))
const colorByLogical = new Map()
for (const t of cssTokens.values()) if (t.ns === 'color') colorByLogical.set(t.logical, t)

const uts = read('styles/theme.uts')
const themeEntries = parseEntries(sliceBlock(uts, /\bconst\s+THEME\b/))
const dimColor = parseEntries(sliceBlock(uts, /\bconst\s+DIM_COLOR\b/))
const dimTint = parseEntries(sliceBlock(uts, /\bconst\s+DIM_TINT\b/))

if (!cssTokens.size || !themeEntries.size) {
  fail('载体解析失败：main.css @theme 或 theme.uts THEME 块为空')
  console.log(`设计 token 机检不通过：${findings.length} 项发现`)
  process.exit(1)
}

/** theme.uts 键 → main.css token（kebab 直配颜色逻辑名/全后缀名；2026-10-14 F3 别名收敛后无别名键） */
function resolveUtsKey(key) {
  const k = kebab(key)
  return colorByLogical.get(k) ?? cssTokens.get(k) ?? null
}

// ---------- 检查 A：名集合双向比对 ----------
const aBefore = findings.length
/** @type {Set<string>} theme.uts 已覆盖的 main.css full 名 */
const covered = new Set()
for (const key of themeEntries.keys()) {
  const token = resolveUtsKey(key)
  if (token) covered.add(token.full)
  else fail(`检查 A · theme.uts THEME.${key} 在 main.css @theme 无对应 token`)
}
for (const key of dimColor.keys()) {
  const full = `color-dim-${kebab(key)}`
  if (cssTokens.has(full)) covered.add(full)
  else fail(`检查 A · theme.uts DIM_COLOR.${key} 在 main.css 无对应 --${full}`)
}
for (const key of dimTint.keys()) {
  const full = `color-dim-${kebab(key)}-tint`
  if (cssTokens.has(full)) covered.add(full)
  else fail(`检查 A · theme.uts DIM_TINT.${key} 在 main.css 无对应 --${full}`)
}
for (const full of cssTokens.keys()) {
  if (!covered.has(full)) {
    fail(`检查 A · main.css --${full} 未被 theme.uts 覆盖（THEME/DIM_COLOR/DIM_TINT 均无）`)
  }
}
if (findings.length === aBefore) {
  ok(
    `检查 A · 名集合双向比对：main.css ${cssTokens.size} token（${colorByLogical.size} 色 + 非颜色 ${cssTokens.size - colorByLogical.size}）↔ theme.uts（THEME ${themeEntries.size} 键 + DIM ${dimColor.size + dimTint.size} 键）全覆盖`
  )
}

// ---------- 检查 B：同名值一致 ----------
const bBefore = findings.length
let cmpCount = 0
function cmpValue(where, utsValue, token) {
  cmpCount++
  if (norm(utsValue) !== norm(token.value)) {
    fail(
      `检查 B · ${where}「${utsValue.trim()}」与 main.css --${token.full}「${token.value.trim()}」不一致`
    )
  }
}
for (const [key, value] of themeEntries) {
  const token = resolveUtsKey(key)
  if (token) cmpValue(`theme.uts THEME.${key}`, value, token)
}
for (const [key, value] of dimColor) {
  const token = cssTokens.get(`color-dim-${kebab(key)}`)
  if (token) cmpValue(`theme.uts DIM_COLOR.${key}`, value, token)
}
for (const [key, value] of dimTint) {
  const token = cssTokens.get(`color-dim-${kebab(key)}-tint`)
  if (token) cmpValue(`theme.uts DIM_TINT.${key}`, value, token)
}
if (findings.length === bBefore) {
  ok(`检查 B · 同名值一致：${cmpCount} 项比对（trim + 空白折叠 + hex 小写化）零偏差`)
}

// ---------- 检查 C：MASTER §A1 覆盖 ----------
const cBefore = findings.length
const a1 = sliceSection(read('design-system/mentorloop/MASTER.md'), /##\s*A1\./, /##\s*A2\./)
if (!a1) {
  fail('检查 C · MASTER.md 未找到 §A1 小节')
} else {
  const a1Lower = a1.toLowerCase()
  let cName = 0
  let cWild = 0
  let cHex = 0
  for (const t of colorByLogical.values()) {
    const nameHit = new RegExp(`(?<![a-z0-9-])${t.logical}(?![a-z0-9-])`).test(a1)
    const wildHit =
      t.logical.startsWith('dim-') &&
      (t.logical.endsWith('-tint') ? /dim-\*-tint/.test(a1) : /dim-\*(?!-tint)/.test(a1))
    const hex = norm(t.value)
    const hexHit = /^#[0-9a-f]{3,8}$/.test(hex) && a1Lower.includes(hex)
    if (nameHit) cName++
    else if (wildHit) cWild++
    else if (hexHit) cHex++
    else fail(`检查 C · MASTER §A1 缺少颜色 token「${t.logical}」（名/通配/hex 均未命中）`)
  }
  let cLitTotal = 0
  for (const t of cssTokens.values()) {
    if (!['radius', 'duration', 'ease', 'size'].includes(t.ns)) continue // font/shadow 不在 §A1，跳过
    cLitTotal++
    if (!a1.includes(`--${t.full}`))
      fail(`检查 C · MASTER §A1 缺少非颜色 token 声明「--${t.full}」`)
  }
  if (findings.length === cBefore) {
    ok(
      `检查 C · MASTER §A1 覆盖：${colorByLogical.size} 色命中（名 ${cName} / 通配 ${cWild} / hex ${cHex}）+ 非颜色 ${cLitTotal} token 字面量齐全`
    )
  }
}

// ---------- 检查 D：字号白名单 ----------
const dBefore = findings.length
/** @type {string[]} */
const uvueFiles = []
walk(ROOT, uvueFiles)
const sizeRe = /\btext-\[(\d+(?:\.\d+)?)px\]/g
let dHits = 0
for (const file of uvueFiles) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, idx) => {
    sizeRe.lastIndex = 0
    let m
    while ((m = sizeRe.exec(line))) {
      dHits++
      const px = parseFloat(m[1])
      if (!FONT_SIZE_WHITELIST.has(px)) {
        fail(
          `检查 D · ${rel(file)}:${idx + 1} text-[${m[1]}px] 不在字号白名单（12/14/16/18/22/28）`
        )
      }
    }
  })
}
if (findings.length === dBefore) {
  ok(
    `检查 D · 字号白名单：扫描 ${uvueFiles.length} 个 .uvue / ${dHits} 处 text-[Npx]，全部在 12/14/16/18/22/28`
  )
}

// ---------- 检查 E：硬编码 hex 白名单（全 .uvue） ----------
const eBefore = findings.length
/** #RGB → #RRGGBB 并小写化 */
const expandHex = (h) => {
  const s = h.toLowerCase()
  return s.length === 4 ? `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}` : s
}
/** 白名单 = main.css @theme 全部 token 值中的 hex（自动派生，随 token 增减同步） */
const hexWhitelist = new Set()
for (const t of cssTokens.values()) {
  for (const m of String(t.value).matchAll(/#[0-9a-fA-F]{3,8}/g)) hexWhitelist.add(expandHex(m[0]))
}
const hexRe = /#[0-9a-fA-F]{3,8}\b/g
let eHits = 0
for (const file of uvueFiles) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, idx) => {
    hexRe.lastIndex = 0
    let m
    while ((m = hexRe.exec(line))) {
      eHits++
      const h = expandHex(m[0])
      if (!hexWhitelist.has(h)) {
        fail(
          `检查 E · ${rel(file)}:${idx + 1} 硬编码 ${m[0]} 不是 token 值（应经 styles/theme.uts 取 token 值，或先在三载体补 token）`
        )
      }
    }
  })
}
if (findings.length === eBefore) {
  ok(`检查 E · hex 白名单：扫描 ${uvueFiles.length} 个 .uvue / ${eHits} 处 hex，全部命中 token 值`)
}

// ---------- 检查 F：ml-icon 静态图标名存在性 ----------
const fBefore = findings.length
const iconSrc = read('components/ml-icon.uvue')
const iconBlock = sliceBlock(iconSrc, /\bconst\s+ICON_GLYPH\b/)
const iconNames = new Set()
if (iconBlock) {
  const nameRe = /(?:'([^']+)'|([A-Za-z][A-Za-z0-9-]*))\s*:\s*'/g
  let m
  while ((m = nameRe.exec(iconBlock))) iconNames.add(m[1] ?? m[2])
}
if (!iconNames.size) {
  fail('检查 F · 未能从 components/ml-icon.uvue 解析 ICON_GLYPH（键格式变更？）')
} else {
  const useRe = /<ml-icon\b[^>]*?(?<!:)\bname="([^"]+)"/g
  let fHits = 0
  for (const file of uvueFiles) {
    const text = readFileSync(file, 'utf8')
    useRe.lastIndex = 0
    let m
    while ((m = useRe.exec(text))) {
      fHits++
      if (!iconNames.has(m[1])) {
        const line = text.slice(0, m.index).split('\n').length
        fail(
          `检查 F · ${rel(file)}:${line} ml-icon name="${m[1]}" 不在 ICON_GLYPH（图标将静默消失）`
        )
      }
    }
  }
  if (findings.length === fBefore) {
    ok(`检查 F · 图标名：ICON_GLYPH ${iconNames.size} 个 / 静态引用 ${fHits} 处全部命中`)
  }
}

// ---------- 汇总 ----------
console.log('')
if (findings.length === 0) {
  console.log('设计 token 机检全绿：main.css ↔ theme.uts ↔ MASTER §A1 一致')
  process.exit(0)
}
console.log(`设计 token 机检不通过：${findings.length} 项发现`)
process.exit(1)
