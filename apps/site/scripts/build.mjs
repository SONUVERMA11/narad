// Renders src/pages/*.mjs through src/layout.mjs into static HTML (committed; Cloudflare Pages serves apps/site as-is).
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { APP, SITE, shell } from '../src/layout.mjs'

const site = join(dirname(fileURLToPath(import.meta.url)), '..')
const pagesDir = join(site, 'src', 'pages')
const ver = createHash('sha1').update(readFileSync(join(site, 'styles.css'))).update(readFileSync(join(site, 'site.js'))).digest('hex').slice(0, 8)
const pages = []
const indexable = () => pages.filter((p) => !p.noindex)
for (const f of readdirSync(pagesDir).filter((f) => f.endsWith('.mjs')).sort()) {
  const mod = await import(pathToFileURL(join(pagesDir, f)).href)
  const page = mod.default
  const out = page.path === '/' ? 'index.html' : `${page.path.slice(1)}.html`
  writeFileSync(join(site, out), shell(page, ver))
  pages.push(page)
  console.log('wrote', out)
}
const today = new Date().toISOString().slice(0, 10)
writeFileSync(join(site, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexable()
  .map((p) => `  <url><loc>${SITE}${p.path === '/' ? '/' : p.path}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${p.path === '/' ? '1.0' : '0.8'}</priority></url>`)
  .join('\n')}\n</urlset>\n`)
writeFileSync(join(site, 'llms.txt'), `# Narad

> Narad (नारद) is a free online file sharing tool: send files of any size, text and your clipboard from any device to any device with a 6-digit code or over the same Wi-Fi. Peer-to-peer (WebRTC), end-to-end encrypted (AES-256-GCM), no account, nothing stored on any server. Works in every modern browser on Windows, macOS, Linux, Android and iPhone; Chrome extension for right-click sharing. Made in India; open-source core.

Key facts
- Share with anyone: the sender gets a 6-digit code; the receiver types it at ${SITE}/receive (or opens app.narad.sh/#code=…). Items go device to device over an encrypted channel. Either side can keep the other as a contact afterwards.
- No size limit: files stream straight to disk; transfers resume after a Wi-Fi drop.
- Online clipboard: copy on one device, paste on another (opt-in per contact).
- Same Wi-Fi: devices discover each other automatically; bytes never leave the router.
- Server sees only IP, a random session id, device name and a room hash — never file names, sizes or content.
- Free for personal use; Team plan ₹149/user/month; self-host ₹14,999/year.

Pages
${indexable().map((p) => `- [${p.llmTitle ?? p.title}](${SITE}${p.path === '/' ? '/' : p.path}): ${p.description}`).join('\n')}
- [Security model](https://github.com/narad-app/narad/blob/main/SECURITY.md)
- [Privacy](https://github.com/narad-app/narad/blob/main/PRIVACY.md)
`)
// Cloudflare Pages redirects: old/short paths never 404, /app always reaches the web app.
writeFileSync(join(site, '_redirects'), `/index.html / 301
/home / 301
/app ${APP} 302
/open ${APP} 302
/share /share-files-with-anyone 301
/code /receive 301
/clipboard /online-clipboard 301
/large-files /send-large-files 301
/airdrop /airdrop-alternative 301
/privacy https://github.com/narad-app/narad/blob/main/PRIVACY.md 302
/security https://github.com/narad-app/narad/blob/main/SECURITY.md 302
`)
writeFileSync(join(site, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`)
console.log('sitemap.xml, llms.txt, _redirects, robots.txt')
