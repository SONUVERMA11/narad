# NARAD (नारद) — Instant, Zero-Storage, Peer-to-Peer Sharing for Teams
### पूरा सिस्टम एनालिसिस, आर्किटेक्चर, रोडमैप और MVP स्कोप
_Version 0.4 · 7 Nov 2026 · MVP + Phases 2–4 built (contacts, spaces, extension, resume, clipboard sync, push, group send, licensing, billing, self‑host, landing); see README_

---

## 0. एक लाइन में प्रोडक्ट

> **Narad** = ऑफिस के किसी भी डिवाइस से किसी भी डिवाइस तक, एक क्लिक में, फाइल / टेक्स्ट / इमेज / क्लिपबोर्ड / कोड भेजो — बिना लॉगिन, बिना इंस्टॉल, बिना सर्वर पर कुछ स्टोर किए। Same Wi‑Fi पर LAN की फुल स्पीड से, और इंटरनेट पर एन्क्रिप्टेड P2P से।

नाम क्यों: नारद मुनि तीनों लोकों में पल भर में संदेश पहुँचाने वाले दिव्य दूत हैं, कहीं रुकते नहीं, कुछ रखते नहीं। "नारायण‑नारायण… पहुँच गया" ही ब्रांड का मूड है।

---

## 1. प्रॉब्लम (जो आपने बताई, साफ़ शब्दों में)

ऑफिस में एक सहकर्मी को फाइल/टेक्स्ट/कोड/स्क्रीनशॉट देना है। आज के रास्ते:

| रास्ता | दर्द |
|---|---|
| Email | 5–6 स्टेप, 25 MB लिमिट, inbox गंदा, कंपनी मेल पर पर्सनल फाइल |
| WhatsApp Web | फोन पास चाहिए, QR लॉगिन, फाइल कंप्रेस होती है, 2 GB लिमिट, डेटा Meta के पास |
| Slack/Teams | भारी, हर जगह नहीं, स्टोरेज लिमिट, external लोगों को नहीं |
| Pendrive / AirDrop | सिर्फ Apple‑to‑Apple, या फिज़िकली चलके जाओ |
| Google Drive/WeTransfer | अपलोड → लिंक → डाउनलोड, क्लाउड पर कॉपी रह जाती है, धीमा |

असली समस्या: **"बगल की डेस्क तक 500 MB भेजने के लिए डेटा मुंबई के सर्वर तक जाकर वापस आता है।"**

---

## 2. मार्केट एनालिसिस (competitors और गैप)

| प्रोडक्ट | कैसे काम करता है | ताकत | कमी / गैप जो हम भरेंगे |
|---|---|---|---|
| **Snapdrop / PairDrop** (open source, web) | WebRTC P2P, same‑network discovery by public IP, room codes | बिना इंस्टॉल, मुफ़्त, सबसे करीब हमारे आइडिया के | कोई saved contacts नहीं, कोई extension नहीं, कोई chat history/clipboard sync नहीं, बड़ी फाइल पर memory crash, teams फीचर नहीं, कोई बिज़नेस मॉडल नहीं |
| **LocalSend** (open source, native app) | LAN पर HTTP, mDNS discovery | बहुत तेज़, सभी OS | इंस्टॉल ज़रूरी, सिर्फ LAN, इंटरनेट पर नहीं, ब्राउज़र से नहीं |
| **Apple AirDrop / Google Quick Share** | OS‑level, Bluetooth+WiFi | बेस्ट UX | ecosystem‑lock, cross‑platform नहीं, इंटरनेट पर नहीं |
| **Wormhole.app / Magic Wormhole / croc** | P2P + कोड | सुरक्षित, बड़ी फाइल | हर बार नया कोड, कोई contacts/presence नहीं, CLI‑heavy |
| **FilePizza / ShareDrop / Instant.io** | WebTorrent / WebRTC | मुफ़्त | बेसिक, मेंटेनेंस कम, कोई टीम फीचर नहीं |
| **WeTransfer / Smash / Send Anywhere** | क्लाउड स्टोरेज + लिंक | भरोसेमंद, offline receiver | क्लाउड पर फाइल रहती है, कॉस्ट भारी, धीमा |
| **KDE Connect / Warpinator / Syncthing** | LAN device‑to‑device | clipboard sync, फाइल | गीक‑ओनली, सेटअप मुश्किल |
| **Slack / Teams / WhatsApp / Email** | सेंट्रल सर्वर | सब इस्तेमाल करते हैं | ऊपर टेबल देखें |

