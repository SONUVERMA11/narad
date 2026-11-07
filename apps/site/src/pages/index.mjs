import { APP, APP_HOST, APP_LD, GITHUB, HOST, ORG, SITE, bi, ctaBand, faqHtml, faqLd, i } from '../layout.mjs'

const FAQ = [
  ['Is Narad really free to send files online?', 'Yes. Personal use is free with no size limit, no account and no ads. Teams pay ₹149 per user per month for shared spaces, priority relays and an admin console.', 'क्या Narad से फाइल भेजना सच में मुफ़्त है?', 'हाँ। Personal use मुफ़्त है: न size limit, न अकाउंट, न ads। टीमें shared spaces, priority relay और admin console के लिए ₹149/user/महीना देती हैं।'],
  ['How do I share a file with someone who doesn’t have Narad?', `Open Narad, add the file or text, tap “Share with code”. Tell them the 6‑digit code; they type it at ${HOST}/receive in any browser. Nothing to install on either side.`, 'जिसके पास Narad नहीं है उसे फाइल कैसे भेजूँ?', `Narad खोलें, फाइल या टेक्स्ट जोड़ें, “कोड से भेजें” दबाएँ। उन्हें 6 अंकों का कोड बताएँ; वे ${HOST}/receive पर किसी भी ब्राउज़र में डालें। दोनों तरफ़ कुछ install नहीं।`],
  ['Is there a file size limit?', 'No. Files stream directly from one device to the other and are written straight to disk, so a 20 GB video works as well as a 2 KB note. If the Wi‑Fi drops, the transfer resumes from the last byte.', 'क्या file size की limit है?', 'नहीं। फाइल एक डिवाइस से दूसरे पर सीधे stream होकर disk पर लिखी जाती है, इसलिए 20 GB वीडियो भी 2 KB note जितनी आसानी से जाता है। Wi‑Fi टूटे तो उसी byte से आगे चलता है।'],
  ['Do both devices need to be online?', 'Yes. Narad is device‑to‑device; there is no cloud copy. That is exactly why nothing is stored anywhere. If a contact is offline you can “nudge” them with a push notification.', 'क्या दोनों डिवाइस ऑनलाइन होने चाहिए?', 'हाँ। Narad डिवाइस‑से‑डिवाइस है; कोई cloud copy नहीं। इसीलिए कुछ भी कहीं store नहीं होता। Contact offline हो तो push notification से “nudge” कर सकते हैं।'],
  ['What does the Narad server see?', 'Your IP, a random session id, your device name and a hash of the room you are in. Never file names, sizes, text or content: everything travels inside an AES‑256‑GCM channel between the two devices.', 'Narad का सर्वर क्या देखता है?', 'आपका IP, एक random session id, डिवाइस का नाम और room का hash। फाइल के नाम, size, टेक्स्ट या content कभी नहीं: सब कुछ दो डिवाइस के बीच AES‑256‑GCM चैनल में जाता है।'],
  ['Does it work on iPhone and Android?', `Yes, in Safari and Chrome. No app store install: open ${APP_HOST} and add it to your home screen if you like. iPhone, Android, Windows, Mac and Linux all talk to each other.`, 'क्या iPhone और Android पर चलता है?', `हाँ, Safari और Chrome में। App store से कुछ install नहीं: ${APP_HOST} खोलें और चाहें तो home screen पर जोड़ें। iPhone, Android, Windows, Mac और Linux सब आपस में बात करते हैं।`],
]

