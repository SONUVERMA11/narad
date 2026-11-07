# Narad — Go‑Live Guide (production setup, step by step)

यह guide शून्य से live तक ले जाती है। हर step में **क्या**, **क्यों** और **exact command** है। Domain उदाहरण के लिए `narad.sh` माना है; अपना domain हर जगह बदल लें।

| Piece | Host | URL (example) | Cost |
|---|---|---|---|
| Landing page (`apps/site`) | Cloudflare Pages | `https://narad.sh` | ₹0 |
| Web app (`apps/web`) | Cloudflare Pages | `https://app.narad.sh` | ₹0 |
| Signaling (`apps/signaling`) | Cloudflare Workers + Durable Objects | `wss://signaling.narad.sh/ws` | ₹0 → Workers Paid ($5/mo) when traffic grows |
| TURN relay (`infra/turn`) | one small VPS (coturn) | `turn:turn.narad.sh:3478` | ~₹400/mo (optional at launch) |
| Billing (`apps/billing`) | Cloudflare Workers + KV | `https://billing.narad.sh` | ₹0 (Razorpay fees only) |
| Chrome extension (`apps/extension`) | Chrome Web Store | store listing | $5 one‑time |

Content कभी किसी server से नहीं गुज़रता; सिर्फ़ signaling (introductions) और optional TURN (encrypted bytes) host होते हैं। इसलिए यह पूरा stack लगभग मुफ़्त में चलता है।

---

## 0. आपको क्या चाहिए (accounts + tools)

Accounts:
- **Domain registrar** (Cloudflare Registrar सबसे आसान: DNS automatically वहीं रहता है)
- **Cloudflare** account (Pages, Workers, KV, Durable Objects — Durable Objects के लिए Workers Paid plan चाहिए, $5/month; free plan पर `wrangler deploy` DO migration पर रुक जाएगा)
- **GitHub** account (CI + auto‑deploy)
- **Razorpay** account (सिर्फ़ Team plan बेचने के लिए; launch के दिन ज़रूरी नहीं)
- **Chrome Web Store developer** account ($5)

Tools (local machine):
```bash
node -v      # 22.x
pnpm -v      # 9.x  (corepack enable && corepack prepare pnpm@9.12.0 --activate)
gh --version # GitHub CLI, logged in: gh auth status
```
```bash
pnpm install
npx --prefix apps/signaling wrangler login     # browser खुलेगा, Cloudflare से जोड़ें (एक बार)
```

---

## 1. Domain + DNS (Cloudflare)

1. Cloudflare dashboard → **Add a site** → `narad.sh` → nameservers registrar पर बदलें (Cloudflare Registrar से खरीदा हो तो कुछ नहीं करना)।
2. DNS records अभी **मत** बनाएँ; Pages/Workers custom domain जोड़ते समय Cloudflare खुद बनाता है। सिर्फ़ TURN के लिए बाद में एक `A` record लगेगा (§6)।
3. SSL/TLS → **Full (strict)**; Edge Certificates → **Always Use HTTPS** on, **HSTS** on (हमारे `_headers` भी HSTS भेजते हैं)।

---

## 2. Secrets बनाएँ (एक बार, password manager में रखें)

```bash
# TURN: coturn और signaling दोनों को एक ही secret
openssl rand -hex 32

# Push nudge (optional): VAPID key pair
node apps/signaling/scripts/vapid-keys.mjs

# Team licenses: ES256 key pair
node packages/license/scripts-keys.mjs
```

कहाँ क्या जाता है:

