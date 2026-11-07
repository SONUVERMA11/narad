# Narad — Setup Guide (quick start)

पूरा production walkthrough `GO-LIVE.md` में है। यह file सिर्फ़ वो बातें जो सबसे पहले चाहिए।

## 1. Install और local run

```bash
# ज़रूरी: Node 22, pnpm 9  (corepack enable && corepack prepare pnpm@9.12.0 --activate)
pnpm install
pnpm dev            # signaling ws://localhost:8794/ws  +  web app http://localhost:5173
```
Landing site local में देखने के लिए (Cloudflare Pages जैसा, clean URLs के साथ):
```bash
cd apps/signaling && npx wrangler pages dev ../site --port 8098
```

Tests:
```bash
pnpm -r --filter '!./e2e' test        # unit
E2E_SIGNALING_PORT=8796 pnpm e2e      # Playwright (browser में असली WebRTC transfers)
```

## 2. Developer का नाम बदलना ("Developed by …")

**Website (footer, `<meta name="author">`, HTML comment):** `apps/site/site.config.json`
```json
"developer": { "name": "Rohan", "url": "https://your-site.com" }
```
फिर site दोबारा build करके commit करें:
```bash
pnpm --filter @narad/site build
```
(`url` खाली रखो तो नाम बिना link दिखेगा।)

**Web app (नीचे footer में):** build‑time environment variable
```bash
VITE_DEVELOPER_NAME="Rohan" VITE_DEVELOPER_URL="https://your-site.com" pnpm --filter @narad/web build
```
Cloudflare Pages पर: project `narad-app` → Settings → Environment variables में यही दो keys डालो। `apps/web/.env.production.example` में उदाहरण है।

Env से भी site का नाम override हो सकता है (CI में): `DEVELOPER_NAME`, `DEVELOPER_URL`।

## 3. Domain / app URL बदलना

सब कुछ एक file से चलता है: `apps/site/site.config.json`
```json
{
  "siteUrl": "https://narad.sh",      ← landing page का domain (canonical, sitemap, OG, JSON‑LD)
  "appUrl": "auto",                    ← "auto" = https://app.<siteUrl का host>  |  या पूरा URL, जैसे "https://app.example.com"
  "github": "https://github.com/<user>/narad",
  "email": "hello@narad.sh",
  "developer": { "name": "Rohan", "url": "" }
}
```
बदलने के बाद `pnpm --filter @narad/site build` → `index.html`, `sitemap.xml`, `robots.txt`, `llms.txt`, `_redirects` अपने‑आप नए domain पर आ जाते हैं। Env override: `SITE_URL`, `APP_URL`, `GITHUB_URL`, `CONTACT_EMAIL`।

**कोई page fail नहीं होता, क्योंकि:**
- `appUrl: "auto"` पर browser असली hostname से app URL निकालता है (`example.com` → `app.example.com`), इसलिए preview domains पर भी links सही रहते हैं।
- Web app बिना किसी setting के `wss://signaling.<domain>/ws` से जुड़ता है (`app.X` → `signaling.X`)। अलग signaling host हो तो build‑time `VITE_SIGNALING_URL=wss://…/ws`।
- `404.html` + `_redirects` (`/app`, `/share`, `/clipboard`, `/code`, `/privacy`…) पुराने/गलत URLs सँभालते हैं।

**DNS में बस तीन नाम चाहिए** (Cloudflare पर custom domain जोड़ते ही बन जाते हैं):

| Host | Cloudflare project | Source |
|---|---|---|
| `narad.sh` (+ `www`) | Pages `narad-site` | `apps/site` (no build) |
| `app.narad.sh` | Pages `narad-app` | `pnpm --filter @narad/web build` → `apps/web/dist` |
| `signaling.narad.sh` | Worker `narad-signaling` | `pnpm --filter @narad/signaling deploy:cf` |

## 4. Brand / रंग

Primary रंग एक जगह: site `apps/site/styles.css` में `--signal` / `--signal-rgb` (dark और light दोनों block), app `apps/web/src/index.css` में `--color-accent-*`। Logo/favicon/OG दोबारा: `pnpm --filter @narad/site icons`, extension icons: `pnpm --filter ./apps/extension icons`।

## 5. Deploy

Step‑by‑step (accounts, secrets, Workers, Pages, TURN, billing, Chrome Web Store, monitoring): **`GO-LIVE.md`**।
हर deploy से पहले:
```bash
SIGNALING_URL=wss://signaling.narad.sh/ws ./scripts/preflight.sh
```