const body = `
<div class="rail" aria-hidden="true"><span>The signal</span><i></i><span>zero storage · e2e encrypted</span></div>

<section class="hero">
  <div class="wrap">
    <div>
      <div class="eyebrow teal">${bi('Zero‑storage sharing · made in India', 'Zero‑storage sharing · भारत में बना')}</div>
      <h1 data-en>Send anything.<br><em class="s">It just arrives.</em></h1>
      <h1 data-hi>कुछ भी भेजो।<br><em class="s">बस पहुँच जाता है।</em></h1>
      <p class="lede">${bi('Files of any size, text, your clipboard: from your device straight to theirs with a 6‑digit code or over Wi‑Fi. End‑to‑end encrypted. No account. No server ever holds a copy.', 'किसी भी size की फाइल, टेक्स्ट, आपका क्लिपबोर्ड: आपके डिवाइस से सीधे उनके डिवाइस तक, 6 अंकों के कोड से या Wi‑Fi पर। End‑to‑end encrypted। न अकाउंट। कोई सर्वर कभी copy नहीं रखता।')}</p>
      <div class="cta-row">
        <a class="btn btn-signal" href="${APP}" data-app-link>${bi('Open Narad', 'Narad खोलें')} ${i('arrow')}</a>
        <a class="btn" href="/receive">${i('key')} ${bi('I have a code', 'मेरे पास कोड है')}</a>
      </div>
    </div>
    <div class="hero-side">
      <div class="stat"><b>0 B</b><span>${bi('stored on our servers', 'हमारे सर्वर पर store')}</span></div>
      <div class="stat"><b>∞</b><span>${bi('file size · resumes on drop', 'file size · drop पर resume')}</span></div>
      <div class="stat"><b>AES‑256</b><span>${bi('GCM, keys only on devices', 'GCM, keys सिर्फ़ डिवाइस पर')}</span></div>
      <div class="stat"><b>6 ${bi('digits', 'अंक')}</b><span>${bi('to reach anyone, anywhere', 'किसी तक भी, कहीं भी')}</span></div>
    </div>
  </div>
  <div class="wrap"><div class="scrollbar"><span>${i('download')} <span class="label">${bi('Scroll to follow the signal', 'Signal के पीछे scroll करो')}</span></span><span class="idx"><b>01</b> / 04</span></div></div>
</section>

<div class="journey" aria-label="How the signal travels">
  <div class="stage"><div class="wrap">
    <div class="eyebrow teal">${bi('How the signal travels', 'Signal कैसे चलता है')}</div>
    <ol class="steps4">
      <li class="step"><span class="n">01</span><h3>${bi('Pick', 'चुनो')}</h3><p>${bi('Any file, folder or text. It stays on your disk.', 'कोई फाइल, फ़ोल्डर या टेक्स्ट। आपकी disk पर ही रहता है।')}</p><i class="bar"></i></li>
      <li class="step"><span class="n">02</span><h3>${bi('Code', 'कोड')}</h3><p>${bi(`6 digits. Say it, link it or scan it: <b>${HOST}/receive</b>.`, `6 अंक। बोलो, link दो या scan करो: <b>${HOST}/receive</b>।`)}</p><i class="bar"></i></li>
      <li class="step"><span class="n">03</span><h3>${bi('Encrypted', 'Encrypted')}</h3><p>${bi('Direct channel, keys only on the two devices. 🦚🐘🪔🦅 on both screens.', 'सीधा चैनल, keys सिर्फ़ दोनों डिवाइस पर। 🦚🐘🪔🦅 दोनों स्क्रीन पर।')}</p><i class="bar"></i></li>
      <li class="step"><span class="n">04</span><h3>${bi('Arrived', 'पहुँचा')}</h3><p>${bi('Straight to their disk. Resumes on drops. No copy anywhere.', 'सीधे उनकी disk पर। टूटे तो resume। कहीं कोई copy नहीं।')}</p><i class="bar"></i></li>
    </ol>
  </div></div>
</div>

<section id="share" class="solid rv">
  <div class="wrap">
    <div class="spot">
      <div>
        <div class="eyebrow teal">${bi('Share with anyone', 'किसी को भी भेजें')}</div>
        <h2 style="margin-top:16px">${bi('One code. <em class="s">Any person, any device.</em>', 'एक कोड। <em class="s">कोई भी इंसान, कोई भी डिवाइस।</em>')}</h2>
        <p class="lede">${bi('No email, no link to expire, no “please sign up to download”. Everyone who types the code while it is open gets the same files over their own encrypted channel.', 'न email, न expire होने वाला लिंक, न “download के लिए sign up करें”। कोड खुला रहते जो भी डाले, सबको वही फाइलें अपने encrypted चैनल पर।')}</p>
        <ol class="steps">
          <li><span>${bi('Open Narad → add files or text → <b>Get code</b>.', 'Narad खोलो → फाइल या टेक्स्ट जोड़ो → <b>कोड बनाओ</b>।')}</span></li>
          <li><span>${bi(`They open <b>${HOST}/receive</b> and type it. Done.`, `वे <b>${HOST}/receive</b> खोलें और डालें। बस।`)}</span></li>
          <li><span>${bi('Liked it? <b>Add as contact</b>; next time you just see each other online.', 'पसंद आया? <b>संपर्क में जोड़ो</b>; अगली बार सीधे एक‑दूसरे को online देखो।')}</span></li>
        </ol>
      </div>
      <div class="codebox">
        <div class="sm">${bi(`they type this at ${HOST}/receive`, `वे ${HOST}/receive पर यह डालें`)}</div>
        <div class="big" style="margin-top:14px">482 913</div>
        <div class="sm">${bi('15 min · everyone who types it', '15 मिनट · जो भी डाले')}</div>
        <a class="btn btn-signal" href="${APP}" data-app-link>${bi('Make my code', 'मेरा कोड बनाओ')} ${i('arrow')}</a>
      </div>
    </div>
  </div>
</section>

<section id="how" class="solid rv">
  <div class="wrap">
    <div class="sec-head">
      <div><div class="eyebrow">01 — ${bi('Ways in', 'रास्ते')}</div><h2>${bi('Three ways to reach a device. <em class="s">One kind of connection.</em>', 'डिवाइस तक तीन रास्ते। <em class="s">कनेक्शन एक ही तरह का।</em>')}</h2></div>
      <p>${bi('However two devices find each other, the bytes travel on a direct, encrypted channel between them. Our server only makes the introduction.', 'दो डिवाइस चाहे जैसे मिलें, डेटा उनके बीच सीधे, encrypted चैनल पर जाता है। हमारा सर्वर सिर्फ़ परिचय कराता है।')}</p>
    </div>
    <div class="rows">
      <a class="row" href="/share-files-with-anyone"><span class="k">01</span><h3>${bi('Share with a code', 'कोड से भेजो')}</h3><p>${bi('For anyone, anywhere. A 6‑digit code, said out loud or sent as a link. No account on either side.', 'किसी के लिए भी, कहीं भी। 6 अंकों का कोड, बोल कर या लिंक से। दोनों तरफ़ बिना अकाउंट।')}</p><span class="go">${i('arrow')}</span></a>
      <a class="row" href="/airdrop-alternative"><span class="k">02</span><h3>${bi('Same Wi‑Fi', 'एक ही Wi‑Fi')}</h3><p>${bi('Open Narad on two devices on the same network. They see each other instantly; bytes go through your router and never leave the building.', 'एक ही नेटवर्क पर दो डिवाइस में Narad खोलो। तुरंत एक‑दूसरे को दिखते हैं; डेटा राउटर से जाता है, इमारत से बाहर नहीं।')}</p><span class="go">${i('arrow')}</span></a>
      <a class="row" href="/#pricing"><span class="k">03</span><h3>${bi('Office space', 'ऑफिस स्पेस')}</h3><p>${bi('One invite link for the whole team. Everyone with it sees everyone else, in office or at home. The secret lives in the link, not on our server.', 'पूरी टीम के लिए एक invite link। लिंक वाले सब एक‑दूसरे को देखते हैं, ऑफिस या घर से। सीक्रेट लिंक में, हमारे सर्वर पर नहीं।')}</p><span class="go">${i('arrow')}</span></a>
    </div>
  </div>
</section>

<section id="features" class="solid rv">
  <div class="wrap">
    <div class="sec-head">
      <div><div class="eyebrow">02 — ${bi('Features', 'फीचर')}</div><h2>${bi('Built for real life, <em class="s">not the demo.</em>', 'असली ज़िंदगी के लिए, <em class="s">demo के लिए नहीं।</em>')}</h2></div>
      <p>${bi('Flaky Wi‑Fi, 10 GB renders, a designer on an iPhone and a developer on Linux. Narad was built around the days that actually happen.', 'झटके खाता Wi‑Fi, 10 GB render, iPhone पर designer और Linux पर developer। Narad उन दिनों के लिए बना है जो सच में आते हैं।')}</p>
    </div>
    <div class="cards">
      <div class="card"><div class="k">${i('file')}</div><h3>${bi('Any size, any type', 'कोई भी size, कोई भी type')}</h3><p>${bi('A 10 GB video or a 2 KB snippet. Streams straight to disk, never fills your RAM. Folders keep their structure. <a href="/send-large-files">Send large files →</a>', '10 GB वीडियो या 2 KB snippet। सीधे disk पर stream, RAM नहीं भरती। फ़ोल्डर अपनी बनावट रखते हैं। <a href="/send-large-files">बड़ी फाइलें →</a>')}</p></div>
      <div class="card"><div class="k">${i('refresh')}</div><h3>${bi('Survives Wi‑Fi blips', 'Wi‑Fi के झटके झेलता है')}</h3><p>${bi('Connection dropped at 80%? Narad reconnects and continues from the last byte, not from zero.', '80% पर कनेक्शन टूटा? Narad दोबारा जुड़कर उसी byte से आगे चलता है, शून्य से नहीं।')}</p></div>
      <div class="card"><div class="k">${i('clipboard')}</div><h3>${bi('Online clipboard', 'ऑनलाइन क्लिपबोर्ड')}</h3><p>${bi('Copy on your laptop, paste on your phone. Per contact, opt‑in on both sides. <a href="/online-clipboard">Clipboard sync →</a>', 'लैपटॉप पर copy, फ़ोन पर paste। हर contact के लिए, दोनों तरफ़ opt‑in। <a href="/online-clipboard">Clipboard sync →</a>')}</p></div>
      <div class="card" id="extension"><div class="k">${i('pointer')}</div><h3>${bi('One right‑click', 'एक right‑click')}</h3><p>${bi('Chrome extension: right‑click any text, link or image → Send to Narad → the device. Done.', 'Chrome extension: किसी भी टेक्स्ट, लिंक या इमेज पर right‑click → Send to Narad → डिवाइस। बस।')}</p></div>
      <div class="card"><div class="k">${i('chat')}</div><h3>${bi('Chat that disappears', 'चैट जो गायब हो जाए')}</h3><p>${bi('Quick 1:1 messages on the same encrypted channel. Nothing is kept anywhere.', 'उसी encrypted चैनल पर 1:1 मैसेज। कहीं कुछ नहीं रहता।')}</p></div>
      <div class="card"><div class="k">${i('shield')}</div><h3>${bi('Encryption you can check', 'एन्क्रिप्शन जो आप जाँच सको')}</h3><p>${bi('Four emojis on both screens. Same emojis, same keys, nobody in the middle. Pairing uses SPAKE2.', 'दोनों स्क्रीन पर चार emoji। वही emoji, वही keys, बीच में कोई नहीं। Pairing में SPAKE2।')}</p></div>
    </div>
  </div>
</section>

<section id="security" class="solid rv">
  <div class="wrap">
    <div class="sec-head">
      <div><div class="eyebrow">03 — ${bi('Security', 'सुरक्षा')}</div><h2>${bi('What our server sees. <em class="s">And what it never can.</em>', 'हमारा सर्वर क्या देखता है। <em class="s">और क्या कभी नहीं।</em>')}</h2></div>
      <p>${bi('Most “private” sharing tools are private by policy. Narad is private by construction: the server only ever handles an introduction.', 'ज़्यादातर “private” tools policy से private हैं। Narad बनावट से private है: सर्वर सिर्फ़ परिचय कराता है।')}</p>
    </div>
    <div class="ledger">
      <div class="sees">
        <div class="lh">${i('eye')}${bi('The server sees', 'सर्वर देखता है')}</div>
        <ul>
          <li>${i('server')}<span><b>${bi('Your IP address', 'आपका IP address')}</b> — ${bi('needed to introduce two devices.', 'दो डिवाइस मिलाने के लिए ज़रूरी।')}</span></li>
          <li>${i('server')}<span><b>${bi('A random session id', 'एक random session id')}</b> — ${bi('new on every reload.', 'हर reload पर नया।')}</span></li>
          <li>${i('server')}<span><b>${bi('Your device name', 'आपके डिवाइस का नाम')}</b> — ${bi('so the other side knows who is calling.', 'ताकि दूसरी तरफ़ पता हो कौन है।')}</span></li>
          <li>${i('server')}<span><b>${bi('Which room you are in', 'आप किस room में हैं')}</b> — ${bi('as a hash, while you are in it.', 'hash के रूप में, जब तक उसमें हो।')}</span></li>
        </ul>
      </div>
      <div class="never">
        <div class="lh">${i('eyeoff')}${bi('The server never sees', 'सर्वर कभी नहीं देखता')}</div>
        <ul>
          <li>${i('lock')}<span><b>${bi('File contents', 'फाइल का content')}</b> — ${bi('bytes go device to device, encrypted with AES‑256‑GCM.', 'डेटा डिवाइस‑से‑डिवाइस, AES‑256‑GCM से encrypted।')}</span></li>
          <li>${i('lock')}<span><b>${bi('File names or sizes', 'फाइल के नाम या size')}</b> — ${bi('metadata rides inside the encrypted channel.', 'metadata भी encrypted चैनल के अंदर।')}</span></li>
          <li>${i('lock')}<span><b>${bi('Your messages or clipboard', 'आपके मैसेज या क्लिपबोर्ड')}</b> — ${bi('same channel, same keys.', 'वही चैनल, वही keys।')}</span></li>
          <li>${i('lock')}<span><b>${bi('Your contacts or codes', 'आपके contacts या कोड')}</b> — ${bi('secrets live on your devices and in links, never on our side.', 'secrets आपके डिवाइस और लिंक में, हमारे पास कभी नहीं।')}</span></li>
        </ul>
      </div>
    </div>
  </div>
</section>

<section id="compare" class="solid rv">
  <div class="wrap">
    <div class="sec-head">
      <div><div class="eyebrow">04 — ${bi('Compare', 'तुलना')}</div><h2>${bi('Versus the <em class="s">usual suspects.</em>', 'बाकियों के <em class="s">मुकाबले।</em>')}</h2></div>
      <p>${bi('Email, chat apps and cloud drives were all built to keep a copy. That copy is the problem.', 'Email, chat app और cloud drive सब एक copy रखने के लिए बने हैं। वही copy समस्या है।')}</p>
    </div>
    <div class="tablewrap"><table>
      <thead><tr><th></th><th class="hl2">Narad</th><th>WeTransfer</th><th>WhatsApp</th><th>Email</th><th>AirDrop</th></tr></thead>
      <tbody>
        <tr><td>${bi('Size limit', 'Size limit')}</td><td class="hl2">${bi('None', 'कोई नहीं')}</td><td>2 GB ${bi('free', 'मुफ़्त')}</td><td>2 GB</td><td>25 MB</td><td>${bi('None', 'कोई नहीं')}</td></tr>
        <tr><td>${bi('Stored on a server', 'सर्वर पर store')}</td><td class="hl2"><span class="y">${i('check')}${bi('Never', 'कभी नहीं')}</span></td><td><span class="n">${i('x')}7 ${bi('days', 'दिन')}</span></td><td><span class="n">${i('x')}${bi('Yes', 'हाँ')}</span></td><td><span class="n">${i('x')}${bi('Forever', 'हमेशा')}</span></td><td><span class="y">${i('check')}${bi('No', 'नहीं')}</span></td></tr>
        <tr><td>${bi('Account needed', 'अकाउंट ज़रूरी')}</td><td class="hl2"><span class="y">${i('check')}${bi('No', 'नहीं')}</span></td><td><span class="n">${i('x')}${bi('For >2 GB', '>2 GB के लिए')}</span></td><td><span class="n">${i('x')}</span></td><td><span class="n">${i('x')}</span></td><td><span class="y">${i('check')}</span></td></tr>
        <tr><td>${bi('iPhone ↔ Windows ↔ Android', 'iPhone ↔ Windows ↔ Android')}</td><td class="hl2"><span class="y">${i('check')}${bi('Any browser', 'कोई भी ब्राउज़र')}</span></td><td><span class="y">${i('check')}</span></td><td><span class="y">${i('check')}</span></td><td><span class="y">${i('check')}</span></td><td><span class="n">${i('x')}${bi('Apple only', 'सिर्फ़ Apple')}</span></td></tr>
        <tr><td>${bi('End‑to‑end encrypted', 'End‑to‑end encrypted')}</td><td class="hl2"><span class="y">${i('check')}${bi('Verifiable', 'जाँचने योग्य')}</span></td><td><span class="n">${i('x')}</span></td><td><span class="y">${i('check')}</span></td><td><span class="n">${i('x')}</span></td><td><span class="y">${i('check')}</span></td></tr>
        <tr><td>${bi('Clipboard sync', 'Clipboard sync')}</td><td class="hl2"><span class="y">${i('check')}</span></td><td><span class="n">${i('x')}</span></td><td><span class="n">${i('x')}</span></td><td><span class="n">${i('x')}</span></td><td><span class="n">${i('x')}</span></td></tr>
      </tbody>
    </table></div>
  </div>
</section>

<section id="pricing" class="solid rv">
  <div class="wrap">
    <div class="sec-head">
      <div><div class="eyebrow">05 — ${bi('Pricing', 'कीमत')}</div><h2>${bi('Free for people. <em class="s">Paid for teams.</em>', 'लोगों के लिए मुफ़्त। <em class="s">टीमों के लिए paid।</em>')}</h2></div>
      <p>${bi('The core stays free and open. Teams pay for the things teams need: shared spaces, priority relays and an admin console.', 'Core मुफ़्त और open रहेगा। टीमें उन चीज़ों के लिए देती हैं जो टीमों को चाहिए: shared spaces, priority relay, admin console।')}</p>
    </div>
    <div class="plans">
      <div class="plan">
        <div class="name">Personal</div><div class="price">₹0<small>${bi('forever', 'हमेशा')}</small></div>
        <p class="who">${bi('For you and the people you share with.', 'आपके और आपके लोगों के लिए।')}</p>
        <ul><li>${i('check')}${bi('Unlimited size, unlimited transfers', 'असीमित size, असीमित transfer')}</li><li>${i('check')}${bi('Share with code, same Wi‑Fi, rooms', 'कोड से भेजो, same Wi‑Fi, rooms')}</li><li>${i('check')}${bi('Contacts, clipboard sync, chat', 'Contacts, clipboard sync, chat')}</li><li>${i('check')}${bi('Chrome extension', 'Chrome extension')}</li></ul>
        <a class="btn" href="${APP}" data-app-link>${bi('Open Narad', 'Narad खोलें')}</a>
      </div>
      <div class="plan hot">
        <div class="tag">${bi('Most popular', 'सबसे लोकप्रिय')}</div>
        <div class="name">Team</div><div class="price">₹149<small>${bi('/ user / month', '/ user / महीना')}</small></div>
        <p class="who">${bi('For offices that share all day and want it managed.', 'उन ऑफिसों के लिए जो दिन भर share करते हैं और manage चाहते हैं।')}</p>
        <ul><li>${i('check')}${bi('Everything in Personal', 'Personal का सब कुछ')}</li><li>${i('check')}${bi('Spaces with 200+ members', '200+ सदस्यों वाले spaces')}</li><li>${i('check')}${bi('Priority relays for strict firewalls', 'सख़्त firewall के लिए priority relay')}</li><li>${i('check')}${bi('Admin console, device management', 'Admin console, device management')}</li><li>${i('check')}${bi('Metadata‑only audit log · SSO (soon)', 'Metadata‑only audit log · SSO (जल्द)')}</li></ul>
        <a class="btn btn-signal" href="mailto:hello@${HOST}?subject=Narad%20Team">${bi('Talk to us', 'बात करें')}</a>
      </div>
      <div class="plan">
        <div class="name">Self‑host</div><div class="price">₹14,999<small>${bi('/ year', '/ साल')}</small></div>
        <p class="who">${bi('For teams that keep everything inside their own walls.', 'उन टीमों के लिए जो सब कुछ अपनी दीवारों के अंदर रखती हैं।')}</p>
        <ul><li>${i('check')}${bi('Whole stack on your servers (docker compose)', 'पूरा stack आपके सर्वर पर (docker compose)')}</li><li>${i('check')}${bi('Air‑gapped offices supported', 'बिना‑इंटरनेट ऑफिस भी')}</li><li>${i('check')}${bi('Updates for a year', 'एक साल के अपडेट')}</li></ul>
        <a class="btn" href="${GITHUB}/tree/main/infra/selfhost">${bi('Read the guide', 'गाइड पढ़ें')}</a>
      </div>
    </div>
  </div>
</section>

<section id="faq" class="solid rv">
  <div class="wrap">
    <div class="sec-head one"><div><div class="eyebrow">06 — FAQ</div><h2>${bi('Questions people <em class="s">actually ask.</em>', 'जो सवाल लोग <em class="s">सच में पूछते हैं।</em>')}</h2></div></div>
    ${faqHtml(FAQ)}
  </div>
</section>
<div class="solid">${ctaBand()}</div>
`

export default {
  path: '/',
  title: 'Narad — Send Files Online Free, No Sign‑Up | Share Files, Text & Clipboard with a Code',
  llmTitle: 'Narad home',
  description: 'Free online file sharing: send files of any size, text and your clipboard to any device with a 6‑digit code or over Wi‑Fi. No account, end‑to‑end encrypted, nothing stored on a server. iPhone, Android, Windows, Mac.',
  body,
  jsonld: [ORG, { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Narad', url: SITE, inLanguage: ['en', 'hi'] }, APP_LD, faqLd(FAQ.map(([q, a]) => [q, a]))],
}
