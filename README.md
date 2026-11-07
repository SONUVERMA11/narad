# Narad (नारद) — Bhejo. Pahunch gaya.

Instant, end‑to‑end encrypted, **zero‑storage** sharing between devices: files of any size, text, images, clipboard and 1:1 chat.
Same Wi‑Fi → bytes never leave the router. Anywhere else → encrypted peer‑to‑peer over the internet with a room code.
The server only introduces peers; it never sees content.

Design doc: [NARAD-System-Design.md](./NARAD-System-Design.md)

## Monorepo

| Path | What |
|---|---|
| `packages/core` | Engine (framework‑free TypeScript): **Setu** (WebRTC + perfect negotiation), **Chakra** (ECDH + HKDF + AES‑GCM, SAS emojis), **Pushpak** (chunked, back‑pressured streaming transfer), **Sanjay** (presence/signaling client), `Narad` orchestrator |
| `apps/signaling` | **Akash** signaling server. Same room logic runs on Node (`src/node.ts`) and Cloudflare Durable Objects (`src/worker.ts`) |
| `apps/web` | PWA (Vite + React + Tailwind): sabha, rooms, **share with a 6‑digit code**, **pairing (SPAKE2) + contacts**, **spaces**, chat, transfers |
| `apps/extension` | **Chrome MV3 extension**: engine in an offscreen document, right‑click “Send to Narad ▸ device”, popup (clipboard / page / files), notifications, pairing & spaces |
| `packages/license` | Team licenses: ES256 JWT mint/verify, room capacity rules |
| `packages/icons` | Shared inline-SVG icon set (`<Icon name>`), used by web app and extension popup |
| `apps/billing` | Cloudflare Worker: Razorpay checkout → signed webhook → license token (KV) |
| `apps/site` | Static landing page (Hindi/English, light/dark theme, pricing, FAQ) + brand assets (`brand/`, `favicon.*`) for Cloudflare Pages |
| `infra/selfhost` | docker‑compose: Caddy (TLS) + web + signaling + coturn |
| `e2e` | Playwright: two browser contexts transfer to each other through real WebRTC |
| `infra/turn` | coturn relay fallback |

## Run locally

```bash
pnpm install
pnpm dev            # signaling on :8794 (NARAD_PORT), web on :5173
```

Status (7 Nov 2026, Phase 4): unit 38/38, Playwright e2e 11/11 — MVP transfers, SPAKE2 pairing + contact presence, spaces, the Chrome extension in real Chromium, a 24 MB transfer that survives a dropped connection, folder paths, and clipboard sync between paired devices.

## Phase 3 concepts

- **Resumable transfers** (`transfer.ts` + `narad.ts`): when the WebRTC connection drops mid‑transfer, both sides freeze state (`paused`): the sender keeps its `File` handles, the receiver keeps its open sink and per‑file byte counts. Narad reconnects to the same device (one side initiates: the impolite one, or whoever still holds state if the other reloaded), the new channel runs `resume-offer → resume-request(fromFile, fromOffset) → resume-ack` and streaming continues from that byte. Paused state expires after 10 minutes. A receiver that lost state (page reload) answers `resume-reject` and the sender reports a clean error.
- **Folders**: `FileMeta.path` carries the relative path. Drag a folder (or use 📁); with File System Access the tree is recreated under the chosen directory.
- **Clipboard sync** (per contact, each side opts in): the web app watches the clipboard only while focused and pushes changes to contacts with sync on; the extension reads via `execCommand('paste')` in its offscreen document, so it works in the background. Incoming clips from contacts without sync show as an “Apply” toast.
- **Push nudge (opt‑in)**: the single server‑side record in Narad. With VAPID keys configured, a device files its push subscription under one token per contact pair (`sha256(pairSecret, deviceId)`), so the server cannot tell who is whose contact. A nudge is an **empty** push; the service worker shows “a contact wants to send you something”. Rate‑limited, dropped when the push service says the subscription is gone. Enable with `node apps/signaling/scripts/vapid-keys.mjs` and the printed env vars; the 🔔 appears in the header when the host supports it.
- **TURN credentials** are minted by the signaling host (`GET /ice`, coturn `use-auth-secret`, 1‑hour TTL); the client fetches them at start.
- Deploy: `infra/DEPLOY.md` (Cloudflare Workers/Pages, Docker, coturn), CI in `.github/workflows/ci.yml`.