| Value | Signaling worker | Billing worker | coturn VPS |
|---|---|---|---|
| `TURN_SECRET` | secret | — | `--static-auth-secret` |
| `TURN_URLS` | var | — | — |
| `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` | var | — | — |
| `VAPID_PRIVATE_KEY` | secret | — | — |
| `LICENSE_PUBLIC_KEY` | var | var | — |
| `LICENSE_PRIVATE_KEY` | — | secret | — |
| `RAZORPAY_KEY_ID` | — | var | — |
| `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | — | secret | — |

**var** = `wrangler.toml` `[vars]` में (git में जा सकता है)। **secret** = `wrangler secret put NAME` (कभी git में नहीं)। `.gitignore` पहले से `.env*` रोकता है; `scripts/preflight.sh` committed private keys पकड़ता है।

---

## 3. GitHub repo + CI

```bash
cd /path/to/NARAD
gh repo create narad --private --source=. --remote=origin --push     # या --public (open core)
```
Push के बाद **Actions** tab में `CI` चलेगा: typecheck, unit tests, builds, Playwright e2e (extension सहित)। हरा होने तक आगे न बढ़ें।

Landing page में placeholder links बदलें (एक बार):
```bash
sed -i '' 's#github.com/narad-app/narad#github.com/<your-user>/narad#g' apps/site/index.html
```
Repo private है तो footer/FAQ के GitHub links हटा दें या `SECURITY.md`/`PRIVACY.md` को `apps/site/` में HTML pages बना कर वहाँ link करें।

---

## 4. Signaling (Akash) → Cloudflare Workers

`apps/signaling/wrangler.toml` पहले से production‑ready है। बस values भरें:

```bash
cd apps/signaling
npx wrangler secret put TURN_SECRET            # §2 वाला hex (TURN न हो तो यह step छोड़ें)
npx wrangler secret put VAPID_PRIVATE_KEY      # optional
```
`wrangler.toml` `[vars]`: `TURN_URLS` (§6 के बाद), `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`, `LICENSE_PUBLIC_KEY`।

Push nudge चाहिए तो KV बनाएँ और toml में uncomment करें:
```bash
npx wrangler kv namespace create PUSH          # id print होगा → [[kv_namespaces]] block
```

Deploy + custom domain:
```bash
pnpm --filter @narad/signaling deploy:cf       # → https://narad-signaling.<you>.workers.dev
```
Dashboard → Workers & Pages → `narad-signaling` → Settings → **Domains & Routes** → Add → Custom domain `signaling.narad.sh` (DNS खुद बनेगा)। फिर toml में `routes = [...]` uncomment, `workers_dev = false`, दोबारा deploy।

Verify:
```bash
curl https://signaling.narad.sh/health     # {"ok":true,...}
curl https://signaling.narad.sh/ice        # STUN (+TURN with short-lived creds)
```

---

## 5. Web app → Cloudflare Pages

Dashboard → Workers & Pages → **Create** → Pages → **Connect to Git** → repo `narad`:

| Setting | Value |
|---|---|
| Project name | `narad-app` |
| Production branch | `main` |
| Root directory | `/` (repo root; monorepo) |
| Build command | `pnpm --filter @narad/web build` |
| Build output directory | `apps/web/dist` |
| Environment variables | `VITE_SIGNALING_URL = wss://signaling.narad.sh/ws`, `NODE_VERSION = 22`, `PNPM_VERSION = 9.12.0` |

Deploy → Custom domains → `app.narad.sh`।

`apps/web/public/_headers` HSTS, nosniff, frame‑deny, immutable asset caching भेजता है; `sw.js` no‑cache है ताकि updates तुरंत पहुँचें।

Verify (दो devices, एक ही Wi‑Fi): `https://app.narad.sh` दोनों पर खोलें → एक‑दूसरे को sabha में दिखें → एक file भेजें → दोनों पर वही 4 emoji (SAS)। फिर mobile data पर एक device: Pair (6‑digit code) → contact दिखे → transfer चले।

---

## 6. TURN relay (coturn) — strict office firewalls के लिए

Launch के दिन optional है (LAN और ज़्यादातर home networks बिना TURN चलते हैं), पर corporate customers के लिए ज़रूरी। एक छोटा VPS (Hetzner CX22 / Contabo, public IPv4):

```bash
# VPS पर
apt install -y docker.io docker-compose-plugin
git clone https://github.com/<your-user>/narad && cd narad/infra/turn
TURN_SECRET=<§2 hex> TURN_REALM=turn.narad.sh TURN_PUBLIC_IP=<VPS IP> docker compose up -d
```
Firewall: UDP+TCP 3478, TCP 5349, UDP 49160–49200 खोलें। DNS: `A turn.narad.sh → <VPS IP>` (proxy **off**, grey cloud)।
`turns:` (TLS, port 5349) के लिए cert चाहिए: `certbot certonly --standalone -d turn.narad.sh` और coturn को `--cert`/`--pkey` दें (`infra/turn/README.md`)।

Signaling को बताएँ: `wrangler.toml` में
```toml
TURN_URLS = "turn:turn.narad.sh:3478?transport=udp,turn:turn.narad.sh:3478?transport=tcp,turns:turn.narad.sh:5349"
```
और redeploy। Test: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/ में `/ice` से मिले username/credential डालें → `relay` candidate दिखे।

---

## 7. Landing page → Cloudflare Pages

Pages → Create → Connect to Git → वही repo:

| Setting | Value |
|---|---|
| Project name | `narad-site` |
| Root directory | `apps/site` |
| Build command | *(empty)* |
| Build output directory | `/` |

Custom domain: `narad.sh` + `www.narad.sh` (www → redirect rule to apex)।

