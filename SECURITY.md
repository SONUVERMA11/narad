# Narad security model

_Last updated 7 Nov 2026 (v0.4). Report issues to security@narad.sh (PGP key to follow)._

## 1. Goals
1. **Nobody but the two endpoints can read what is shared.** Not the signaling server, not the TURN relay, not the push service.
2. **The server learns as little as possible:** who is online in which room (by hashed room id and a session id), when, and how many bytes of *signaling* were relayed. Never file names, sizes, text or clipboard contents.
3. **No accounts, no passwords.** Trust is per device, established in person (same network) or by a short code (SPAKE2).

## 2. Components and what each one sees

| Component | Sees | Never sees |
|---|---|---|
| Browser / extension / app (device) | everything the user shares | — |
| Signaling (Akash) | your IP, a session id, display name, device type, room ids, SDP/ICE blobs (IP addresses inside), timing | file names, sizes, content, chat, clipboard, who your contacts are (pair rooms are unlinkable hashes) |
| STUN | your IP | anything else |
| TURN (coturn) | your IP and encrypted DTLS/SCTP bytes | plaintext of anything |
| Push service (opt‑in) | that *some* contact nudged *this* device, when | who nudged, what for |

## 3. Cryptography
- **Transport:** WebRTC DTLS‑SRTP/SCTP as mandated by the browser.
- **Application layer (Chakra):** per session, ephemeral **ECDH P‑256** → **HKDF‑SHA256** (salt = both session ids) → **AES‑256‑GCM**, random 96‑bit IV per frame, every control message and every 64 KiB chunk encrypted independently. Forward secrecy per session.
- **Why a second layer?** DTLS protects against on‑path observers, but a hostile signaling server could substitute certificates (MITM) and the browser would not notice. The app layer gives the user something to verify:
  - **SAS:** 4 emojis derived from both ephemeral public keys (SHA‑256). Same on both screens ⇒ no MITM on this channel.
  - **Pairing (SPAKE2 over ristretto255, RFC 9382 construction):** the 6‑digit code is the password; the PAKE **context is the channel fingerprint** (hash of both ECDH public keys). A MITM’d channel yields different transcripts on each side, so confirmation fails. An attacker gets one online guess per rendezvous (10⁻⁶), never an offline dictionary attack. Output: a 256‑bit `pairSecret`.
- **Contacts:** `pairSecret` never leaves the two devices. Presence room = `p-` + SHA‑256(deviceIds, pairSecret); the server sees an opaque room id. Phase 5: sign presence with the device identity key (ECDSA P‑256, non‑extractable, IndexedDB).
- **Spaces:** 128‑bit random secret in the invite link’s `#fragment` (never sent in HTTP requests). Room id = SHA‑256(name, secret). Anyone with the link is a member; rotate by creating a new space.
- **Push nudge:** token = SHA‑256(pairSecret, targetDeviceId); push carries no payload; VAPID ES256.
- **TURN:** short‑lived HMAC‑SHA1 credentials (coturn `use-auth-secret`) minted by the signaling host, 1‑hour TTL.

## 4. Threats and status

| Threat | Status |
|---|---|
| Passive network observer | DTLS + app‑layer AES‑GCM. OK |
| Malicious / compromised signaling server (MITM) | Detectable via SAS; prevented for contacts via SPAKE2 context binding. Sabha and code rooms rely on the user comparing emojis. |
| Someone on the same public IP (office, CGNAT) sees your device | By design in the sabha. Mitigation: `?sabha=0`, use contacts/spaces; names are random animals. |
| Guessing a room code | Codes are `word-word-nn` (~10 bits) → **not a secret**; use for one‑offs only. Pair codes are 6 digits but PAKE‑protected (one guess). Space secrets 128 bits. |
| Flooding the signaling server | Per‑socket token bucket (40 burst / 10 s⁻¹), per‑IP and global connection caps, 64 KB payload cap, room capacity. |
| Malicious file from a peer | Narad does not scan content. Accept prompt shows names and sizes; auto‑accept is per contact and off by default. |
| Lost / stolen device | Identity key is non‑extractable but the device can still act. Remove the contact from the other device (leaves the pair room). Phase 5: remote revoke list. |
| Browser extension compromise | Same as the web app; the extension holds its own identity. |
| Metadata at the server | Audit log (opt‑in) is metadata only; default logs nothing per connection. |

## 5. Known limitations
- Same‑network discovery groups by public IP (IPv6 by /64). Behind CGNAT this can be larger than your office.
- The emoji SAS is only as good as the people comparing it.
- The push nudge is the only server‑side record (opaque subscription per contact pair); it is opt‑in.
- No authentication of display names: a peer can claim any name. Contacts show the name captured at pairing time.
- Code dependencies: `@noble/curves`, `@noble/hashes` (audited), WebCrypto for everything else. No other crypto.

## 6. Reporting
Email security@narad.sh. We aim to acknowledge within 48 hours and fix critical issues within 7 days. Please do not test against other people’s devices.