## Share with code (Phase 5)

`narad.startShare({ files, text })` joins room `share-<6 digits>`; every device that enters the code (`joinShare`, or `app/#code=…` from `narad.sh/receive`) gets its own encrypted channel and the items, for 15 minutes or until `stop()`. Both sides also run SPAKE2 on the code immediately, so **Add as contact** (either side, control message `contact-add`) adopts a device-bound contact without a second pairing step. e2e: `e2e/tests/share.spec.ts`.

## Phase 4 (“Rajya”: launch & business)

- **Group send**: ☑ Select many (or shift/⌘‑click cards) → one file set / text / clipboard to every selected device, each over its own encrypted channel; 📤 in a space selects all its online members.
- **Signaling hardening**: per‑socket token bucket (40 burst, 10/s), per‑IP and global connection caps, payload cap, room capacity; optional **metadata‑only audit log** (`AUDIT_LOG=1`: hashed room ids, peer counts, limit hits — never names or content); `/health` shows connections and uptime.
- **Team licensing**: `packages/license` mints/verifies ES256 JWTs (`plan`, `seats`, `exp`, `org`). A device stores its token (Spaces dialog → Team) and presents it on every join; a valid token lifts that room’s capacity to `seats × 4` (max 2000). Keys: `node packages/license/scripts-keys.mjs`; set `LICENSE_PUBLIC_KEY` on the signaling host.
- **Billing** (`apps/billing`, Cloudflare Worker): `POST /checkout {seats, org}` creates a Razorpay order; the `payment.captured` webhook is HMAC‑verified and mints a 31‑day license stored in KV; `GET /license/:orderId` hands it to the client. Test‑mode keys only; nothing live yet.
- **Self‑host**: `infra/selfhost` — one `docker compose up` with automatic HTTPS.
- **Docs**: `SECURITY.md` (threat model, crypto, what each component sees), `PRIVACY.md`.
- **Landing page** (“The Signal”: a fixed canvas where a packet travels from your device to theirs as you scroll; dark-first, paper light theme; Manrope + Instrument Serif): `apps/site` — pages live in `src/pages/*.mjs`, `pnpm --filter @narad/site build` renders them (plus `sitemap.xml`, `llms.txt`) into committed static HTML; Cloudflare Pages serves the folder as-is. Deployment config (domain, app URL, GitHub, email, “Developed by” name): `apps/site/site.config.json` or env; see GO-LIVE.md §7a. Keyword pages: `/share-files-with-anyone`, `/online-clipboard`, `/send-large-files`, `/airdrop-alternative`, `/receive`.

Not in this phase: the Tauri desktop app (needs a Rust toolchain on the build machine) and a Firefox build of the extension (Firefox MV3 has no offscreen documents; the engine would move into the background page).

## Phase 2 concepts

- **Pairing** (`packages/core/src/pake.ts`, `pairing.ts`): a 6‑digit code shown on one device, typed/scanned on the other. Both meet in a short‑lived rendezvous room, open the usual encrypted channel, then run **SPAKE2 over ristretto255** with the channel fingerprint as context. A wrong code or a MITM’d channel fails; an eavesdropper gets exactly one online guess, never an offline dictionary attack. The result is a shared `pairSecret`.
- **Contacts** (`contacts.ts`): a contact is just that pair secret. Both devices join the room `p-<hash(deviceIds, pairSecret)>` on every start, so they see each other on any network with no directory and no server‑side friend list. Removing a contact leaves the room. Optional auto‑accept per contact.
- **Spaces** (`spaces.ts`): “office mode”. A name plus a 128‑bit secret that lives in the invite link’s `#fragment` (never sent to the server). Everyone holding the link is in room `s-<hash(name, secret)>`, persistently. Share by link or QR.
- **Narad ID** (`naradId`): `rohan#7k2p`, a recognisable handle derived from your name and device key. It is not a lookup key (there is no directory to look up in); pairing is what connects people.
- `?sabha=0` disables same‑network discovery for a tab (privacy / tests).

### Chrome extension

