// Shared page shell for the static site. `pnpm --filter @narad/site build` renders src/pages/*.mjs → *.html.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Deployment config: apps/site/site.config.json, each key overridable by env (SITE_URL, APP_URL, GITHUB_URL, CONTACT_EMAIL, DEVELOPER_NAME, DEVELOPER_URL).
const cfg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'site.config.json'), 'utf8'))
export const SITE = (process.env.SITE_URL || cfg.siteUrl).replace(/\/$/, '')
export const HOST = new URL(SITE).host.replace(/^www\./, '')
/** "auto" = https://app.<site host>; the browser re-derives this from the real hostname too (site.js), so previews on other domains still work. */
export const APP = ((process.env.APP_URL || cfg.appUrl) === 'auto' ? `https://app.${HOST}` : process.env.APP_URL || cfg.appUrl).replace(/\/$/, '')
export const APP_HOST = new URL(APP).host
export const APP_AUTO = (process.env.APP_URL || cfg.appUrl) === 'auto'
export const GITHUB = (process.env.GITHUB_URL || cfg.github).replace(/\/$/, '')
export const EMAIL = process.env.CONTACT_EMAIL || cfg.email
export const DEVELOPER = { name: process.env.DEVELOPER_NAME || cfg.developer?.name || '', url: process.env.DEVELOPER_URL || cfg.developer?.url || '' }

export const ICONS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<linearGradient id="g-flow" x1="16" y1="14" x2="48" y2="50" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffbe7a"/><stop offset="1" stop-color="#d9640f"/></linearGradient>
<symbol id="mark" viewBox="0 0 64 64"><g fill="none" stroke-linecap="round" stroke-width="9"><path d="M16 14v36M48 14v36" stroke="currentColor"/><path d="M16 14l32 36" stroke="url(#g-flow)"/></g></symbol>
<symbol id="i-wifi" viewBox="0 0 24 24"><path d="M5 12.6a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a14.5 14.5 0 0 1 20 0"/><circle cx="12" cy="19.5" r=".8" fill="currentColor"/></symbol>
<symbol id="i-link" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></symbol>
<symbol id="i-building" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/></symbol>
<symbol id="i-file" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></symbol>
<symbol id="i-refresh" viewBox="0 0 24 24"><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/></symbol>
<symbol id="i-clipboard" viewBox="0 0 24 24"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 13l2 2 4-4"/></symbol>
<symbol id="i-pointer" viewBox="0 0 24 24"><path d="M9 9l5 12 1.8-5.2L21 14z"/><path d="M7.2 2.2l.8 2.7M2.2 7.2l2.7.8M3 3l2 2"/></symbol>
<symbol id="i-chat" viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/></symbol>
<symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></symbol>
<symbol id="i-lock" viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></symbol>
<symbol id="i-x" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></symbol>
<symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>
<symbol id="i-eye" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></symbol>
<symbol id="i-eyeoff" viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 4.6-1.1"/></symbol>
<symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></symbol>
<symbol id="i-moon" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></symbol>
<symbol id="i-folder" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></symbol>
<symbol id="i-chrome" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 8.5h8.2M9 13.8L4.9 6.7M15 13.8l-4.1 7.1"/></symbol>
<symbol id="i-github" viewBox="0 0 24 24"><path d="M15 22v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.7 11.7 0 0 0-6.2 0C6.6 3.8 5.5 4.1 5.5 4.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 10.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V22"/><path d="M9 20c-4.5 1.5-4.5-2.5-6-3"/></symbol>
<symbol id="i-server" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/></symbol>
<symbol id="i-zap" viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></symbol>
<symbol id="i-key" viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="M10.9 12.1L20 3M15 8l3 3M18 5l3 3"/></symbol>
<symbol id="i-phone" viewBox="0 0 24 24"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></symbol>
<symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></symbol>
<symbol id="i-download" viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M4 19h16"/></symbol>
</defs></svg>`

export const i = (name, cls = 'icon') => `<svg class="${cls}"><use href="#i-${name}"/></svg>`
export const en = (s) => `<span data-en>${s}</span>`
export const hi = (s) => `<span data-hi>${s}</span>`
export const bi = (e, h) => en(e) + hi(h)

const NAV = [
  ['/share-files-with-anyone', 'Share with code', 'कोड से भेजें'],
  ['/online-clipboard', 'Online clipboard', 'ऑनलाइन क्लिपबोर्ड'],
  ['/send-large-files', 'Large files', 'बड़ी फाइलें'],
  ['/#pricing', 'Pricing', 'कीमत'],
  ['/receive', 'Receive', 'पाएँ'],
]

export function shell({ path, title, description, body, jsonld = [], ogImage = `${SITE}/brand/og.png`, noindex = false }, ver = '1') {
  const url = SITE + (path === '/' ? '/' : path)
  const ld = jsonld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n')
  const dev = DEVELOPER.name ? (DEVELOPER.url ? `<a href="${DEVELOPER.url}" rel="author">${DEVELOPER.name}</a>` : DEVELOPER.name) : ''
  return `<!doctype html>
