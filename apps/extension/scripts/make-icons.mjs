// Generates icon16/48/128.png (Narad mark on night indigo, 4× supersampled) with zero dependencies.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(out, { recursive: true })

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.min(1, Math.max(0, t)))
const C = { bg1: hex('#1a1a2e'), bg2: hex('#0a0a14'), ink: hex('#f5f1e8'), t1: hex('#ffbe7a'), t2: hex('#f27d1d') }

// Narad mark: two pillars (devices) joined by one direct stroke (the transfer). Geometry mirrors apps/site/favicon.svg (64-unit grid).
const L = { x: 19 / 64, y0: 18 / 64, y1: 46 / 64 }
const R = { x: 45 / 64 }
const HALF = 7.5 / 64 / 2
const distSeg = (px, py, ax, ay, bx, by) => {
  const vx = bx - ax, vy = by - ay
  const t = Math.min(1, Math.max(0, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)))
  return [Math.hypot(px - (ax + vx * t), py - (ay + vy * t)), t]
}

// Sample one point in unit space (0..1). Returns [r,g,b,a].
function sample(u, v) {
  const r = 0.235
  const dx = Math.max(0, Math.abs(u - 0.5) - (0.5 - r))
  const dy = Math.max(0, Math.abs(v - 0.5) - (0.5 - r))
  if (dx * dx + dy * dy > r * r) return [0, 0, 0, 0]
  let c = mix(C.bg1, C.bg2, (u + v) / 2)
  if (distSeg(u, v, L.x, L.y0, L.x, L.y1)[0] <= HALF || distSeg(u, v, R.x, L.y0, R.x, L.y1)[0] <= HALF) c = C.ink
  const [d, t] = distSeg(u, v, L.x, L.y0, R.x, L.y1)
  if (d <= HALF) c = mix(C.t1, C.t2, t)
  return [c[0], c[1], c[2], 255]
}

function png(size) {
  const ss = 4
  const px = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0, 0]
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const s = sample((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size)
          for (let i = 0; i < 4; i++) acc[i] += s[i]
        }
      const i = (y * size + x) * 4
      const a = acc[3] / (ss * ss)
      // premultiplied average → straight alpha
      for (let k = 0; k < 3; k++) px[i + k] = a ? Math.round(acc[k] / (ss * ss) * (255 / a)) : 0
      px[i + 3] = Math.round(a)
    }
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

for (const s of [16, 48, 128]) writeFileSync(join(out, `icon${s}.png`), png(s))
console.log('[narad/extension] icons written')