### मार्केट गैप (हमारी जगह)
1. **कोई भी प्रोडक्ट "LAN + Internet + Browser + Saved Contacts + Extension" एक साथ नहीं देता।** Snapdrop LAN‑web है, LocalSend LAN‑native, Wormhole internet‑code। Narad इन तीनों का यूनियन है।
2. **"Office mode"** — एक नामित स्पेस (जैसे `@advik-office`) जिसमें ऑफिस के सब डिवाइस हमेशा दिखें, चाहे Wi‑Fi हो या घर से VPN पर। किसी के पास नहीं।
3. **One‑click from anywhere** — right‑click → "Send to Rohan" ब्राउज़र एक्सटेंशन से। कोई नहीं देता।
4. **Zero‑storage + privacy‑first + India pricing** — WeTransfer ₹1000+/माह है; हम ₹0 पर्सनल, ₹99–199/यूज़र टीम।
5. **Clipboard‑first**: ऑफिस में 70% शेयरिंग छोटे टेक्स्ट/लिंक/स्निपेट/स्क्रीनशॉट की होती है, फाइल की नहीं। हम क्लिपबोर्ड को first‑class बनाते हैं।

---

## 3. प्रोडक्ट प्रिंसिपल्स (हर फैसले का फ़िल्टर)

1. **Server stores nothing.** सर्वर सिर्फ़ "परिचय" कराता है (signaling), डेटा कभी नहीं छूता। जो चीज़ सर्वर पर रखनी पड़े, वह फीचर default में नहीं जाएगा।
2. **Zero install, zero login.** पहली बार URL खोलो, 3 सेकंड में भेज दो। Extension/app सिर्फ़ और आसान बनाने के लिए, ज़रूरी नहीं।
3. **LAN first, Internet fallback.** एक ही Wi‑Fi पर डेटा राउटर से बाहर ही न जाए।
4. **E2E encrypted by default,** और इसे verify किया जा सके (SAS/emoji code), सिर्फ़ दावा नहीं।
5. **Cost scales with users, not with bytes.** Bytes पर हम पैसा न दें — वही बिज़नेस को मारता है।
6. **Works on the worst office network.** Corporate firewall, UDP ब्लॉक, CGNAT — सब पर fallback।

---

## 4. सिस्टम आर्किटेक्चर

### 4.1 Components (नामकरण भी माइथोलॉजी से, लेकिन कोड में साफ़ अंग्रेज़ी नाम)

```
┌──────────────────────────────────────────────────────────────────┐
│  CLIENTS (जहाँ डेटा रहता है — सिर्फ़ यहीं)                         │
│   • Web App (PWA)  • Browser Extension (MV3)  • Desktop (Tauri, later) │
│   • Android/iOS (later)                                           │
│                                                                   │
│   ┌─ Pushpak ─ transfer engine (chunking, streaming, resume)       │
│   ├─ Chakra  ─ crypto (X25519 + AES‑GCM, PAKE pairing, SAS verify) │
│   ├─ Sanjay  ─ presence/discovery (who is online, where)           │
│   └─ Setu    ─ connection (WebRTC, ICE, LAN‑first, TURN fallback)  │
└──────────────┬───────────────────────────────────┬───────────────┘
               │ WebSocket (signaling only)        │ UDP/TCP (media)
┌──────────────▼───────────────┐      ┌────────────▼────────────────┐
│  Akash — Signaling Server     │      │  STUN / TURN (relay fallback) │
│  Cloudflare Worker +          │      │  coturn on ₹400/mo VPS या     │
│  Durable Objects (WebSocket)  │      │  Cloudflare TURN               │
│  • rooms, presence, SDP/ICE   │      │  • encrypted bytes only pass   │
│  • stores NOTHING on disk     │      │  • cannot read anything        │
└──────────────────────────────┘      └───────────────────────────────┘
```

