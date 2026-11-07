import { APP, APP_HOST, HOST, bi, crumbs, faqHtml, faqLd, i, receiveBox, related } from '../layout.mjs'

const FAQ = [
  ['Is there AirDrop for Windows?', 'Not from Apple. Narad gives Windows the same experience in the browser: open ${APP_HOST} on the PC and on the iPhone (same Wi‑Fi), they see each other, drag a file across. No install.'],
  ['How do I AirDrop from iPhone to Android?', 'Open Narad on both. On the same Wi‑Fi they appear in each other’s list automatically; otherwise share a 6‑digit code. Photos keep full quality: nothing is recompressed.'],
  ['Does it work without internet?', 'On the same Wi‑Fi the bytes go through your router, not the internet. A signaling server is still needed once to introduce the devices; the self‑host edition runs that inside your office for fully offline networks.'],
  ['Is it as fast as AirDrop?', 'On the same Wi‑Fi you get your router’s speed, typically 20–80 MB/s. AirDrop uses a direct Wi‑Fi link so it can be faster for huge files between two Apple devices; across platforms it simply does not exist.'],
  ['Does Narad work on Linux and Chromebook?', 'Yes. Anything with a modern browser: Chrome, Edge, Firefox, Safari, Brave.'],
]

const body = `
<article class="article">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Narad</a> › <span>${bi('AirDrop alternative', 'AirDrop विकल्प')}</span></nav>
    <span class="kicker">${i('phone')} ${bi('iPhone ↔ Windows ↔ Android ↔ Mac ↔ Linux', 'iPhone ↔ Windows ↔ Android ↔ Mac ↔ Linux')}</span>
    <h1 data-en>AirDrop for Windows, Android <em class="s">and everything else</em></h1>
    <h1 data-hi>Windows, Android <em class="s">और सबके लिए</em> AirDrop</h1>
    <p class="lede">${bi('AirDrop is great, until the other person has a Windows laptop or an Android phone. Narad is the cross‑platform AirDrop alternative that runs in the browser: devices on the same Wi‑Fi find each other instantly, files go straight across your router, and anyone further away gets a 6‑digit code. No app, no account, no size limit.', 'AirDrop अच्छा है, जब तक सामने वाले के पास Windows लैपटॉप या Android फ़ोन न हो। Narad ब्राउज़र में चलने वाला cross‑platform AirDrop विकल्प है: एक ही Wi‑Fi पर डिवाइस तुरंत एक‑दूसरे को देखते हैं, फाइलें सीधे राउटर से जाती हैं, और दूर वालों को 6 अंकों का कोड। न app, न अकाउंट, न size limit।')}</p>
    <div class="cta-row"><a class="btn btn-signal" href="${APP}" data-app-link>${bi('Open on both devices', 'दोनों डिवाइस पर खोलो')} ${i('arrow')}</a><a class="btn" href="/receive">${i('key')} ${bi('I have a code', 'मेरे पास कोड है')}</a></div>
    <div class="prose">
      <h2>${bi('How to “AirDrop” between iPhone and Windows', 'iPhone और Windows के बीच “AirDrop” कैसे करें')}</h2>
      <ol>
        <li>${bi(`Connect both to the same Wi‑Fi and open <a href="${APP}" data-app-link>${APP_HOST}</a> on each.`, `दोनों को एक ही Wi‑Fi से जोड़ें और हर एक पर <a href="${APP}" data-app-link>${APP_HOST}</a> खोलें।`)}</li>
        <li>${bi('Each device appears on the other’s screen with a name like “Kesari Mayur”. Tap it.', 'हर डिवाइस दूसरे की स्क्रीन पर “Kesari Mayur” जैसे नाम से दिखता है। उस पर tap करें।')}</li>
        <li>${bi('Drop a file, pick photos, or paste text. The other side taps Accept. Both screens show the same four emojis: that is your proof the connection is encrypted end to end.', 'फाइल drop करें, photos चुनें, या टेक्स्ट paste करें। दूसरी तरफ़ Accept। दोनों स्क्रीन पर वही चार emoji: यही सबूत कि कनेक्शन end‑to‑end encrypted है।')}</li>
      </ol>
      <p>${bi('Not on the same network? Tap <strong>Share with code</strong> and read them the 6 digits; they enter it at <a href="/receive">${HOST}/receive</a>. Pair once and you see each other on any network afterwards.', 'एक ही नेटवर्क पर नहीं? <strong>कोड से भेजें</strong> दबाकर 6 अंक बता दें; वे <a href="/receive">${HOST}/receive</a> पर डालें। एक बार pair करें और बाद में किसी भी नेटवर्क पर एक‑दूसरे को देखें।')}</p>
      <h2>${bi('What you get that AirDrop doesn’t', 'AirDrop से ज़्यादा क्या मिलता है')}</h2>
      <ul>
        <li>${bi('<strong>Every platform.</strong> Windows, Android, Linux, Chromebook, Mac, iPhone, iPad.', '<strong>हर platform।</strong> Windows, Android, Linux, Chromebook, Mac, iPhone, iPad।')}</li>
        <li>${bi('<strong>Over the internet too.</strong> Codes and contacts work from anywhere, not just within Bluetooth range.', '<strong>इंटरनेट पर भी।</strong> कोड और contacts कहीं से भी चलते हैं, सिर्फ़ Bluetooth range में नहीं।')}</li>
        <li>${bi('<strong><a href="/online-clipboard">Clipboard sync</a></strong> between your own devices, like Universal Clipboard but cross‑platform.', '<strong><a href="/online-clipboard">Clipboard sync</a></strong> आपके अपने डिवाइसों के बीच, Universal Clipboard जैसा पर cross‑platform।')}</li>
        <li>${bi('<strong>Teams.</strong> One invite link puts the whole office in a shared space; send a file to everyone at once.', '<strong>टीमें।</strong> एक invite link से पूरा ऑफिस एक shared space में; सबको एक साथ भेजें।')}</li>
        <li>${bi('<strong>Resumes.</strong> Wi‑Fi hiccup at 80% of a 10 GB file? It continues from the last byte. See <a href="/send-large-files">send large files</a>.', '<strong>Resume।</strong> 10 GB फाइल के 80% पर Wi‑Fi झटका? उसी byte से आगे चलता है। देखें <a href="/send-large-files">बड़ी फाइलें</a>।')}</li>
      </ul>
      <h2>${bi('Nearby Share, Quick Share, Snapdrop, Narad', 'Nearby Share, Quick Share, Snapdrop, Narad')}</h2>
      <p>${bi('Google’s Quick Share covers Android and Windows but not iPhone or Mac. Snapdrop/PairDrop‑style web tools are a good idea with no contacts, no codes for the internet, and no resume. Narad keeps the browser simplicity and adds share codes, contacts, spaces, clipboard sync, resumable transfers and a server that provably never sees your content.', 'Google का Quick Share Android और Windows तक है, iPhone या Mac नहीं। Snapdrop/PairDrop जैसे web tools अच्छा idea हैं पर उनमें contacts नहीं, इंटरनेट के लिए कोड नहीं, resume नहीं। Narad ब्राउज़र की सादगी रखते हुए share code, contacts, spaces, clipboard sync, resumable transfer और ऐसा सर्वर जोड़ता है जो साबित तौर पर आपका content कभी नहीं देखता।')}</p>
      <h2>FAQ</h2>
    </div>
    ${faqHtml(FAQ)}
    ${receiveBox()}
    ${related([['/share-files-with-anyone', 'Share with a code', 'anyone, anywhere'], ['/send-large-files', 'Send large files', 'no limit'], ['/online-clipboard', 'Online clipboard', 'iPhone ↔ Windows']])}
  </div>
</article>
`
export default {
  path: '/airdrop-alternative',
  title: 'AirDrop for Windows & Android: Free Cross‑Platform AirDrop Alternative in Your Browser | Narad',
  description: 'AirDrop alternative that works between iPhone, Android, Windows, Mac and Linux. Same Wi‑Fi: devices find each other instantly. Anywhere else: a 6‑digit code. No app, no account, no size limit, end‑to‑end encrypted.',
  body,
  jsonld: [crumbs([['Narad', '/'], ['AirDrop alternative', '/airdrop-alternative']]), faqLd(FAQ)],
}