Go‑live से पहले `apps/site/index.html` में: `app.narad.sh` links, `hello@narad.sh` (email सच में बनाएँ: Cloudflare Email Routing मुफ़्त है → आपके Gmail पर forward), prices। `robots.txt`, `sitemap.xml`, canonical, OG image (`brand/og.png`) पहले से हैं; domain बदला हो तो इन तीनों में भी बदलें। OG preview check: https://www.opengraph.xyz/ ।

Brand assets दोबारा बनाने हों: `pnpm --filter @narad/site icons`। Page content `apps/site/src/pages/*.mjs` में है; बदलने के बाद `pnpm --filter @narad/site build` चलाएँ और generated HTML commit करें (sitemap + llms.txt भी बनते हैं)।

SEO/AI‑search setup जो पहले से है: हर page पर unique title/description/canonical, JSON‑LD (Organization, SoftwareApplication, FAQPage, HowTo, BreadcrumbList), `robots.txt`, `sitemap.xml`, `llms.txt`, OG image, HSTS + CSP headers। Launch के बाद: Google Search Console में sitemap submit, Bing Webmaster में भी (Copilot इसी index से citations लेता है), और हर keyword page को 1–2 asli backlinks (Product Hunt, Reddit r/selfhosted, Hacker News) दिलाएँ।

---

## 7a. Domain, links और "Developed by" नाम set करना

Site और app **domain‑agnostic** हैं: जिस भी domain पर deploy करो, links अपने‑आप सही बनते हैं और कोई page fail नहीं होता।

**एक जगह config** — `apps/site/site.config.json`:
```json
{
  "siteUrl": "https://narad.sh",          ← आपका landing domain (canonical, sitemap, OG, JSON‑LD में जाता है)
  "appUrl": "auto",                        ← "auto" = https://app.<siteUrl host>; या पूरा URL लिखें
  "github": "https://github.com/<user>/narad",
  "email": "hello@narad.sh",
  "developer": { "name": "Rohan", "url": "https://..." }   ← footer में “Developed by Rohan”, HTML comment और <meta name=author>
}
```
बदलने के बाद:
```bash
pnpm --filter @narad/site build     # HTML, sitemap.xml, robots.txt, llms.txt, _redirects दोबारा बनते हैं
git commit -am "site: config" && git push
```
Env variables से भी override हो सकता है (CI/Pages में): `SITE_URL`, `APP_URL`, `GITHUB_URL`, `CONTACT_EMAIL`, `DEVELOPER_NAME`, `DEVELOPER_URL`।

**"Page fail नहीं होता" कैसे:**
- `appUrl: "auto"` पर browser असली hostname से app URL निकालता है (`example.com` → `app.example.com`), इसलिए Pages preview (`*.pages.dev`) या दूसरा domain भी बिना rebuild चलता है। सिर्फ़ `app.<domain>` को Pages project `narad-app` का custom domain बनाओ।
- Web app बिना किसी env के `wss://signaling.<domain>/ws` से जुड़ता है (`app.X` → `signaling.X`)। बस signaling worker का custom domain `signaling.<domain>` रखो। `VITE_SIGNALING_URL` set हो तो वही चलता है।
- `404.html`: गलत URL पर branded page (home + receive box), `noindex`।
- `_redirects`: `/app`, `/open` → app; `/share`, `/clipboard`, `/large-files`, `/airdrop`, `/code` → सही page; `/privacy`, `/security` → docs; `/index.html`, `/home` → `/`।
- App के अंदर copy ("open narad.sh/receive") भी runtime पर आपके domain से बनती है।

**App में Developed by:** build‑time env `VITE_DEVELOPER_NAME=Rohan` (optional `VITE_DEVELOPER_URL`) — Cloudflare Pages → narad-app → Environment variables में जोड़ो या `apps/web/.env.production` में। App footer में “Developed by Rohan” दिखेगा।

**Theme:** app में header पर sun/moon button light (paper & ink, site जैसा) और high‑contrast dark (pure black) के बीच switch करता है; चुनाव `localStorage` में रहता है, default dark।

---

## 8. Auto‑deploy (GitHub Actions → Cloudflare)

`.github/workflows/deploy.yml` हर `main` push पर workers + दोनों Pages projects deploy करता है। चालू करने के लिए:

1. Cloudflare → My Profile → API Tokens → Create → template **Edit Cloudflare Workers** + permissions **Account: Cloudflare Pages: Edit**, **Workers KV Storage: Edit**।
2. GitHub repo → Settings → Secrets and variables → Actions:
   - Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (dashboard URL / Workers overview में)
   - Variables: `CF_DEPLOY = true`, `VITE_SIGNALING_URL = wss://signaling.narad.sh/ws`
