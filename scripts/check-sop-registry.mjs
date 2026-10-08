#!/usr/bin/env node
/**
 * check-sop-registry.mjs — skill / SOP 登记一致性机检（权威索引：docs/sop/README.md §8）
 *
 * 结构面（硬闸）：
 *   - skill 目录缺 SKILL.md / registry 缺行 / 重复登记 / 版本失同步 / registry 死链
 *   - SOP 缺版本头 / registry 缺行 / 重复登记 / 版本失同步 / registry 死链
 * 预算面（余量清单）：
 *   - skill frontmatter 缺 description / description > 400B / SKILL.md 正文 > 15360B
 *
 * 退出码：0 = 全绿；1 = 至少一项发现。
 * 用法：node scripts/check-sop-registry.mjs [--root <repoRoot>]
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const rootIdx = args.indexOf('--root')
const root = rootIdx > -1 ? resolve(args[rootIdx + 1]) : resolve(import.meta.dirname, '..')

const SKILLS_DIR = join(root, '.trae', 'skills')
const SOP_DIR = join(root, 'docs', 'sop')
const REGISTRY = join(SOP_DIR, 'README.md')

const DESC_BUDGET = 400
const BODY_BUDGET = 15360

const findings = []

function fail(file, msg) {
  findings.push(`✗ ${file} ${msg}`)
}

/** 解析 YAML frontmatter（--- 与 --- 之间），返回原始文本或 null */
function frontmatter(text) {
  if (!text.startsWith('---')) return null
  const end = text.indexOf('\n---', 3)
  if (end === -1) return null
  return text.slice(3, end)
}

function fmGet(fm, key) {
  const m = fm.match(new RegExp(`^[ \\t]*${key}:[ \\t]*(.*)$`, 'm'))
  if (!m) return null
  let val = m[1].trim()
  // 去除 YAML 标量引号（"1.0.0" / '1.0.0'）
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1)
  }
  return val
}

// ---------- registry 行解析 ----------
const regText = existsSync(REGISTRY) ? readFileSync(REGISTRY, 'utf8') : ''
const skillRows = new Map() // slug -> { version, count }
const skillRowRe =
  /\|\s*\[([a-z0-9-]+)\]\(\.\.\/\.\.\/\.trae\/skills\/([a-z0-9-]+)\/SKILL\.md\)\s*\|\s*([0-9][0-9.]*)\s*\|/g
for (const m of regText.matchAll(skillRowRe)) {
  const slug = m[2]
  const prev = skillRows.get(slug)
  skillRows.set(slug, { version: m[3], count: (prev?.count ?? 0) + 1 })
}
const sopRows = new Map() // filename -> { version, count }
const sopRowRe = /\|\s*\[([^\]]+)\]\(\.\/([^)]+?\.md)\)\s*\|\s*([0-9][0-9.]*)\s*\|/g
for (const m of regText.matchAll(sopRowRe)) {
  const name = m[2]
  const prev = sopRows.get(name)
  sopRows.set(name, { version: m[3], count: (prev?.count ?? 0) + 1 })
}
if (!regText) fail('docs/sop/README.md', 'registry 不存在或为空')

