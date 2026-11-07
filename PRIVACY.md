# Privacy

**Short version:** Narad moves data from your device straight to the other device. Our servers introduce the two devices and then step aside. We cannot read, store or recover anything you share, because it never reaches us.

## What we process, and for how long
| Data | Where | Retention |
|---|---|---|
| Your IP address, a random session id, your chosen device name, device type | signaling server, in memory while connected | gone when you disconnect |
| Room identifiers (same‑network hash, room codes, hashed contact/space rooms) | signaling server, in memory | gone when the room empties |
| WebRTC connection offers (contain IP addresses) | relayed through signaling, never written | not stored |
| Encrypted transfer bytes (only if direct connection fails) | TURN relay, in transit | not stored |
| **Push subscription** (opt‑in “nudge me”) | signaling host, keyed by a token only your contact can derive | until you turn nudges off or the push service invalidates it (max 90 days on Cloudflare KV) |
| Contacts, spaces, settings, identity key | **your device only** (IndexedDB) | until you clear site data |
| Aggregate counts (rooms, peers, limit hits) | optional metadata‑only logs (`AUDIT_LOG=1`), hashed room ids | operator‑defined |

We use no analytics SDKs, no cookies, no third‑party scripts. The web app is a static site.

## Your rights
Everything personal lives on your device: clear site data and it is gone. Remove a contact on either device and the shared room ceases to exist. For questions: privacy@narad.sh.

## Self‑hosting
Teams can run the whole stack on their own infrastructure (`infra/selfhost`); then no Narad‑operated server is involved at all.