### 4.2 चार कनेक्शन मोड (user को ये ही दिखेंगे)

| मोड | नाम | कैसे | कब |
|---|---|---|---|
| 1 | **Sabha (सभा) — Same Network** | Signaling server एक ही public IP वाले devices को एक "sabha" में रखता है (Snapdrop तकनीक) + ICE host candidates से डेटा सीधे LAN पर जाता है | ऑफिस Wi‑Fi, घर Wi‑Fi |
| 2 | **Office / Team Space** | Persistent named space `@advik` — हर device एक बार join करता है (admin link/QR), फिर हमेशा दिखता है, चाहे किसी भी network पर हो | Remote + office hybrid |
| 3 | **Private ID + Saved Contacts** | हर user की एक ID `rohan#7K2P` और device keypair; एक बार pair (QR/PIN, PAKE) → contact save → अगली बार one‑click, अगर वो online है | दोस्त, क्लाइंट, freelancer |
| 4 | **Code / Link (Dootam)** | 6‑अक्षर कोड या लिंक `narad.app/d/pink-mango-42`; receiver को कुछ नहीं चाहिए, ब्राउज़र खोले और ले ले | अनजान को एक बार भेजना |

### 4.3 डेटा फ्लो (एक फाइल भेजने की कहानी)
1. Sender फाइल ड्रॉप करता है या `Ctrl+Shift+V` दबाता है (clipboard send)।
2. Setu: signaling पर offer भेजता है (SDP में कोई content नहीं)। ICE पहले LAN candidate ट्राई करता है → मिल गया तो डेटा राउटर से बाहर नहीं जाता। नहीं तो STUN → नहीं तो TURN (TCP/443 पर भी, ताकि corporate firewall पार हो)।
3. Chakra: दोनों तरफ़ ECDH से session key; metadata (नाम, साइज़, type) भी encrypted। Signaling server को सिर्फ़ ciphertext दिखता है।
4. Pushpak: फाइल को 64 KB chunks में stream करता है, `bufferedAmountLow` से backpressure, 4 parallel DataChannels से throughput; receiver सीधे disk पर stream करता है (File System Access API / service‑worker StreamSaver) ताकि 10 GB फाइल पर भी RAM न भरे। हर chunk का index → resume संभव।
5. Receiver को notification, auto‑accept अगर saved contact है, वरना accept/reject।
6. कनेक्शन बंद → सर्वर पर कुछ नहीं बचा, क्योंकि कुछ था ही नहीं।

### 4.4 Encryption (Chakra) — सिर्फ़ "WebRTC encrypted है" पर भरोसा नहीं
- WebRTC DTLS‑SRTP transport encryption तो है, लेकिन signaling server चाहे तो MITM कर सकता है। इसलिए **app‑layer E2E** अलग से:
  - हर device: Ed25519 identity key (sign) + X25519 (ECDH), ब्राउज़र के IndexedDB में, कभी सर्वर पर नहीं।
  - Pairing (contacts/office join): **PAKE (SPAKE2/OPAQUE‑style)** — छोटा PIN/QR, server को key नहीं मिलती।
  - हर transfer: fresh session key (forward secrecy), AES‑256‑GCM via WebCrypto (hardware‑fast)।
  - Verify: दोनों स्क्रीन पर 4 emoji/शब्द (जैसे Signal safety number) — "🪔 🐘 🥭 🌊"।