```bash
pnpm --filter @narad/extension build     # → apps/extension/dist
```
Load `apps/extension/dist` as an unpacked extension (chrome://extensions → Developer mode). The engine runs in an **offscreen document** (MV3 service workers die after ~30 s; offscreen documents with the WEB_RTC reason do not), so your devices stay connected. Set `VITE_SIGNALING_URL` at build time for production.

Open http://localhost:5173 in two browsers/devices on the same network: they appear in each other's **sabha**.
Over the internet, click **Join room → Create room** and share the link.

## Design system (“Nishā + Mayur”)

**Logo**: the Narad mark is two pillars (devices) joined by one direct stroke (the transfer) — a two-tone “N”. Source: `apps/site/brand/mark.svg` (pillars in `currentColor`, stroke in the teal gradient); app/favicon tile: `apps/site/favicon.svg` (= `apps/web/public/icon.svg`). Rasters (favicon.ico, apple-touch-icon, 192/512 + maskable, `og.png`) are rendered with `pnpm --filter @narad/site icons`; extension PNGs draw the same geometry in `apps/extension/scripts/make-icons.mjs`.

The app is dark-first with glass surfaces, saffron primary; the landing page has light and dark themes (`data-theme`, follows the OS by default, toggle persisted in `localStorage`). Tokens live in `apps/web/src/index.css` (`@theme`) and are mirrored in `apps/site/index.html` and the extension popup. Icons are a shared inline-SVG set in `packages/icons` (`<Icon name="…" />`, Lucide-style, identical on every OS).

| Token | Hex | Use |
|---|---|---|
| `night-950 / 900 / 800` | `#06060d` `#0b0a18` `#141327` | page, panels, inputs |
| `accent-300 / 400 / 600` (kesar) | `#ffbe7a` `#ff9a3d` `#d9640f` | primary actions, active ring, sent bubbles, progress |
| `neel-400` | `#a78bfa` | spaces, multi-select |
| `kesar-500` / `sona-400` | `#ff8a3d` `#ffd166` | diya glow, room codes, contact star, unread badge |
| `ivory` / `ash` / `ash-dim` | `#f5f1e8` `#a7a3b8` `#6f6b82` | text scale |
| emerald / amber / rose | Tailwind | secure / connecting / error |

Type: **Manrope** (variable, Latin) + **Noto Sans Devanagari**, both self-hosted (no Google Fonts call). Utilities: `card`, `card-float`, `glass`, `btn-primary`, `btn-ghost`, `btn-icon`, `input`, `pill-*`, `avatar-ring`, `text-gradient`, `eyebrow`. Motion: `rise`, `modal-in`, `toast-in`, `progress-bar` shimmer, `pulse-ring`; all respect `prefers-reduced-motion`. Extension PNG icons: `pnpm --filter ./apps/extension icons`.

## Test

```bash
pnpm test           # unit tests (core crypto/chunking, signaling rooms)
pnpm e2e            # Playwright end-to-end (builds web, starts signaling)
E2E_SIGNALING_PORT=8796 pnpm e2e   # isolate from a running dev server / a loaded extension on this machine
pnpm typecheck
```

## Deploy

Full production walkthrough (domains, secrets, Cloudflare, TURN, billing, Web Store, monitoring): **[GO-LIVE.md](./GO-LIVE.md)**. Gate every deploy with `SIGNALING_URL=wss://… ./scripts/preflight.sh`.

- **Web**: `pnpm --filter @narad/web build` → `apps/web/dist` to Cloudflare Pages/Netlify/any static host. Set `VITE_SIGNALING_URL` and `VITE_ICE_SERVERS` in `apps/web/.env`.
- **Signaling**: `pnpm --filter @narad/signaling deploy:cf` (Cloudflare Workers + Durable Objects), or `PORT=8794 pnpm --filter @narad/signaling start` behind any reverse proxy with WebSocket support.
- **TURN**: see `infra/turn/README.md`.

## Security model (MVP)

- WebRTC DTLS on the wire **plus** app‑layer E2E: P‑256 ECDH → HKDF‑SHA256 → AES‑256‑GCM per session.
- 4‑emoji short authentication string shown on both devices; compare to rule out a MITM signaling server.
- Device identity key (ECDSA P‑256, non‑extractable) lives in IndexedDB. Phase 2 uses it for signed pairing.
- The signaling server validates messages, caps rooms at 50 peers and 64 KB/message, and stores nothing.
- Pairing: SPAKE2 (ristretto255), context‑bound to the channel fingerprint; pair secrets and space secrets live only on devices (IndexedDB).
