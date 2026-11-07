// Renders the brand SVGs to the raster assets browsers still need:
// favicon.ico (16/32/48), apple-touch-icon.png, icon-192/512.png, icon-maskable-512.png, og.png (1200x630).
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const site = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(site, 'brand')
mkdirSync(out, { recursive: true })
const svg = readFileSync(join(site, 'favicon.svg'), 'utf8')
const mark = readFileSync(join(site, 'brand', 'mark.svg'), 'utf8')

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })

async function png(size, { pad = 0, bg = 'transparent' } = {}) {
  await page.setViewportSize({ width: size, height: size })
  const inner = size - pad * 2
  await page.setContent(`<html><body style="margin:0;background:${bg};width:${size}px;height:${size}px;display:grid;place-items:center">
    <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg style="width:${inner}px;height:${inner}px;display:block" `)}</div></body></html>`)
  return page.screenshot({ type: 'png', omitBackground: bg === 'transparent', clip: { x: 0, y: 0, width: size, height: size } })
}

const sizes = { 16: null, 32: null, 48: null }
for (const s of Object.keys(sizes)) sizes[s] = await png(Number(s))
writeFileSync(join(site, 'favicon.ico'), ico(Object.entries(sizes).map(([s, b]) => [Number(s), b])))
writeFileSync(join(out, 'apple-touch-icon.png'), await png(180))
writeFileSync(join(out, 'icon-192.png'), await png(192))
writeFileSync(join(out, 'icon-512.png'), await png(512))
// Maskable: safe zone is the inner 80%, so inset the tile on a solid night background.
writeFileSync(join(out, 'icon-maskable-512.png'), await png(512, { pad: 64, bg: '#0a0a14' }))

// Open Graph card
await page.setViewportSize({ width: 1200, height: 630 })
await page.setContent(`<html><head><style>
  @font-face{font-family:Manrope;src:url(file://${site}/fonts/manrope-latin-wght-normal.woff2) format("woff2-variations");font-weight:200 800}
  body{margin:0;width:1200px;height:630px;background:#0a0a14;color:#f5f1e8;font-family:Manrope,system-ui,sans-serif;position:relative;overflow:hidden}
  .glow{position:absolute;right:-180px;top:-220px;width:760px;height:760px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,154,61,.28),rgba(255,154,61,0))}
  .glow2{position:absolute;left:-200px;bottom:-320px;width:700px;height:700px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,138,61,.16),rgba(255,138,61,0))}
  .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:60px 60px;mask-image:linear-gradient(#000 40%,transparent)}
  .in{position:absolute;left:88px;top:84px;right:88px;bottom:84px;display:flex;flex-direction:column;justify-content:space-between}
  .brand{display:flex;align-items:center;gap:20px;font-weight:800;font-size:40px;letter-spacing:-.02em}
  .brand svg{width:56px;height:56px;color:#f5f1e8}
  h1{margin:0;font-size:104px;line-height:1;letter-spacing:-.045em;font-weight:800}
  h1 b{color:#ffa14d;font-weight:800}
  p{margin:22px 0 0;font-size:30px;line-height:1.3;color:#b1afba;max-width:860px;font-weight:500}
  .foot{display:flex;gap:36px;font-size:22px;color:#8d8b99;font-weight:600;letter-spacing:.02em}
  .foot span::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:#ffa14d;margin-right:12px;vertical-align:middle}
</style></head><body>
  <div class="glow"></div><div class="glow2"></div><div class="grid"></div>
  <div class="in">
    <div class="brand">${mark}<span>Narad</span></div>
    <div><h1>Bhejo. <b>Pahunch gaya.</b></h1>
    <p>Device‑to‑device sharing for teams. Any size, end‑to‑end encrypted, nothing stored on any server.</p></div>
    <div class="foot"><span>Zero storage</span><span>AES‑256‑GCM</span><span>No account</span><span>Open core</span></div>
  </div>
</body></html>`)
await page.waitForTimeout(150)
writeFileSync(join(out, 'og.png'), await page.screenshot({ type: 'png' }))
await browser.close()
console.log('icons written to', site)

// ICO container with PNG-compressed entries (supported by every current browser and Windows ≥ Vista).
function ico(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(entries.length, 4)
  const dir = []
  const blobs = []
  let offset = 6 + 16 * entries.length
  for (const [size, buf] of entries) {
    const e = Buffer.alloc(16)
    e.writeUInt8(size >= 256 ? 0 : size, 0); e.writeUInt8(size >= 256 ? 0 : size, 1)
    e.writeUInt8(0, 2); e.writeUInt8(0, 3); e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6)
    e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(offset, 12)
    dir.push(e); blobs.push(buf); offset += buf.length
  }
  return Buffer.concat([header, ...dir, ...blobs])
}
