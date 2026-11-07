# Deploying Narad

> Step-by-step production guide with accounts, DNS, secrets and checklists: [../GO-LIVE.md](../GO-LIVE.md). This file is the short reference.

Three pieces: static web app, signaling (Akash), TURN relay. Nothing stores user content.

## 1. Signaling (Akash)

**Cloudflare Workers + Durable Objects** (₹0 to start):
```bash
cd apps/signaling
npx wrangler secret put TURN_SECRET          # optional, see TURN below
npx wrangler deploy                          # → https://narad-signaling.<you>.workers.dev
```
Set `TURN_URLS` (and optional `TURN_TTL`, `STUN_URLS`) as plain vars in `wrangler.toml` `[vars]`.

**Node (Docker)** anywhere:
```bash
docker build -f apps/signaling/Dockerfile -t narad-signaling .
docker run -d -p 8794:8794 -e TURN_SECRET=… -e TURN_URLS=turn:turn.narad.sh:3478,turns:turn.narad.sh:5349 narad-signaling
```
Put it behind Caddy/nginx with WebSocket upgrade on `/ws`; `/ice` and `/health` are plain HTTP.

### Push nudge (optional)
```bash
node apps/signaling/scripts/vapid-keys.mjs      # prints VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
```
Node: set those env vars (+ `PUSH_STORE_FILE=/data/push.json` to survive restarts). Workers: `wrangler secret put VAPID_PRIVATE_KEY`, vars for the public key/subject, and a KV binding named `PUSH`. Without keys the feature is simply absent in the UI.

## 2. Web app (Cloudflare Pages / any static host)

```bash
VITE_SIGNALING_URL=wss://signaling.narad.sh/ws pnpm --filter @narad/web build   # → apps/web/dist
```
The app fetches `/ice` from the signaling host at start, so TURN credentials are never baked in.
`VITE_ICE_SERVERS` still works as an override. `public/_headers` sets security headers on Pages.

## 3. TURN (coturn)

See `infra/turn/README.md`. Generate a secret (`openssl rand -hex 32`), give the same value to coturn (`--static-auth-secret`) and to the signaling server (`TURN_SECRET`). Credentials are minted per client with a 1‑hour TTL.

## 4. Chrome extension

```bash
VITE_SIGNALING_URL=wss://signaling.narad.sh/ws pnpm --filter @narad/extension build
cd apps/extension/dist && zip -r ../narad-extension.zip .
```
Upload the zip to the Chrome Web Store dashboard (one-time $5 developer fee).

## 5. CI
`.github/workflows/ci.yml` runs typecheck, unit tests, builds and the Playwright e2e (incl. the extension in Chromium) on every push.

## 6. Landing page, billing, licenses
- `apps/site` → Cloudflare Pages (no build; root = `apps/site`).
- `node packages/license/scripts-keys.mjs` → `LICENSE_PUBLIC_KEY` on the signaling host (Team rooms), `LICENSE_PRIVATE_KEY` as a billing‑worker secret.
- `apps/billing`: `wrangler deploy` with Razorpay test keys, a webhook pointing at `/webhook` (event `payment.captured`), and a KV binding `LICENSES`. The web app pastes the token from `GET /license/:orderId` into Spaces → Team.
- Self‑host customers: `infra/selfhost/README.md`.
