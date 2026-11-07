import { APP, APP_HOST, bi, crumbs, faqHtml, faqLd, i, receiveBox, related } from '../layout.mjs'

const FAQ = [
  ['What is the maximum file size I can send?', 'There is no maximum. Narad streams the file from the sender’s disk to the receiver’s disk in chunks, so a 50 GB video uses the same memory as a photo. The only limit is the receiver’s free disk space.'],
  ['How fast is it?', 'On the same Wi‑Fi, typically 20–80 MB/s (your router is the limit). Over the internet it is bounded by the slower side’s upload speed, since the file goes directly between the devices without a server hop.'],
  ['What happens if the connection drops halfway?', 'Both sides freeze the transfer. When the devices see each other again (within 10 minutes) Narad resumes from the last byte that arrived. You never restart from zero.'],
  ['Can I send a whole folder?', 'Yes. Drag a folder in (or use the folder button). The structure is recreated on the other side. On desktop Chrome and Edge files are written directly to the folder you choose; other browsers download as usual.'],
  ['Do I need to compress or zip the files first?', 'No. Send them as they are. Compression would only add a step; the bottleneck is the network, not the file format.'],
]

const body = `
<article class="article">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Narad</a> › <span>${bi('Send large files', 'बड़ी फाइलें भेजें')}</span></nav>
    <span class="kicker">${i('file')} ${bi('10 GB? 100 GB? same thing.', '10 GB? 100 GB? एक ही बात।')}</span>
    <h1 data-en>Send large files online, <em class="s">free, no size limit</em></h1>
    <h1 data-hi>बड़ी फाइलें ऑनलाइन भेजो, <em class="s">मुफ़्त, बिना size limit</em></h1>
    <p class="lede">${bi('WeTransfer stops at 2 GB, email at 25 MB, WhatsApp compresses your video. Narad streams any file of any size directly from your device to theirs, resumes if the Wi‑Fi drops, and stores nothing on any server. No account, no waiting for an upload to finish before the download can start.', 'WeTransfer 2 GB पर रुकता है, email 25 MB पर, WhatsApp वीडियो compress कर देता है। Narad किसी भी size की फाइल सीधे आपके डिवाइस से उनके डिवाइस पर stream करता है, Wi‑Fi टूटे तो resume करता है, और किसी सर्वर पर कुछ store नहीं करता। न अकाउंट, न पहले upload खत्म होने का इंतज़ार।')}</p>
    <div class="cta-row"><a class="btn btn-signal" href="${APP}" data-app-link>${bi('Send a big file', 'बड़ी फाइल भेजो')} ${i('arrow')}</a><a class="btn" href="/receive">${i('key')} ${bi('I have a code', 'मेरे पास कोड है')}</a></div>
    <div class="prose">
      <h2>${bi('Why there is no size limit', 'Size limit क्यों नहीं है')}</h2>
      <p>${bi('Cloud transfer services have limits because they must store your file first and pay for that storage. Narad never stores the file: it opens an encrypted peer‑to‑peer connection (WebRTC) between the two devices and streams the bytes in back‑pressured chunks straight to disk. Nothing sits in RAM, nothing sits on a server, so there is nothing to cap.', 'Cloud transfer services में limit इसलिए है क्योंकि उन्हें पहले आपकी फाइल store करनी पड़ती है और उसका खर्च उठाना पड़ता है। Narad फाइल कभी store नहीं करता: दो डिवाइसों के बीच encrypted peer‑to‑peer कनेक्शन (WebRTC) खोलकर bytes को chunks में सीधे disk पर stream करता है। न RAM में कुछ, न सर्वर पर, तो cap किस बात का।')}</p>
      <h2>${bi('How to send a large file', 'बड़ी फाइल कैसे भेजें')}</h2>
      <ol>
        <li>${bi(`Open <a href="${APP}" data-app-link>${APP_HOST}</a> on both devices. On the same Wi‑Fi they see each other automatically; otherwise use <a href="/share-files-with-anyone">a 6‑digit code</a>.`, `दोनों डिवाइस पर <a href="${APP}" data-app-link>${APP_HOST}</a> खोलें। एक ही Wi‑Fi पर अपने आप दिखते हैं; वरना <a href="/share-files-with-anyone">6 अंकों का कोड</a> इस्तेमाल करें।`)}</li>
        <li>${bi('Drag the file or folder onto the device card, or pick it with the paperclip.', 'फाइल या फ़ोल्डर को device card पर drag करें, या paperclip से चुनें।')}</li>
        <li>${bi('The receiver taps Accept and chooses where to save. Progress, speed and ETA show on both sides.', 'पाने वाला Accept दबाकर जगह चुनता है। Progress, speed और ETA दोनों तरफ़ दिखते हैं।')}</li>
      </ol>
      <h2>${bi('Resumable transfers', 'Resumable transfer')}</h2>
      <p>${bi('If the connection drops at 80%, both devices keep their state: the sender keeps the file handle, the receiver keeps the open file and byte count. When they reconnect, the transfer continues from that byte. The resume window is 10 minutes; after a page reload the receiver asks for a clean restart instead.', 'कनेक्शन 80% पर टूटे तो दोनों डिवाइस अपनी state रखते हैं: भेजने वाला file handle, पाने वाला खुली फाइल और byte count। दोबारा जुड़ते ही transfer उसी byte से आगे चलता है। Resume window 10 मिनट है; page reload के बाद पाने वाला साफ़ restart माँगता है।')}</p>
      <h2>${bi('Large file sharing, compared', 'बड़ी फाइल भेजने के तरीके, तुलना')}</h2>
      <ul>
        <li><strong>WeTransfer:</strong> ${bi('2 GB free, 7‑day storage on their servers, account for more.', '2 GB मुफ़्त, 7 दिन उनके सर्वर पर, ज़्यादा के लिए अकाउंट।')}</li>
        <li><strong>Google Drive / Dropbox:</strong> ${bi('upload, wait, share link, download; quota counts; file lives in the cloud until you remember to delete it.', 'upload, इंतज़ार, link share, download; quota में गिनती; फाइल cloud में तब तक जब तक आप delete करना याद रखें।')}</li>
        <li><strong>WhatsApp / Telegram:</strong> ${bi('2 GB cap, videos recompressed, copies on their servers.', '2 GB cap, वीडियो recompress, उनके सर्वर पर copies।')}</li>
        <li><strong>USB drive:</strong> ${bi('honestly fine, if you have one, and it’s formatted right, and you’re in the same room.', 'सच में ठीक है, अगर पास हो, सही format हो, और आप एक ही कमरे में हों।')}</li>
        <li><strong>Narad:</strong> ${bi('no cap, no storage, direct, encrypted, resumes. Any browser.', 'न cap, न storage, सीधा, encrypted, resume। कोई भी ब्राउज़र।')}</li>
      </ul>
      <h2>FAQ</h2>
    </div>
    ${faqHtml(FAQ)}
    ${receiveBox()}
    ${related([['/share-files-with-anyone', 'Share with a code', 'to anyone, no account'], ['/airdrop-alternative', 'AirDrop alternative', 'Windows, Android, Linux'], ['/online-clipboard', 'Online clipboard', 'copy here, paste there']])}
  </div>
</article>
`
export default {
  path: '/send-large-files',
  title: 'Send Large Files Online Free — No Size Limit, No Account | Narad',
  description: 'Send large files online for free with no size limit: 10 GB, 100 GB, whole folders. Direct device‑to‑device, resumes after Wi‑Fi drops, end‑to‑end encrypted, nothing stored. No account.',
  body,
  jsonld: [crumbs([['Narad', '/'], ['Send large files', '/send-large-files']]), faqLd(FAQ)],
}
