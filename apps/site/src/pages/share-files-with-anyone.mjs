import { APP, APP_HOST, HOST, bi, crumbs, faqHtml, faqLd, howTo, i, receiveBox, related } from '../layout.mjs'

const FAQ = [
  ['Can I share files with someone who doesn’t have an account?', 'Yes, that is the whole point. Narad has no accounts. You get a 6‑digit code; they type it at ${HOST}/receive in any browser. Neither side installs anything.'],
  ['Can several people use the same code?', 'Yes. While the code is open (up to 15 minutes) everyone who types it gets the same files, each over their own encrypted connection. Handy for a meeting room or a classroom.'],
  ['Is a 6‑digit code safe?', 'The code only names a rendezvous room that exists for minutes; the content is encrypted end to end between the devices and the server rate‑limits joins. Both sides also see four emojis that must match. For long‑term sharing, add the person as a contact, which upgrades the session with SPAKE2 so the code can never be replayed.'],
  ['What can I share with a code?', 'Files of any size, whole folders, text, links, screenshots, or whatever is on your clipboard.'],
  ['Does the receiver need Wi‑Fi with me?', 'No. Codes work across the internet. On the same Wi‑Fi you don’t even need a code: devices find each other automatically.'],
]

const body = `
<article class="article">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Narad</a> › <span>${bi('Share with anyone', 'किसी को भी भेजें')}</span></nav>
    <span class="kicker">✦ ${bi('no account on either side', 'दोनों तरफ़ बिना अकाउंट')}</span>
    <h1 data-en>Share files with anyone, <em class="s">with just a code</em></h1>
    <h1 data-hi>किसी को भी फाइल भेजो, <em class="s">बस एक कोड से</em></h1>
    <p class="lede">${bi('No email attachments, no expiring links, no “please create an account to download”. Narad gives you a 6‑digit code. The other person types it and your files, text or clipboard arrive on their device, encrypted end to end, with nothing stored on any server.', 'न email attachment, न expire होने वाले लिंक, न “download के लिए अकाउंट बनाएँ”। Narad आपको 6 अंकों का कोड देता है। सामने वाला उसे डालता है और आपकी फाइल, टेक्स्ट या क्लिपबोर्ड उसके डिवाइस पर पहुँच जाता है, end‑to‑end encrypted, किसी सर्वर पर कुछ store किए बिना।')}</p>
    <div class="cta-row"><a class="btn btn-signal" href="${APP}" data-app-link>${bi('Make a code', 'कोड बनाओ')} ${i('arrow')}</a><a class="btn" href="/receive">${i('key')} ${bi('I have a code', 'मेरे पास कोड है')}</a></div>
    <div class="prose">
      <h2>${bi('How to share a file with a code', 'कोड से फाइल कैसे भेजें')}</h2>
      <ol>
        <li>${bi(`Open <a href="${APP}" data-app-link>${APP_HOST}</a> in any browser (phone or computer).`, `किसी भी ब्राउज़र में <a href="${APP}" data-app-link>${APP_HOST}</a> खोलें (फ़ोन या कंप्यूटर)।`)}</li>
        <li>${bi('Tap <strong>Share with code</strong>. Add files, a folder, or type / paste text. Tap <strong>Get code</strong>.', '<strong>कोड से भेजें</strong> दबाएँ। फाइल, फ़ोल्डर जोड़ें या टेक्स्ट लिखें / paste करें। <strong>कोड बनाएँ</strong> दबाएँ।')}</li>
        <li>${bi('Tell the other person the 6 digits, or send them the link / QR shown under the code.', 'सामने वाले को 6 अंक बताएँ, या कोड के नीचे दिखा लिंक / QR भेजें।')}</li>
        <li>${bi('They open <a href="/receive">${HOST}/receive</a>, type it, tap Accept. Done.', 'वे <a href="/receive">${HOST}/receive</a> खोलें, कोड डालें, Accept दबाएँ। बस।')}</li>
      </ol>
      <p>${bi('The code stays live for 15 minutes or until you tap <em>Stop sharing</em>. Every person who types it gets the same items over their own encrypted connection, and you see “Delivered to …” for each one.', 'कोड 15 मिनट या आपके <em>भेजना बंद करें</em> दबाने तक चलता है। जो भी डाले, उसे वही चीज़ें अपने encrypted कनेक्शन पर मिलती हैं, और आपको हर एक के लिए “पहुँच गया: …” दिखता है।')}</p>
      <h2>${bi('Turn a one‑time share into a contact', 'एक बार के share को contact बनाएँ')}</h2>
      <p>${bi('After the transfer, either side can tap <strong>Add as contact</strong>. Under the hood both devices already ran a password‑authenticated key exchange (SPAKE2) on the code, so the contact is bound to the real devices, not to the code. From then on you see each other online on any network and share without codes, with optional auto‑accept and <a href="/online-clipboard">clipboard sync</a>.', 'Transfer के बाद कोई भी तरफ़ <strong>संपर्क में जोड़ें</strong> दबा सकती है। अंदर‑अंदर दोनों डिवाइस कोड पर SPAKE2 चला चुके होते हैं, इसलिए contact असली डिवाइस से बँधता है, कोड से नहीं। अब से आप किसी भी नेटवर्क पर एक‑दूसरे को online देखते हैं और बिना कोड share करते हैं, optional auto‑accept और <a href="/online-clipboard">clipboard sync</a> के साथ।')}</p>
      <h2>${bi('Why a code beats a link', 'लिंक से कोड बेहतर क्यों')}</h2>
      <ul>
        <li><strong>${bi('Say it out loud.', 'बोल कर बता दो।')}</strong> ${bi('Across a desk, on a call, over the phone to your parents. No typing a URL on a TV remote.', 'मेज़ के पार, call पर, माता‑पिता को फ़ोन पर। TV remote पर URL टाइप करने की ज़रूरत नहीं।')}</li>
        <li><strong>${bi('Nothing to expire or leak.', 'कुछ expire या leak नहीं।')}</strong> ${bi('There is no file sitting on a server behind that link. When you stop sharing, there is nothing left anywhere.', 'उस लिंक के पीछे किसी सर्वर पर कोई फाइल नहीं पड़ी। भेजना बंद किया तो कहीं कुछ नहीं बचा।')}</li>
        <li><strong>${bi('Works on every device.', 'हर डिवाइस पर।')}</strong> ${bi('iPhone to Windows, Android to Mac, Linux to a Chromebook. If it has a browser, it works. See <a href="/airdrop-alternative">AirDrop for Windows and Android</a>.', 'iPhone से Windows, Android से Mac, Linux से Chromebook। ब्राउज़र है तो चलेगा। देखें <a href="/airdrop-alternative">Windows/Android के लिए AirDrop</a>।')}</li>
        <li><strong>${bi('No size limit.', 'कोई size limit नहीं।')}</strong> ${bi('Streams straight to disk and resumes if the connection drops. See <a href="/send-large-files">send large files</a>.', 'सीधे disk पर stream, कनेक्शन टूटे तो resume। देखें <a href="/send-large-files">बड़ी फाइलें भेजें</a>।')}</li>
      </ul>
      <h2>FAQ</h2>
    </div>
    ${faqHtml(FAQ)}
    ${receiveBox()}
    ${related([['/receive', 'Receive with a code', 'type the 6 digits here'], ['/send-large-files', 'Send large files free', 'no limit, resumes on drop'], ['/airdrop-alternative', 'AirDrop alternative', 'iPhone ↔ Windows ↔ Android']])}
  </div>
</article>
`
export default {
  path: '/share-files-with-anyone',
  title: 'Share Files with Anyone Using a 6‑Digit Code — Free, No Account | Narad',
  description: 'Share files, folders, text or your clipboard with anyone: get a 6‑digit code, they type it at ${HOST}/receive. No account, no size limit, end‑to‑end encrypted, nothing stored on a server.',
  body,
  jsonld: [crumbs([['Narad', '/'], ['Share files with anyone', '/share-files-with-anyone']]), howTo('Share files with anyone using a Narad code', [['Open Narad', 'Open ${APP_HOST} in any browser.'], ['Add items and get a code', 'Tap Share with code, add files or text, tap Get code.'], ['Tell them the code', 'They type the 6 digits at ${HOST}/receive and tap Accept.'], ['Add as contact', 'Optionally keep each other as contacts to share without codes next time.']], 'Share files with anyone, on any device, with a 6-digit code. No account, no size limit, end-to-end encrypted.'), faqLd(FAQ)],
}