- Code/Link mode में key लिंक के `#fragment` में, जो सर्वर तक जाता ही नहीं।

### 4.5 Browser Extension (MV3) — "एक क्लिक" का असली मतलब
- Context menu: किसी भी पेज पर selected text / image / link पर right‑click → **Send to ▸ Rohan / Office / Last used**.
- Toolbar popup: online contacts, drag‑drop, clipboard‑send बटन, incoming notifications।
- Keyboard: `Ctrl+Shift+V` → clipboard को last contact को भेजो।
- Technical: MV3 service worker 30 सेकंड में सो जाता है → WebRTC के लिए **Offscreen Document** API; presence के लिए WebSocket को alarms से जगाए रखना। (ज्ञात समस्या, हल ज्ञात।)
- Firefox/Edge उसी कोडबेस से (WXT framework)।

### 4.6 Infra और Cost Model (क्यों लगभग मुफ़्त है)

| आइटम | चॉइस | कॉस्ट (शुरुआत) | 10,000 users पर |
|---|---|---|---|
| Frontend (PWA) | Cloudflare Pages | ₹0 | ₹0 |
| Signaling | Cloudflare Workers + Durable Objects (WebSocket hibernation) | ₹0–₹450/mo | ~₹1,500–3,000/mo |
| STUN | Google/Cloudflare public STUN | ₹0 | ₹0 |
| TURN (fallback only, ~10–15% sessions) | coturn on Hetzner/Contabo VPS (20 TB included) या Cloudflare TURN (1 TB free, फिर ~$0.05/GB) | ₹400/mo | ₹2,000–8,000/mo |
| Domain + email | narad.sh / getnarad.com | ₹1,500/साल | वही |
| Monitoring/Analytics | Cloudflare Analytics + Sentry free | ₹0 | ₹0–2,000 |
| **कुल** | | **≈ ₹500–1,000/माह** | **≈ ₹5–15k/माह** |

Key insight: ऑफिस LAN पर एक भी byte हमारे सर्वर से नहीं गुज़रता, इसलिए सबसे भारी use‑case (बड़ी फाइल, ऑफिस में) हमारे लिए **₹0** है। सिर्फ़ internet + firewall वाले केस TURN पर जाते हैं।

---

## 5. फीचर मैट्रिक्स (MoSCoW)

### MUST (MVP में)
- Same‑network auto discovery (Sabha), device को मज़ेदार auto‑name ("नीला गरुड़", "हरा मयूर")
- फाइल (multi, कोई size limit), टेक्स्ट, इमेज paste, clipboard send
- Room code / link से internet पर भेजना
- E2E encryption + emoji verify
- Streaming large files to disk, progress, cancel
- 1:1 ephemeral chat (text + files) एक ही कनेक्शन पर
- PWA (install to home screen), mobile browser support
- TURN fallback, TCP/443

### SHOULD (v1.0)
- Private ID + Saved contacts + PAKE pairing (QR)
- Office/Team space (`@advik`) — persistent presence
- Browser Extension (Chrome/Edge/Firefox): context menu, popup, hotkey
- Resume broken transfers, folder send (streaming zip)
- Group send (एक फाइल → 5 लोग) — mesh, ≤10 peers
- Push notifications (Web Push) "Rohan wants to send you a file" — payload में content नहीं, सिर्फ़ nudge

### COULD (v1.5+)
- Clipboard **sync** (continuous, KDE‑Connect style) between अपने devices
- Desktop app (Tauri): system tray, true mDNS LAN discovery, background receive, "Send to Narad" in OS share sheet / Finder right‑click
- Android app (share sheet target), iOS (share extension)
- Remote‑control snippets: "paste on that machine" (type into remote clipboard)
- Screen‑snap → send (built‑in screenshot tool)
- Self‑host (docker‑compose) + on‑prem relay "Narad Box" (Raspberry Pi) for offices with no internet
- Optional **ephemeral encrypted drop** (receiver offline होने पर): zero‑knowledge blob, key sender के पास, 24h TTL, paid plan — principle #1 का controlled exception, opt‑in

