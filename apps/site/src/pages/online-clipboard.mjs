import { APP, HOST, bi, crumbs, faqHtml, faqLd, i, related } from '../layout.mjs'

const FAQ = [
  ['Is this an online clipboard like a paste site?', 'No. Paste sites store your text on their server behind a URL. Narad moves the text directly between your devices, encrypted, and keeps nothing. If you want a one‑off paste for someone else, use a share code instead.'],
  ['Can I sync my clipboard between iPhone and Windows?', 'Yes. Pair the two devices once (6‑digit code), turn on clipboard sync for that contact on both sides, and anything you copy on one shows up on the other while Narad is open. On a phone the browser needs to be in the foreground to read the clipboard; the Chrome extension on desktop works in the background.'],
  ['Does clipboard sync send everything I copy?', 'Only while Narad is focused (web) or the extension is running (Chrome), only to contacts where you turned sync on, and never anything over 200 KB. Passwords copied from a password manager are usually cleared by the manager within seconds; still, turn sync off on shared computers.'],
  ['Can I send a screenshot from my clipboard?', 'Yes. Copy an image, press Ctrl/⌘+Shift+V in Narad, and the image goes to the selected device as a file.'],
]

const body = `
<article class="article">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Narad</a> › <span>${bi('Online clipboard', 'ऑनलाइन क्लिपबोर्ड')}</span></nav>
    <span class="kicker">${i('clipboard')} ${bi('copy here, paste there', 'यहाँ copy, वहाँ paste')}</span>
    <h1 data-en>Online clipboard <em class="s">between your devices</em></h1>
    <h1 data-hi>आपके डिवाइसों के बीच <em class="s">ऑनलाइन क्लिपबोर्ड</em></h1>
    <p class="lede">${bi('Copy an OTP on your phone, paste it on your laptop. Copy a link on your work PC, paste it on your Mac at home. Narad syncs your clipboard between devices end‑to‑end encrypted, without ever storing it on a server. It also sends text, links and screenshots to any device with a 6‑digit code.', 'फ़ोन पर OTP copy करो, लैपटॉप पर paste। ऑफिस PC पर लिंक copy, घर के Mac पर paste। Narad आपका क्लिपबोर्ड डिवाइसों के बीच end‑to‑end encrypted sync करता है, बिना सर्वर पर store किए। 6 अंकों के कोड से किसी भी डिवाइस को टेक्स्ट, लिंक, स्क्रीनशॉट भी भेजता है।')}</p>
    <div class="cta-row"><a class="btn btn-signal" href="${APP}" data-app-link>${bi('Open Narad', 'Narad खोलें')} ${i('arrow')}</a><a class="btn" href="/#extension">${i('chrome')} ${bi('Chrome extension', 'Chrome extension')}</a></div>
    <div class="prose">
      <h2>${bi('Three ways to use it', 'तीन तरीके')}</h2>
      <h3>${bi('1. Clipboard sync (your own devices)', '1. Clipboard sync (आपके अपने डिवाइस)')}</h3>
      <p>${bi('Pair your phone and computer once with a 6‑digit code, open the contact and tick <strong>clipboard sync</strong> on both devices. From then on, copy on one, paste on the other. Works iPhone ↔ Windows, Android ↔ Mac, Linux ↔ anything with a browser. Incoming clips show an “Apply” toast if the browser can’t write the clipboard silently.', 'फ़ोन और कंप्यूटर को एक बार 6 अंकों के कोड से जोड़ें, contact खोलें और दोनों डिवाइस पर <strong>clipboard sync</strong> tick करें। अब एक पर copy, दूसरे पर paste। iPhone ↔ Windows, Android ↔ Mac, Linux ↔ कुछ भी जिसमें ब्राउज़र हो। ब्राउज़र चुपचाप clipboard न लिख सके तो आने वाला clip “Apply” toast दिखाता है।')}</p>
      <h3>${bi('2. Send clipboard once', '2. एक बार clipboard भेजो')}</h3>
      <p>${bi('Select a device, press <kbd>Ctrl/⌘ + Shift + V</kbd> or tap the clipboard button. Text goes as a message; a copied image or screenshot goes as a file. The Chrome extension adds <em>Send clipboard to last device</em> as <kbd>Ctrl/⌘ + Shift + Y</kbd> and a right‑click menu on any text, link or image.', 'डिवाइस चुनें, <kbd>Ctrl/⌘ + Shift + V</kbd> दबाएँ या clipboard बटन tap करें। टेक्स्ट मैसेज की तरह जाता है; copied image या screenshot फाइल की तरह। Chrome extension में <kbd>Ctrl/⌘ + Shift + Y</kbd> से <em>last device को clipboard भेजो</em> और किसी भी टेक्स्ट, लिंक, इमेज पर right‑click menu।')}</p>
      <h3>${bi('3. Paste to anyone with a code', '3. कोड से किसी को भी paste')}</h3>
      <p>${bi('Someone across the table needs that long Wi‑Fi password or a meeting link? Tap <strong>Share with code</strong>, paste the text, read them the 6 digits. They type it at <a href="/receive">${HOST}/receive</a> and the text is on their screen. No chat app, no “let me email it to myself”.', 'सामने बैठे किसी को लंबा Wi‑Fi password या meeting link चाहिए? <strong>कोड से भेजें</strong> दबाएँ, टेक्स्ट paste करें, 6 अंक बोल दें। वे <a href="/receive">${HOST}/receive</a> पर डालें और टेक्स्ट उनकी स्क्रीन पर। न chat app, न “खुद को email कर लेता हूँ”।')}</p>
      <div class="note">${bi('Privacy by construction: clipboard contents travel inside the same AES‑256‑GCM channel as files. The Narad server only ever sees that two devices are connected, never what they exchange.', 'बनावट से private: clipboard content उसी AES‑256‑GCM चैनल में जाता है जिसमें फाइलें। Narad का सर्वर सिर्फ़ यह देखता है कि दो डिवाइस जुड़े हैं, क्या exchange हुआ कभी नहीं।')}</div>
      <h2>${bi('Narad vs other online clipboards', 'Narad बनाम बाकी online clipboard')}</h2>
      <ul>
        <li><strong>${bi('Paste sites / “online notepad”:', 'Paste sites / “online notepad”:')}</strong> ${bi('store your text on their server, often publicly guessable. Narad stores nothing.', 'आपका टेक्स्ट अपने सर्वर पर रखते हैं, अक्सर guess करने योग्य URL पर। Narad कुछ store नहीं करता।')}</li>
        <li><strong>${bi('Apple Universal Clipboard:', 'Apple Universal Clipboard:')}</strong> ${bi('great, Apple‑only. Narad works across iPhone, Android, Windows, Mac and Linux.', 'अच्छा है, सिर्फ़ Apple। Narad iPhone, Android, Windows, Mac, Linux सब पर।')}</li>
        <li><strong>${bi('Chat apps (“message myself”):', 'Chat apps (“खुद को message”):')}</strong> ${bi('every clip becomes a stored message in someone’s cloud. Narad is device to device and ephemeral.', 'हर clip किसी के cloud में stored message बन जाता है। Narad डिवाइस‑से‑डिवाइस और ephemeral है।')}</li>
      </ul>
      <h2>FAQ</h2>
    </div>
    ${faqHtml(FAQ)}
    ${related([['/share-files-with-anyone', 'Share with a code', 'text, links, files to anyone'], ['/airdrop-alternative', 'AirDrop for Windows & Android', 'cross‑platform sharing'], ['/receive', 'Receive with a code', 'type the 6 digits']])}
  </div>
</article>
`
export default {
  path: '/online-clipboard',
  title: 'Online Clipboard: Copy on One Device, Paste on Another (iPhone, Android, Windows, Mac) | Narad',
  description: 'Free online clipboard that syncs between your phone and computer, end‑to‑end encrypted, nothing stored. Copy on iPhone or Android, paste on Windows or Mac. Send text, links and screenshots to any device with a code.',
  body,
  jsonld: [crumbs([['Narad', '/'], ['Online clipboard', '/online-clipboard']]), faqLd(FAQ)],
}