3. अगर Pages projects को §5/§7 में Git से जोड़ा है तो वे खुद भी deploy होंगे; दोहराव से बचने के लिए या तो Pages का Git connection रखें और workflow के दो `pages deploy` steps हटाएँ, या Pages projects को **Direct Upload** बनाएँ और workflow पर भरोसा करें (recommended: एक ही रास्ता)।

Rollback: Cloudflare → project → Deployments → पुराना deployment → **Rollback** (Pages) / Workers → Deployments → previous version → **Rollback**। Git में `git revert <sha> && git push` भी नया deploy बना देता है।

---

## 9. Billing (Razorpay) — Team plan बेचने के लिए

पहले **test mode**:
```bash
cd apps/billing
npx wrangler kv namespace create LICENSES          # id → wrangler.toml [[kv_namespaces]]
npx wrangler secret put RAZORPAY_KEY_SECRET
npx wrangler secret put RAZORPAY_WEBHOOK_SECRET    # Razorpay → Webhooks में आप जो secret रखेंगे
npx wrangler secret put LICENSE_PRIVATE_KEY        # §2
# wrangler.toml [vars]: RAZORPAY_KEY_ID=rzp_test_…, LICENSE_PUBLIC_KEY, ALLOWED_ORIGIN=https://app.narad.sh
pnpm --filter @narad/billing deploy:cf
```
Razorpay dashboard → Settings → Webhooks → URL `https://billing.narad.sh/webhook`, event `payment.captured`, वही secret। Custom domain `billing.narad.sh` §4 की तरह।

Flow test: `POST /checkout {seats, org}` → Razorpay test card से pay → webhook license mint करता है → `GET /license/:orderId` → token को app में Spaces → Team में paste → उस room की capacity `seats × 4` हो जाती है। चलने के बाद `rzp_live_…` keys और live webhook लगाएँ। **KYC/activation** Razorpay पर पहले पूरा कर लें (2–5 दिन)।

Signaling worker में भी `LICENSE_PUBLIC_KEY` भरा होना चाहिए, वरना token verify नहीं होगा।

---

## 10. Chrome extension → Web Store