### WON'T (जानबूझकर नहीं)
- क्लाउड स्टोरेज / फाइल history / search — हम Drive नहीं हैं
- Username+password accounts — device keys + optional email recovery ही
- Video/voice calls शुरुआत में (WebRTC है तो लालच होगा; scope creep)
- Public "discover anyone" directory — spam और privacy का खतरा
- Large groups (>25) mesh पर — SFU चाहिए, बाद में सोचेंगे

---

## 6. Pros & Cons (ईमानदारी से)

### Pros
- **Privacy by architecture**, policy से नहीं — कंपनियों के लिए compliance आसान (data never leaves premises on LAN)।
- **लगभग शून्य running cost** — storage नहीं, egress नहीं।
- **LAN speed** — 100 MB/s+ Wi‑Fi 6 पर; WhatsApp/Drive से 10–50× तेज़।
- **Zero onboarding** — URL खोलो, काम हो गया; adoption friction सबसे कम।
- **Clear differentiation** — office space + contacts + extension का combination किसी के पास नहीं।
- **Open‑core संभव** — core open‑source करके trust + community, team features paid।

### Cons (और mitigation)
| Con | असर | Mitigation |
|---|---|---|
| **दोनों online होने चाहिए** (P2P की प्रकृति) | सबसे बड़ा UX gap vs email | Push nudge; extension/desktop app से "always on"; बाद में opt‑in ephemeral drop |
| ब्राउज़र टैब बंद → कनेक्शन खत्म | receive miss हो सकता है | Extension (offscreen doc), PWA, desktop tray app |
| Corporate firewall UDP ब्लॉक | P2P fail | TURN over TCP/443; LAN पर फिर भी direct |
| Same‑public‑IP discovery टूटती है (CGNAT, VPN, IPv6, Jio जैसे ISPs जहाँ पूरे शहर का एक IP) | गलत लोग सभा में दिख सकते हैं / अपने नहीं दिखते | Office space + pairing primary बनाएँ; सभा सिर्फ़ convenience; IPv6+IPv4 दोनों से group; local‑subnet probe |
| मोबाइल ब्राउज़र में बड़ी फाइल (iOS Safari memory, background kill) | 2 GB+ fail हो सकता है | Streaming to disk, chunk resume; native app बाद में |
| MV3 service worker lifetime | extension presence flaky | Offscreen document + alarms; तय समाधान है, पर maintenance चाहिए |
| कोई history नहीं | "वो फाइल कल भेजी थी, कहाँ है?" | Local‑only transfer log (device पर), re‑request बटन |
| Snapdrop/PairDrop मुफ़्त और open‑source हैं | "क्यों पैसे दें?" | पर्सनल मुफ़्त रखो; पैसे team/admin/SSO/self‑host/relay पर |
| Abuse (malware भेजना, harassment) | reputation | pairing‑only by default internet पर, block/report, file type warnings, कोई public directory नहीं |

---

## 7. रिस्क रजिस्टर
1. **Technical**: WebRTC quirks across Safari/Firefox/Chrome — Playwright cross‑browser CI दिन 1 से।
2. **Adoption**: "एक और टूल" — ऑफिस में एक champion, ऑफिस‑wide QR poster, extension से friction 0।
3. **Trust**: "encrypted है" साबित करना — open‑source crypto module, security whitepaper, external audit (बाद में)।
4. **Legal/India**: IT Rules intermediary — हम content रखते ही नहीं, पर ToS/abuse policy और DPDP Act compliance docs चाहिए।
5. **Naming**: "Narad" पर छोटे‑मोटे apps हो सकते हैं; trademark search (Class 9/42) करा लें। Backup: **Pushpak**, **Garud**, **Setu**, **Dootam**।

