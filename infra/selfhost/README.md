# Self-host Narad (one VPS, ~₹400/month)

```bash
cd infra/selfhost
cp .env.example .env            # set DOMAIN, PUBLIC_IP, TURN_SECRET (openssl rand -hex 32)
docker compose up -d --build
```
DNS: `A` records for `narad.example.com`, `signaling.narad.example.com`, `turn.narad.example.com` → your VPS.
Open ports 80, 443, 3478/udp+tcp, 5349/tcp, 49160‑49200/udp. Caddy gets TLS certificates automatically.

What runs: nginx (static web app), signaling (Node, stores nothing except opt‑in push subscriptions in `/data/push.json`), coturn (relay for strict NATs; sees only encrypted bytes).
Set `AUDIT_LOG=1` for metadata‑only JSON logs (hashed room ids, peer counts, limit hits — never names or content).
