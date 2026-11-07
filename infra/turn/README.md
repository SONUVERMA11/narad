# TURN (relay fallback)

Most office transfers never touch this: on the same Wi‑Fi, ICE picks a LAN host candidate and bytes stay on the router.
TURN only carries traffic when both direct and STUN‑reflexive paths fail (strict corporate NAT/firewall).

Options:
1. **coturn on a cheap VPS** (Hetzner/Contabo, ~₹400/mo, 20 TB traffic): `docker compose up -d` with `TURN_SECRET`, `TURN_REALM`, `TURN_PUBLIC_IP`.
   Open UDP/TCP 3478, TCP 5349 and UDP 49160‑49200. Put a TLS cert on 5349 so clients behind "443‑only" firewalls can use `turns:`.
2. **Cloudflare TURN** (first 1 TB/month free): generate short‑lived credentials from the signaling server and return them to clients.

Client config (`apps/web/.env`):
```
VITE_ICE_SERVERS=[{"urls":["stun:stun.l.google.com:19302"]},{"urls":["turn:turn.narad.sh:3478?transport=udp","turn:turn.narad.sh:3478?transport=tcp","turns:turn.narad.sh:5349"],"username":"<ts>:narad","credential":"<hmac>"}]
```
Phase 2 moves credential minting (`use-auth-secret` HMAC, 1‑hour TTL) into the signaling server so secrets never ship in the client bundle.