<!-- Narad · ${HOST}${DEVELOPER.name ? ` · Developed by ${DEVELOPER.name}` : ''} · ${new Date().toISOString().slice(0, 10)} -->
<html lang="en" data-app="${APP}" data-app-auto="${APP_AUTO ? '1' : ''}">
<head>
<meta charset="utf-8" />${DEVELOPER.name ? `\n<meta name="author" content="${DEVELOPER.name}" />` : ''}${noindex ? '\n<meta name="robots" content="noindex" />' : ''}
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<meta name="description" content="${description}" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Narad" />
<meta property="og:url" content="${url}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${ogImage}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="color-scheme" content="light dark" />
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f4f1ea" />
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0d0d12" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48" />
<link rel="apple-touch-icon" href="/brand/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />
<link rel="preload" href="/fonts/manrope-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin />
<link rel="stylesheet" href="/styles.css?v=${ver}" />
<script>(function(){try{var t=localStorage.getItem('narad:theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}try{var l=localStorage.getItem('narad:lang')||(navigator.language.indexOf('hi')===0?'hi':'en');document.documentElement.lang=l;}catch(e){}document.documentElement.classList.add('js');})();</script>
${ld}
</head>
<body>
${ICONS}
<canvas id="signal" aria-hidden="true"></canvas>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/" aria-label="Narad home"><svg class="mark"><use href="#mark"/></svg>Narad<small>नारद</small></a>
    <nav class="site-nav" aria-label="Primary">
      ${NAV.map(([href, e, h]) => `<a href="${href}"${href === path ? ' aria-current="page"' : ''}>${bi(e, h)}</a>`).join('\n      ')}
    </nav>
    <div class="right">
      <button class="lang" id="langBtn" onclick="toggleLang()" aria-label="Switch language">हिंदी</button>
      <button class="btn-icon theme" onclick="toggleTheme()" aria-label="Toggle theme" title="Theme">${i('sun', 'icon sun')}${i('moon', 'icon moon')}</button>
      <a class="btn btn-solid btn-sm cta" href="${APP}" data-app-link>${bi('Open app', 'App खोलें')}</a>
      <button class="btn-icon menu-btn" onclick="toggleMenu()" aria-label="Menu" aria-expanded="false" aria-controls="mobileNav"><span class="open">${i('menu')}</span><span class="close">${i('x')}</span></button>
    </div>
  </div>
  <nav class="mobile-nav" id="mobileNav" aria-label="Mobile">
    ${NAV.map(([href, e, h]) => `<a href="${href}">${bi(e, h)} ${i('arrow')}</a>`).join('\n    ')}
    <a class="cta" href="${APP}" data-app-link>${bi('Open app', 'App खोलें')} ${i('arrow')}</a>
  </nav>
</header>
<main id="top" class="veil">
${body}
</main>
<footer>
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <a class="brand" href="/"><svg class="mark"><use href="#mark"/></svg>Narad<small>नारद</small></a>
        <p class="tag">${bi('Free online file sharing: send files, text and your clipboard to any device with a 6‑digit code. Zero storage, end‑to‑end encrypted. Made in India.', 'मुफ़्त ऑनलाइन फाइल शेयरिंग: 6 अंकों के कोड से किसी भी डिवाइस को फाइल, टेक्स्ट और क्लिपबोर्ड भेजें। Zero storage, end‑to‑end encrypted। भारत में बना।')}</p>
      </div>
      <div><h4>${bi('Use cases', 'इस्तेमाल')}</h4><ul>
        <li><a href="/share-files-with-anyone">${bi('Share files with anyone', 'किसी को भी फाइल भेजें')}</a></li>
        <li><a href="/send-large-files">${bi('Send large files free', 'बड़ी फाइलें मुफ़्त भेजें')}</a></li>
        <li><a href="/online-clipboard">${bi('Online clipboard', 'ऑनलाइन क्लिपबोर्ड')}</a></li>
        <li><a href="/airdrop-alternative">${bi('AirDrop for Windows & Android', 'Windows/Android के लिए AirDrop')}</a></li>
        <li><a href="/receive">${bi('Receive with a code', 'कोड से पाएँ')}</a></li>
      </ul></div>
      <div><h4>${bi('Product', 'प्रोडक्ट')}</h4><ul>
        <li><a href="${APP}" data-app-link>${bi('Web app', 'Web app')}</a></li>
        <li><a href="/#extension">${bi('Chrome extension', 'Chrome एक्सटेंशन')}</a></li>
        <li><a href="/#pricing">${bi('Pricing', 'कीमत')}</a></li>
        <li><a href="${GITHUB}/tree/main/infra/selfhost">${bi('Self‑host', 'Self‑host')}</a></li>
      </ul></div>
      <div><h4>${bi('Trust', 'भरोसा')}</h4><ul>
        <li><a href="${GITHUB}/blob/main/SECURITY.md">${bi('Security', 'सुरक्षा')}</a></li>
        <li><a href="${GITHUB}/blob/main/PRIVACY.md">${bi('Privacy', 'प्राइवेसी')}</a></li>
        <li><a href="${GITHUB}">${bi('Source code', 'Source code')}</a></li>
        <li><a href="mailto:${EMAIL}">${EMAIL}</a></li>
      </ul></div>
    </div>
    <div class="wordmark" aria-hidden="true">NARAD</div>
    <div class="foot-bottom">
      <span>© 2026 Narad · ${bi('Made in India', 'भारत में बना')}</span>
      <span>${bi('Bhejo. Pahunch gaya.', 'भेजो। पहुँच गया।')}</span>
      ${dev ? `<span class="dev-tag">${bi('Developed by', 'Developed by')} ${dev}</span>` : ''}
    </div>
  </div>
</footer>
<script src="/site.js?v=${ver}"></script>
</body>
</html>
`
}

/** Shared JSON-LD blocks */
export const ORG = { '@context': 'https://schema.org', '@type': 'Organization', name: 'Narad', url: SITE, logo: `${SITE}/brand/icon-512.png`, email: EMAIL, sameAs: [GITHUB] }
export const APP_LD = {
  '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Narad', url: APP, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any (web browser), Chrome extension',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
  description: 'Free online file sharing: send files of any size, text and your clipboard to any device with a 6-digit code. End-to-end encrypted, peer-to-peer, nothing stored on a server.',
  featureList: ['Send files online with a 6-digit code', 'No account or sign-up', 'No file size limit', 'End-to-end encryption (AES-256-GCM)', 'Online clipboard sync between devices', 'Works on Windows, macOS, Linux, Android, iPhone browsers', 'Resumes after Wi-Fi drops'],
}
export const faqLd = (items) => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) })
export const crumbs = (list) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: list.map(([name, url], idx) => ({ '@type': 'ListItem', position: idx + 1, name, item: SITE + url })) })
export const howTo = (name, steps, description) => ({ '@context': 'https://schema.org', '@type': 'HowTo', name, description, totalTime: 'PT1M', step: steps.map(([n, t]) => ({ '@type': 'HowToStep', name: n, text: t })) })

/** Markup helpers */
export const faqHtml = (items) => `<div class="faq">${items.map(([q, a, qh, ah]) => `<details><summary>${qh ? bi(q, qh) : q}</summary><p>${ah ? bi(a, ah) : a}</p></details>`).join('')}</div>`
export const receiveBox = () => `<form class="recv" data-receive aria-label="Receive with code">
  <span class="kicker">${i('key')} ${bi('Got a code?', 'कोड मिला?')}</span>
  <p class="hint">${bi('Type the 6‑digit code the sender gave you. The app opens and the transfer starts, device to device.', 'भेजने वाले का 6 अंकों का कोड डालें। App खुलेगा और transfer डिवाइस‑से‑डिवाइस शुरू होगा।')}</p>
  <input inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="••••••" aria-label="6-digit code" autocomplete="one-time-code" />
  <div><button class="btn btn-signal" type="submit">${bi('Receive', 'पाएँ')} ${i('arrow')}</button></div>
</form>`
export const related = (links) => `<nav class="related" aria-label="Related">${links.map(([href, t, s]) => `<a href="${href}">${t}<small>${s}</small></a>`).join('')}</nav>`
export const ctaBand = () => `<div class="band rv"><div class="wrap"><div class="in">
  <div><h2>${bi('Open it on two devices. <em class="s">That’s the whole setup.</em>', 'दो डिवाइस पर खोलो। <em class="s">बस यही setup है।</em>')}</h2><p>${bi('No account, no install, no size limit. Narad is ready the second the page loads.', 'न अकाउंट, न install, न size limit। पेज खुलते ही Narad तैयार।')}</p></div>
  <div class="acts"><a class="btn btn-signal" href="${APP}" data-app-link>${bi('Open Narad', 'Narad खोलें')} ${i('arrow')}</a><a class="btn" href="/receive">${i('key')} ${bi('I have a code', 'मेरे पास कोड है')}</a></div>
</div></div></div>`
