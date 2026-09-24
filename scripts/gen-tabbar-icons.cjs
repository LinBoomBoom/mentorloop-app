/* eslint-disable @typescript-eslint/no-require-imports */
// 生成 tabBar PNG 图标（81×81，RGBA，距离场抗锯齿）
// 用法: node scripts/gen-tabbar-icons.cjs
// 产物: static/tabbar/{name}.png 与 {name}-active.png
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const ROOT = path.dirname(path.dirname(path.resolve(__filename)))
const OUT_DIR = path.join(ROOT, 'static', 'tabbar')

const W = 81
const H = 81

const NORMAL = [148, 163, 184] // #94A3B8
const ACTIVE = [91, 108, 255] // #5B6CFF smart

// ---------- 栅格 ----------
function newRaster() {
  // 单通道覆盖度 0..1
  return new Float32Array(W * H)
}

function blend(raster, coverage) {
  for (let i = 0; i < raster.length; i++) {
    if (coverage[i] > raster[i]) raster[i] = coverage[i]
  }
}

// 线段（圆头，抗锯齿）
function segment(x0, y0, x1, y1, width) {
  const cov = new Float32Array(W * H)
  const half = width / 2
  const dx = x1 - x0
  const dy = y1 - y0
  const len2 = dx * dx + dy * dy
  const minX = Math.max(0, Math.floor(Math.min(x0, x1) - half - 1))
  const maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1) + half + 1))
  const minY = Math.max(0, Math.floor(Math.min(y0, y1) - half - 1))
  const maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1) + half + 1))
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5
      const py = y + 0.5
      let t = ((px - x0) * dx + (py - y0) * dy) / len2
      t = Math.max(0, Math.min(1, t))
      const cx = x0 + t * dx
      const cy = y0 + t * dy
      const dist = Math.hypot(px - cx, py - cy)
      const c = Math.max(0, Math.min(1, half + 0.5 - dist))
      if (c > 0) cov[y * W + x] = c
    }
  }
  return cov
}

// 填充圆
function filledCircle(cx, cy, r) {
  const cov = new Float32Array(W * H)
  const minX = Math.max(0, Math.floor(cx - r - 1))
  const maxX = Math.min(W - 1, Math.ceil(cx + r + 1))
  const minY = Math.max(0, Math.floor(cy - r - 1))
  const maxY = Math.min(H - 1, Math.ceil(cy + r + 1))
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      const c = Math.max(0, Math.min(1, r + 0.5 - dist))
      if (c > 0) cov[y * W + x] = c
    }
  }
  return cov
}

// 圆角矩形 SDF（负值在内部）
function rrectSDF(px, py, bx, by, bw, bh, r) {
  const qx = Math.abs(px - (bx + bw / 2)) - (bw / 2 - r)
  const qy = Math.abs(py - (by + bh / 2)) - (bh / 2 - r)
  const ox = Math.max(qx, 0)
  const oy = Math.max(qy, 0)
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r
}

// 圆角矩形描边
function rrectStroke(bx, by, bw, bh, r, width) {
  const cov = new Float32Array(W * H)
  const half = width / 2
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.abs(rrectSDF(x + 0.5, y + 0.5, bx, by, bw, bh, r))
      const c = Math.max(0, Math.min(1, half + 0.5 - d))
      if (c > 0) cov[y * W + x] = c
    }
  }
  return cov
}

// 圆弧描边（角度范围，弧度）
function arcStroke(cx, cy, r, a0, a1, width) {
  const cov = new Float32Array(W * H)
  const half = width / 2
  const minX = Math.max(0, Math.floor(cx - r - half - 1))
  const maxX = Math.min(W - 1, Math.ceil(cx + r + half + 1))
  const minY = Math.max(0, Math.floor(cy - r - half - 1))
  const maxY = Math.min(H - 1, Math.ceil(cy + r + half + 1))
  const steps = Math.max(24, Math.ceil((r * Math.abs(a1 - a0)) / 1.2))
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5
      const py = y + 0.5
      let best = Infinity
      for (let i = 0; i <= steps; i++) {
        const a = a0 + ((a1 - a0) * i) / steps
        const ax = cx + r * Math.cos(a)
        const ay = cy + r * Math.sin(a)
        const d = Math.hypot(px - ax, py - ay)
        if (d < best) best = d
      }
      const c = Math.max(0, Math.min(1, half + 0.5 - best))
      if (c > 0) cov[y * W + x] = c
    }
  }
  return cov
}

// ---------- 图标定义（返回 raster） ----------
function drawHome() {
  const r = newRaster()
  blend(r, segment(19, 40, 40, 22, 4.2))
  blend(r, segment(40, 22, 62, 40, 4.2))
  blend(r, segment(25, 40, 25, 57, 4))
  blend(r, segment(56, 40, 56, 57, 4))
  blend(r, segment(25, 57, 56, 57, 4))
  return r
}

function drawDumbbell() {
  const r = newRaster()
  blend(r, segment(30, 40, 51, 40, 4.5))
  blend(r, filledCircle(21, 40, 9))
  blend(r, filledCircle(60, 40, 9))
  return r
}

function drawFileText() {
  const r = newRaster()
  blend(r, rrectStroke(24, 13, 33, 55, 4, 3.6))
  blend(r, segment(31, 40, 50, 40, 3))
  blend(r, segment(31, 49, 50, 49, 3))
  blend(r, segment(31, 57, 44, 57, 3))
  return r
}

function drawTrendingUp() {
  const r = newRaster()
  blend(r, segment(20, 55, 33, 43, 4))
  blend(r, segment(33, 43, 45, 49, 4))
  blend(r, segment(45, 49, 60, 30, 4))
  // 箭头
  blend(r, segment(52, 30, 60, 30, 4))
  blend(r, segment(60, 30, 60, 38, 4))
  return r
}

function drawUser() {
  const r = newRaster()
  blend(r, filledCircle(40, 29, 9.5))
  // 肩部：上半圆
  blend(r, arcStroke(40, 74, 18.5, Math.PI, 2 * Math.PI, 4.2))
  return r
}

const ICONS = {
  home: drawHome,
  dumbbell: drawDumbbell,
  file: drawFileText,
  trend: drawTrendingUp,
  user: drawUser
}

// ---------- PNG 编码 ----------
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePng(raster, rgb) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0)
  ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const raw = Buffer.alloc((W * 4 + 1) * H)
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0 // filter none
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const o = y * (W * 4 + 1) + 1 + x * 4
      const a = Math.round(Math.max(0, Math.min(1, raster[i])) * 255)
      raw[o] = rgb[0]
      raw[o + 1] = rgb[1]
      raw[o + 2] = rgb[2]
      raw[o + 3] = a
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// ---------- 输出 ----------
fs.mkdirSync(OUT_DIR, { recursive: true })
for (const [name, draw] of Object.entries(ICONS)) {
  const raster = draw()
  fs.writeFileSync(path.join(OUT_DIR, name + '.png'), encodePng(raster, NORMAL))
  fs.writeFileSync(path.join(OUT_DIR, name + '-active.png'), encodePng(raster, ACTIVE))
  console.log('generated', name)
}
console.log('out:', OUT_DIR)