---

## 8. नाम: फाइनल सुझाव और विकल्प

| नाम | अर्थ/कहानी | ब्रांड फील | डोमेन (7 Nov 2026 whois) |
|---|---|---|---|
| **Narad (नारद)** ★ | त्रिलोक के संदेशवाहक, पल में पहुँचते हैं, कुछ रखते नहीं | मज़ेदार, यादगार, "नारायण‑नारायण" tagline material | narad.sh ✅, getnarad.com ✅, naradshare.com ✅, narad.io ❌ (2024 में लिया), narad.app — verify करें |
| Pushpak | पुष्पक विमान — जितना भरो, जगह बनी रहे; कोई size limit नहीं | premium, tech | pushpak.app ❌ (live) |
| Garud | सबसे तेज़ उड़ान | speed‑centric | garud.app — verify |
| Setu | राम सेतु — दो किनारों को जोड़ना | enterprise‑ish | "Aarogya Setu" से confusion |
| Dootam / Doot | दूत = messenger | classical | niche spelling |
| Sanjay | दिव्य दृष्टि — दूर का सब दिखे | presence/remote फील | common first name |

**सिफ़ारिश:** ब्रांड = **Narad**, tagline "Bhejo. Pahunch gaya." / "Share at the speed of Narad." और internal module names ऊपर 4.1 वाले (Pushpak/Chakra/Sanjay/Setu/Akash) — इससे डॉक्स और कोड दोनों में एक कहानी बनती है, और बाकी नाम भी "हमारे" हो जाते हैं।

---

## 9. रोडमैप

| फेज़ | अवधि | डिलीवरेबल | सफलता का पैमाना |
|---|---|---|---|
| **0 — Foundation** | Week 1 | नाम/डोमेन फाइनल, monorepo, design tokens, आर्किटेक्चर ADRs, signaling protocol spec | `pnpm dev` से web app + local signaling चलें |
| **1 — MVP "Sabha"** | Week 2–5 | Section 10 वाला MVP, narad.sh पर live | आपके ऑफिस के 10 लोग 1 हफ़्ता रोज़ इस्तेमाल करें; 1 GB फाइल LAN पर <30s |
| **2 — "Dootam"** ✅ (7 Nov 2026) | Week 6–9 | Private ID, contacts, SPAKE2 pairing, Office space, Chrome extension v1. Web Push nudge → Phase 3 (server‑side subscription storage का फैसला चाहिए) | 3 बाहरी टीमें; extension से 50% sends |
| **3 — "Pushpak"** ✅ (7 Nov 2026, partial) | Week 10–14 | Resume ✅, folders ✅, clipboard sync ✅, push nudge ✅ (opt‑in, metadata‑only exception), server‑minted TURN creds ✅, deploy/CI ✅. बाकी: group send, Tauri desktop (Rust toolchain चाहिए), Firefox ext | Daily active devices 1,000; TURN share <15% |
| **4 — "Rajya" (business)** ✅ (7 Nov 2026, partial) | Week 15–20 | Group send ✅, hardening + metadata‑only audit log ✅, Team licensing ✅, Razorpay billing worker ✅ (test‑mode, keys चाहिए), self‑host docker ✅, SECURITY/PRIVACY ✅, landing page ✅. बाकी: admin console UI, SSO, live Razorpay, domain + deploy, Product Hunt | पहले 20 paying teams |
| **5 — Mobile + Box** | Month 6+ | Android share‑sheet app, iOS, Narad Box (Pi relay for no‑internet offices), ephemeral encrypted drop (opt‑in) | — |

---

## 10. MVP स्कोप (जो हम अगले स्टेप में बनाएँगे)