// ---------- skill 检查 ----------
let skillCount = 0
if (existsSync(SKILLS_DIR)) {
  const dirs = readdirSync(SKILLS_DIR).filter((d) => {
    try {
      return statSync(join(SKILLS_DIR, d)).isDirectory()
    } catch {
      return false
    }
  })
  for (const dir of dirs) {
    skillCount += 1
    const rel = `.trae/skills/${dir}/SKILL.md`
    const file = join(SKILLS_DIR, dir, 'SKILL.md')
    if (!existsSync(file)) {
      fail(rel, '缺 SKILL.md')
      continue
    }
    const text = readFileSync(file, 'utf8')
    const fm = frontmatter(text)
    if (!fm) {
      fail(rel, 'frontmatter 缺失或未闭合')
      continue
    }
    const name = fmGet(fm, 'name')
    if (name !== dir) fail(rel, `name「${name}」与目录名「${dir}」不一致`)
    const desc = fmGet(fm, 'description')
    if (!desc) {
      fail(rel, 'frontmatter 缺 description')
    } else {
      const bytes = Buffer.byteLength(desc, 'utf8')
      if (bytes > DESC_BUDGET) {
        fail(rel, `description ${bytes}B > 预算 ${DESC_BUDGET}B（余量：改写时回预算内）`)
      }
    }
    const version = fmGet(fm, 'version')
    if (!version) {
      fail(rel, 'metadata 缺 version')
    }
    if (!fmGet(fm, 'last_updated')) fail(rel, 'metadata 缺 last_updated')
    const bytes = Buffer.byteLength(text, 'utf8')
    if (bytes > BODY_BUDGET) {
      fail(rel, `正文 ${bytes}B > 上限 ${BODY_BUDGET}B（余量：拆 assets/ 或 scripts/）`)
    }
    const row = skillRows.get(dir)
    if (!row) {
      fail(rel, '缺行：skill 未登记（README §8.3，漏同步索引 = 更新未完成）')
    } else if (version && row.version !== version) {
      fail(rel, `版本失同步：头 ${version} ≠ registry ${row.version}`)
    }
  }
  for (const [slug, row] of skillRows) {
    if (row.count > 1) fail('docs/sop/README.md', `重复登记：${slug} 出现多于一行`)
    if (!existsSync(join(SKILLS_DIR, slug, 'SKILL.md'))) {
      fail('docs/sop/README.md', `死链：registry 已登记但 ${slug}/SKILL.md 不存在`)
    }
  }
} else {
  fail('.trae/skills', 'skill 目录不存在')
}

// ---------- SOP 检查 ----------
let sopCount = 0
if (existsSync(SOP_DIR)) {
  const files = readdirSync(SOP_DIR).filter(
    (f) => f.endsWith('.md') && f !== 'README.md' && /^SOP-|^[-a-z0-9]+-sop\.md$/.test(f)
  )
  for (const f of files) {
    sopCount += 1
    const rel = `docs/sop/${f}`
    const text = readFileSync(join(SOP_DIR, f), 'utf8')
    const fm = frontmatter(text)
    if (!fm) {
      fail(rel, '缺版本头 frontmatter（编号/名称/适用范围/版本/最后更新）')
    } else {
      const version = fmGet(fm, '版本')
      if (!version) {
        fail(rel, 'frontmatter 缺「版本」')
      }
      if (!fmGet(fm, '最后更新')) fail(rel, 'frontmatter 缺「最后更新」')
      const row = sopRows.get(f)
      if (!row) {
        fail(rel, '缺行：SOP 未登记（README §8.2，漏同步索引 = 更新未完成）')
      } else if (version && row.version !== version) {
        fail(rel, `版本失同步：头 ${version} ≠ registry ${row.version}`)
      }
    }
  }
  for (const [name, row] of sopRows) {
    if (row.count > 1) fail('docs/sop/README.md', `重复登记：${name} 出现多于一行`)
    if (!existsSync(join(SOP_DIR, name))) {
      fail('docs/sop/README.md', `死链：registry 已登记但 ${name} 不存在`)
    }
  }
} else {
  fail('docs/sop', 'SOP 目录不存在')
}

// ---------- 输出 ----------
if (findings.length === 0) {
  console.log(
    `✓ sop-registry 机检全绿（${skillCount} 个 skill，${sopCount} 份 SOP，结构面 + 预算面 零发现）`
  )
  process.exit(0)
}
for (const line of findings) console.log(line)
console.log(
  `sop-registry 机检：${skillCount} 个 skill · ${sopCount} 份 SOP · registry skill ${skillRows.size} 行 · SOP ${sopRows.size} 行 · ${findings.length} 项发现`
)
process.exit(1)
