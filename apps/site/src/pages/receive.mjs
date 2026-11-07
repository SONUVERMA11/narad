import { APP, APP_HOST, HOST, bi, crumbs, faqHtml, faqLd, howTo, i, receiveBox, related } from '../layout.mjs'

const FAQ = [
  ['Where do I enter a Narad code?', 'Right here on ${HOST}/receive, or in the Narad app under “Receive”. Type the 6 digits and the app connects to the sender. The code never goes to a server; it only tells both browsers which rendezvous room to meet in.'],
  ['The code says nobody is sharing.', 'Codes are live for 15 minutes and only while the sender keeps Narad open. Ask them to tap “Get code” again and read you the new one.'],
  ['Do I need an account to receive?', 'No. Nothing to install, nothing to sign up for. Any modern browser on iPhone, Android, Windows, Mac or Linux works.'],
  ['Can I keep the sender as a contact?', 'Yes. After the transfer, tap “Add as contact”. From then on you see each other online on any network and can send without codes.'],
]

const body = `
<article class="article">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Narad</a> › <span>${bi('Receive', 'पाएँ')}</span></nav>
    <span class="kicker">${i('key')} ${bi('got a 6‑digit code?', '6 अंकों का कोड मिला?')}</span>
    <h1 data-en>Receive files <em class="s">with a code</em></h1>
    <h1 data-hi><em class="s">कोड से</em> फाइल पाएँ</h1>
    <p class="lede">${bi('Someone sent you a Narad code? Type it below. Your browser connects straight to their device, end‑to‑end encrypted, and the files, text or clipboard arrive in seconds. No account, no download.', 'किसी ने Narad कोड भेजा? नीचे डालें। आपका ब्राउज़र सीधे उनके डिवाइस से जुड़ता है, end‑to‑end encrypted, और फाइल, टेक्स्ट या क्लिपबोर्ड सेकंडों में आ जाता है। न अकाउंट, न download।')}</p>
    ${receiveBox()}
    <div class="prose">
      <h2>${bi('How receiving works', 'पाना कैसे काम करता है')}</h2>
      <ol>
        <li><strong>${bi('Type the code.', 'कोड डालें।')}</strong> ${bi('The Narad app opens with the code in the URL fragment (after the #), which browsers never send to a server.', 'Narad app URL fragment (# के बाद) में कोड लेकर खुलता है, जिसे ब्राउज़र कभी सर्वर को नहीं भेजता।')}</li>
        <li><strong>${bi('Devices meet.', 'डिवाइस मिलते हैं।')}</strong> ${bi('Both browsers join a short‑lived rendezvous room named by the code and open a direct WebRTC connection. Keys are derived on the devices (ECDH + HKDF), so the server never holds them.', 'दोनों ब्राउज़र कोड के नाम वाले short‑lived room में मिलते हैं और सीधा WebRTC कनेक्शन खोलते हैं। Keys डिवाइस पर बनती हैं (ECDH + HKDF), सर्वर के पास कभी नहीं।')}</li>
        <li><strong>${bi('Items arrive.', 'चीज़ें आती हैं।')}</strong> ${bi('Text shows up in the chat instantly. Files ask for one tap (“Accept”) and then stream straight to disk, so even a 10 GB folder is fine.', 'टेक्स्ट chat में तुरंत दिखता है। फाइलें एक tap (“Accept”) माँगती हैं और सीधे disk पर stream होती हैं, 10 GB फ़ोल्डर भी ठीक।')}</li>
        <li><strong>${bi('Keep them (optional).', 'जोड़ लें (optional)।')}</strong> ${bi('Tap “Add as contact” and you both see each other online from now on, no codes needed.', '“संपर्क में जोड़ें” दबाएँ और अब से आप दोनों एक‑दूसरे को online देखेंगे, बिना कोड।')}</li>
      </ol>
      <div class="note">${bi('Security note: a code only works while the sender keeps it open (max 15 minutes), and both screens show the same four emojis for the connection. If they differ, someone is in the middle: stop.', 'सुरक्षा नोट: कोड तभी चलता है जब तक भेजने वाला उसे खुला रखे (अधिकतम 15 मिनट), और दोनों स्क्रीन पर कनेक्शन के चार emoji एक जैसे दिखते हैं। अलग हों तो बीच में कोई है: रुक जाएँ।')}</div>
      <h2>${bi('Want to send instead?', 'भेजना है?')}</h2>
      <p>${bi(`Open <a href="${APP}" data-app-link>${APP_HOST}</a>, add files or text, tap <strong>Share with code</strong>. Read the code out loud, paste the link, or let them scan the QR. See <a href="/share-files-with-anyone">share files with anyone</a> for the full guide.`, `<a href="${APP}" data-app-link>${APP_HOST}</a> खोलें, फाइल या टेक्स्ट जोड़ें, <strong>कोड से भेजें</strong> दबाएँ। कोड बोल दें, लिंक paste करें, या QR scan करवाएँ। पूरी guide: <a href="/share-files-with-anyone">किसी को भी फाइल भेजें</a>।`)}</p>
      <h2>FAQ</h2>
    </div>
    ${faqHtml(FAQ)}
    ${related([['/share-files-with-anyone', 'Share files with anyone', 'the 6‑digit code, explained'], ['/send-large-files', 'Send large files free', 'no size limit, resumes on drop'], ['/online-clipboard', 'Online clipboard', 'copy here, paste there']])}
  </div>
</article>
`
export default {
  path: '/receive',
  title: 'Receive Files with a Code — Narad | Enter 6‑Digit Code, No Account',
  description: 'Got a Narad code? Enter the 6‑digit code to receive files, text or clipboard directly from the sender’s device. End‑to‑end encrypted, no account, works in any browser.',
  body,
  jsonld: [crumbs([['Narad', '/'], ['Receive', '/receive']]), howTo('Receive files with a Narad code', [['Type the code', 'Enter the 6-digit code at ${HOST}/receive and tap Receive.'], ['Accept', 'The sender’s device connects directly; tap Accept to save files, text appears instantly.'], ['Add as contact', 'Optionally keep the sender as a contact to share without codes next time.']], 'Receive files from any device with a 6-digit Narad code, end-to-end encrypted, no account.'), faqLd(FAQ)],
}
