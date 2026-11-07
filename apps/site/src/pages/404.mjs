import { bi, i, receiveBox, related } from '../layout.mjs'

const body = `
<article class="article">
  <div class="wrap">
    <span class="kicker">${i('zap')} 404</span>
    <h1 data-en>That page <em class="s">ghosted us.</em></h1>
    <h1 data-hi>यह page <em class="s">गायब है।</em></h1>
    <p class="lede">${bi('The link is wrong or the page moved. Nothing is stored on our servers, so there is nothing lost: here is where you probably wanted to go.', 'लिंक गलत है या page हट गया। हमारे सर्वर पर कुछ store नहीं होता, तो कुछ खोया नहीं: शायद आप यहाँ जाना चाहते थे।')}</p>
    <div class="cta-row"><a class="btn btn-signal" href="/">${bi('Home', 'होम')} ${i('arrow')}</a><a class="btn" href="/receive">${i('key')} ${bi('I have a code', 'मेरे पास कोड है')}</a></div>
    ${receiveBox()}
    ${related([['/share-files-with-anyone', 'Share with a code', 'anyone, anywhere'], ['/send-large-files', 'Send large files', 'no limit'], ['/online-clipboard', 'Online clipboard', 'copy here, paste there']])}
  </div>
</article>
`
export default { path: '/404', title: 'Page not found | Narad', description: 'That page does not exist. Go home, or enter a share code.', body, noindex: true, jsonld: [] }