### IN
1. **Web app (PWA)**: एक पेज। ऊपर "आप हैं: नीला गरुड़", बीच में online devices के बुलबुले, नीचे drop zone + text box + "Send clipboard"।
2. **Same‑network discovery** (public IP grouping) + **Room code** join (6 chars) + share link।
3. **Send**: multiple files (कोई size limit), text, pasted image, clipboard. **Receive**: accept/reject, progress, auto‑save via File System Access API, fallback download।
4. **1:1 chat** panel per peer (ephemeral, in‑memory)।
5. **E2E**: X25519 ECDH per session + AES‑GCM, emoji verification; keys IndexedDB में।
6. **Transfer engine**: 64 KB chunks, backpressure, 2–4 parallel channels, stream‑to‑disk, cancel।
7. **Signaling**: Cloudflare Worker + Durable Object per room; message types: `join, leave, peers, offer, answer, ice, ping`. कोई DB नहीं, कोई log में content नहीं।
8. **TURN**: coturn container (या Cloudflare TURN), TCP/443 fallback, short‑lived HMAC credentials।
9. **Quality**: Playwright tests (2 browsers एक‑दूसरे को फाइल भेजें), Lighthouse PWA ≥ 90।
10. **Branding**: Narad logo, दीया‑orange + midnight‑blue palette, Hindi/English toggle।

### OUT (MVP में नहीं)
Saved contacts, extension, push notifications, resume, folders, group send, desktop/mobile apps, billing — सब Phase 2+।

### MVP Tech Stack
- **Monorepo**: pnpm + Turborepo → `apps/web`, `apps/signaling`, `apps/extension` (later), `packages/core` (Setu/Pushpak/Chakra/Sanjay as pure TS), `packages/ui`
- **Web**: Vite + React + TypeScript + Tailwind + Zustand; PWA via vite‑plugin‑pwa
- **Core**: WebRTC DataChannel, WebCrypto, Dexie (IndexedDB), zod (protocol schemas)
- **Signaling**: Cloudflare Workers + Durable Objects (WebSocket Hibernation API), Hono
- **TURN**: coturn (Docker) या Cloudflare TURN
- **Tests**: Vitest (core), Playwright (e2e, multi‑context)
- **CI/CD**: GitHub Actions → Cloudflare Pages/Workers

### MVP में "done" का मतलब
- दो अलग laptops, एक ही Wi‑Fi, बिना किसी सेटअप: 1 GB फाइल <30 सेकंड, RAM flat।
- एक laptop ऑफिस, एक घर (Jio 4G): code से join, फाइल जाए (TURN पर भी)।
- Signaling server के logs/DB में transfer का कोई content/filename न मिले (audit script से साबित)।
- iPhone Safari + Android Chrome से text/image दोनों दिशा में।

---

## 11. बिज़नेस मॉडल (संक्षेप)
- **Free**: पर्सनल, unlimited LAN, internet P2P, 1 office space ≤ 10 devices।
- **Team ₹149/user/mo**: unlimited spaces, admin, SSO, device management, priority relay, audit log (metadata only), support।
- **Self‑host ₹ one‑time/yearly**: docker‑compose + license; Narad Box hardware।
- **Open‑core**: core (crypto, transfer, web) MIT/AGPL; team server features proprietary।

---

## 12. अभी आपसे चाहिए 4 फैसले
1. नाम **Narad** फाइनल? (हाँ तो narad.sh + getnarad.com आज ही लें)
2. MVP में chat रखें या सिर्फ़ share? (मेरी राय: रखें, एक ही channel पर है, cost ~2 दिन)
3. Signaling: Cloudflare (₹0, vendor‑lock) या अपना VPS Node/Go (₹400/mo, पूरा कंट्रोल)? (मेरी राय: Cloudflare से शुरू, protocol ऐसा कि बाद में VPS पर उठ जाए)
4. Open‑source core — हाँ/ना? (मेरी राय: हाँ, trust के लिए)