```bash
VITE_SIGNALING_URL=wss://signaling.narad.sh/ws pnpm --filter @narad/extension build
cd apps/extension/dist && zip -r ../narad-extension.zip . && cd -
```
Developer dashboard (https://chrome.google.com/webstore/devconsole): New item → zip upload।
Listing के लिए चाहिए: 128px icon (है), **1280×800 screenshots** (3–5; popup, right‑click menu, transfer), short + detailed description, category *Productivity*, **privacy policy URL** (`https://narad.sh/privacy` — `PRIVACY.md` को page बनाकर host करें या GitHub link), permissions justification (clipboardRead: "clipboard sync, opt‑in per contact", tabs: "send current page", downloads: "save received files")। Review 1–7 दिन। हर release पर `public/manifest.json` में `version` बढ़ाएँ।

---

## 11. Launch checklist

```bash
SIGNALING_URL=wss://signaling.narad.sh/ws ./scripts/preflight.sh
```
यह script typecheck, unit tests, production builds, placeholder scan, committed‑secret scan और signaling `/health` + `/ice` smoke test करता है; `READY` आए तभी आगे।

Manual smoke test (10 मिनट):
- [ ] `https://narad.sh` desktop + phone पर खुले, dark/light दोनों, हिंदी toggle, OG preview सही
- [ ] `https://app.narad.sh` PWA install prompt (Chrome: address bar में install icon), icon सही
- [ ] LAN transfer 2 devices: file + folder + text + clipboard; SAS emoji match
- [ ] Internet transfer (एक device mobile data पर) via Pair → contact; via room link
- [ ] 1 GB file: progress, speed; Wi‑Fi बीच में off/on → resume
- [ ] Office network (या hotspot + VPN) पर transfer → TURN relay काम करे (§6)
- [ ] Extension unpacked load: right‑click → Send to Narad; Ctrl+Shift+Y clipboard
- [ ] Push nudge (अगर enabled): offline contact को nudge → notification
- [ ] Cloudflare → Workers → `narad-signaling` → Logs में errors नहीं
- [ ] `curl -I https://app.narad.sh` में `strict-transport-security` header
- [ ] Lighthouse (Chrome DevTools) landing page ≥ 95 performance, 100 accessibility

---

## 12. Monitoring + ops (launch के बाद)

- **Uptime**: UptimeRobot / Better Stack (free) → `https://signaling.narad.sh/health` हर 1 min, alert email/Telegram।
- **Logs/metrics**: Cloudflare → Workers → Observability (requests, errors, CPU); Pages → Web Analytics (cookie‑less, free) landing + app दोनों पर on करें।
- **Signaling audit** (optional, metadata‑only): Node self‑host में `AUDIT_LOG=1`; Workers पर observability logs काफ़ी हैं।
- **Backups**: user content है ही नहीं। सिर्फ़ KV (push subscriptions, licenses) — licenses दोबारा mint हो सकते हैं (Razorpay order id से)। KV export: `wrangler kv key list/get`।
- **Secret rotation**: `TURN_SECRET` बदलें → coturn + signaling दोनों पर एक साथ (1‑hour creds expire हो जाएँगे)। VAPID बदलने पर सारे push subscriptions invalid, users दोबारा opt‑in करेंगे।
- **Limits** (`apps/signaling/src/node.ts` / DO): 40 conn/IP, 5000 total (Node), 40 msg burst 10/s, 64 KB/msg, 50 peers/room (Team: seats×4)। Workers पर DO per‑room scale करता है।
- **Costs to watch**: Workers requests (free 100k/day, paid 10M/mo included), DO duration, TURN VPS bandwidth (20 TB पर्याप्त)।
- **Updates**: `main` पर merge → auto‑deploy; app का service worker `autoUpdate` है, users को अगली load पर नया version।

---

## 13. Self‑host customers (₹14,999/yr plan)

`infra/selfhost/README.md`: एक VPS, `cp .env.example .env` (DOMAIN, PUBLIC_IP, TURN_SECRET), `docker compose up -d --build` → Caddy खुद TLS लेता है। Air‑gapped offices: वही compose बिना TURN/push, internal DNS।

---

## 14. Post‑launch

- Product Hunt / Hacker News ("Show HN: zero‑storage P2P sharing for offices, India‑first"), demo GIF landing page से।
- Google Search Console में `narad.sh` verify करें, sitemap submit।
- Support: `hello@narad.sh` (Email Routing) + GitHub Issues।
- Roadmap जो अभी नहीं है: admin console UI, SSO, Tauri desktop (Rust toolchain), Firefox extension।

---

## Appendix A — Environment variable reference

| Name | Where | Meaning |
|---|---|---|
| `VITE_SIGNALING_URL` | web + extension build | `wss://…/ws`; app `/ice`, `/push/*` इसी origin से लेता है |
| `VITE_ICE_SERVERS` | web build (optional) | JSON `RTCIceServer[]` override |
| `NARAD_PORT` / `PORT` | signaling (Node) | listen port (default 8794) |
| `TURN_SECRET`, `TURN_URLS`, `TURN_TTL`, `STUN_URLS` | signaling | `/ice` credential minting |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | signaling | push nudge |
| `PUSH_STORE_FILE` | signaling (Node) | push subscriptions file; Workers: KV binding `PUSH` |
| `LICENSE_PUBLIC_KEY` | signaling + billing | verify Team tokens |
| `LICENSE_PRIVATE_KEY` | billing | mint tokens |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `PRICE_PER_SEAT_PAISE`, `ALLOWED_ORIGIN` | billing | checkout + webhook |
| `MAX_CONN_PER_IP`, `MAX_CONN_TOTAL`, `ROOM_CAPACITY`, `AUDIT_LOG` | signaling (Node) | limits + metadata log |
| `E2E_SIGNALING_PORT` | tests | isolated e2e signaling port |

## Appendix B — Troubleshooting

| Symptom | Cause → fix |
|---|---|
| Devices एक‑दूसरे को नहीं दिखते (same Wi‑Fi) | अलग public IP (guest VLAN / VPN) → Pair या room link use करें; `?sabha=0` तो नहीं लगा |
| "Connecting…" पर अटका, कभी secure नहीं | UDP blocked → TURN (§6) configure, `/ice` में relay URLs हों |
| Reload के बाद contact offline दिखे | signaling version पुराना; `143f5a2` वाला orphan‑room fix deployed हो |
| `wrangler deploy` DO error "requires paid plan" | Workers Paid ($5) लें या Node/Docker signaling (`apps/signaling/Dockerfile`) |
| Pages build fail "pnpm not found" | env `PNPM_VERSION=9.12.0`, `NODE_VERSION=22`; root directory `/` |
| Push "disabled" | KV binding `PUSH` + दोनों VAPID keys; browser को HTTPS चाहिए |
| Extension popup में devices नहीं | build‑time `VITE_SIGNALING_URL` गलत; `chrome://extensions` → service worker console देखें |
| License paste के बाद भी room full | signaling में `LICENSE_PUBLIC_KEY` खाली / billing से अलग key pair |
