(function () {
  var html = document.documentElement;
  // ---- app URL (build config, re-derived from the real hostname when "auto") ----
  var APP = html.getAttribute('data-app') || '';
  if (html.getAttribute('data-app-auto') && /^https?:$/.test(location.protocol) && location.hostname !== 'localhost' && !/^\d+\.\d+\.\d+\.\d+$/.test(location.hostname)) {
    APP = location.protocol + '//app.' + location.hostname.replace(/^(www|app)\./, '');
  }
  document.querySelectorAll('a[data-app-link]').forEach(function (a) { a.href = APP; });

  // ---- reveal, language, theme, menu ----
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.rv').forEach(function (el) { io.observe(el); });
  window.setLang = function (l) { html.lang = l; var b = document.getElementById('langBtn'); if (b) b.textContent = l === 'hi' ? 'EN' : 'हिंदी'; try { localStorage.setItem('narad:lang', l); } catch (e) {} };
  window.toggleLang = function () { setLang(html.lang === 'hi' ? 'en' : 'hi'); };
  setLang(html.lang === 'hi' ? 'hi' : 'en');
  function theme() { return html.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
  window.toggleTheme = function () { var next = theme() === 'dark' ? 'light' : 'dark'; html.setAttribute('data-theme', next); try { localStorage.setItem('narad:theme', next); } catch (e) {} };
  window.toggleMenu = function () { var open = document.body.classList.toggle('menu-open'); var b = document.querySelector('.menu-btn'); if (b) b.setAttribute('aria-expanded', String(open)); };
  document.querySelectorAll('.mobile-nav a').forEach(function (a) { a.addEventListener('click', function () { document.body.classList.remove('menu-open'); }); });
  document.querySelectorAll('form[data-receive]').forEach(function (f) {
    var input = f.querySelector('input');
    input.addEventListener('input', function () { input.value = input.value.replace(/\D/g, '').slice(0, 6); });
    f.addEventListener('submit', function (e) { e.preventDefault(); if (input.value.length === 6) location.href = APP + '/#code=' + input.value; else input.focus(); });
  });
  // card spotlight follows the pointer
  document.querySelectorAll('.card').forEach(function (c) { c.addEventListener('pointermove', function (e) { var r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); }); });

  // ---- The Signal: one fixed canvas, a packet that travels from your device to theirs as you scroll ----
  var cv = document.getElementById('signal');
  if (!cv) return;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ctx = cv.getContext('2d'), W = 0, H = 0, DPR = 1, mouse = { x: .5, y: .5 }, t0 = performance.now();
  var journey = document.querySelector('.journey'), beats = [].slice.call(document.querySelectorAll('.steps4 .step')), trail = [], idx = document.querySelector('.scrollbar .idx b'), label = document.querySelector('.scrollbar .label');
  var stars = [], flow = [];
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    stars = []; for (var i = 0; i < (W < 700 ? 110 : 220); i++) stars.push({ x: Math.random(), y: Math.random(), z: .3 + Math.random() * .7, r: Math.random() * 1.3 + .3, p: Math.random() * 6.28 });
    flow = []; for (var j = 0; j < 36; j++) flow.push({ t: Math.random(), s: .0007 + Math.random() * .0012, w: Math.random() });
  }
  resize(); addEventListener('resize', function () { resize(); cur = null; });
  addEventListener('pointermove', function (e) { mouse.x = e.clientX / W; mouse.y = e.clientY / H; }, { passive: true });
  function rgb() { var c = getComputedStyle(html).getPropertyValue('--signal-rgb').trim() || '255,161,77'; return c; }
  // Device A (sender) and B (receiver) live on the side opposite the text: right of the hero copy, and across from each beat's card.
  var cur = null;
  function targets(s) {
    if (W < 700) return s === 0
      ? { A: { x: W * .9, y: H * 1.04 }, B: { x: W * .9, y: H * -.04 } }   // hero on phones: the packet rides the right edge
      : { A: { x: W * .2, y: H * .4 }, B: { x: W * .8, y: H * .12 } };   // journey: above the 2×2 step grid
    if (s === 0) return W < 1024
      ? { A: { x: W * .9, y: H * .56 }, B: { x: W * .9, y: H * .16 } }
      : { A: { x: W * .6, y: H * .5 }, B: { x: W * .9, y: H * .14 } };
    return { A: { x: W * .18, y: H * .56 }, B: { x: W * .84, y: H * .18 } }; // journey: the upper two thirds, steps sit below
  }
  function nodes(s) {
    var t = targets(s);
    if (!cur) cur = { A: { x: t.A.x, y: t.A.y }, B: { x: t.B.x, y: t.B.y } };
    var k = reduced ? 1 : .07;
    cur.A.x += (t.A.x - cur.A.x) * k; cur.A.y += (t.A.y - cur.A.y) * k; cur.B.x += (t.B.x - cur.B.x) * k; cur.B.y += (t.B.y - cur.B.y) * k;
    var A = cur.A, B = cur.B, dx = B.x - A.x;
    var c1 = { x: A.x + dx * .1, y: A.y - H * .5 }, c2 = { x: B.x - dx * .1, y: B.y + H * .5 };
    return { A: A, B: B, c1: c1, c2: c2 };
  }
  function bez(n, t) { var u = 1 - t; return { x: u*u*u*n.A.x + 3*u*u*t*n.c1.x + 3*u*t*t*n.c2.x + t*t*t*n.B.x, y: u*u*u*n.A.y + 3*u*u*t*n.c1.y + 3*u*t*t*n.c2.y + t*t*t*n.B.y }; }
  function progress() { // 0 in hero, 0→1 across the journey, 1 after
    if (!journey) return 0;
    var r = journey.getBoundingClientRect(), total = r.height - H; if (total <= 0) return 0;
    return Math.max(0, Math.min(1, -r.top / total));
  }
  function stage(p) { return p <= 0 ? 0 : Math.min(4, Math.floor(p * 4) + 1); }
  var names = ['', 'PICK', 'CODE', 'ENCRYPTED', 'ARRIVED'];
  function device(x, y, lit, col, time, big) {
    var w = big ? 74 : 58, h = big ? 46 : 38;
    ctx.save(); ctx.translate(x, y);
    if (lit > 0) { var g = ctx.createRadialGradient(0, 0, 0, 0, 0, 140); g.addColorStop(0, 'rgba(' + col + ',' + (.35 * lit) + ')'); g.addColorStop(1, 'rgba(' + col + ',0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 140, 0, 6.28); ctx.fill(); }
    ctx.strokeStyle = 'rgba(' + col + ',' + (.35 + .65 * lit) + ')'; ctx.lineWidth = 1.2; ctx.fillStyle = 'rgba(' + col + ',' + (.06 + .1 * lit) + ')';
    rr(-w / 2, -h / 2, w, h, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(' + col + ',' + (.5 + .5 * lit) + ')'; ctx.fillRect(-w / 2 + 8, -h / 2 + 8, w - 16, 2);
    for (var i = 0; i < 3; i++) { ctx.globalAlpha = .25 + .75 * Math.max(0, Math.sin(time / 500 + i)) * lit; ctx.fillRect(-w / 2 + 8, -h / 2 + 15 + i * 6, (w - 16) * (.4 + .2 * i), 2); }
    ctx.globalAlpha = 1; ctx.restore();
  }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  var lastStage = -1;
  function frame(now) {
    var time = now - t0, p = progress(), s = stage(p), col = rgb(), n = nodes(s), light = theme() === 'light';
    var px = (mouse.x - .5) * 18, py = (mouse.y - .5) * 12;
    ctx.clearRect(0, 0, W, H);
    // ether: parallax starfield
    for (var i = 0; i < stars.length; i++) { var st = stars[i]; var x = st.x * W + px * st.z, y = ((st.y * H + scrollY * .06 * st.z) % H + H) % H + py * st.z; var a = (.25 + .55 * Math.abs(Math.sin(time / 1800 + st.p))) * (light ? .45 : 1); ctx.fillStyle = light ? 'rgba(18,18,22,' + a * .7 + ')' : 'rgba(242,239,232,' + a + ')'; ctx.beginPath(); ctx.arc(x, y, st.r * st.z, 0, 6.28); ctx.fill(); }
    // the conduit: faint dashed bezier + flowing motes
    var fade = p >= 1 ? Math.max(0, 1 - (p - 1)) : 1;
    ctx.save(); ctx.globalAlpha = .9 * fade;
    ctx.setLineDash([2, 9]); ctx.lineDashOffset = -time / 30; ctx.strokeStyle = 'rgba(' + col + ',.28)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(n.A.x, n.A.y); ctx.bezierCurveTo(n.c1.x, n.c1.y, n.c2.x, n.c2.y, n.B.x, n.B.y); ctx.stroke(); ctx.setLineDash([]);
    for (var f = 0; f < flow.length; f++) { var m = flow[f]; if (!reduced) m.t = (m.t + m.s * (s >= 3 ? 2.2 : 1)) % 1; var q = bez(n, m.t); ctx.fillStyle = 'rgba(' + col + ',' + (.15 + .5 * m.w) + ')'; ctx.beginPath(); ctx.arc(q.x, q.y, .6 + m.w * 1.4, 0, 6.28); ctx.fill(); }
    // devices
    var litA = s <= 1 ? 1 : Math.max(.2, 1 - (p - .25) * 3), litB = s === 4 ? Math.min(1, (p - .75) * 4) : .15;
    device(n.A.x, n.A.y, litA, col, time, true); device(n.B.x, n.B.y, litB, col, time, false);
    // the packet
    var raw = Math.min(1, Math.max(0, (p - .04) / .9)), pt = raw * raw * (3 - 2 * raw); // smoothstep: slow start, slow arrival
    var k = bez(n, s === 0 ? (time / 6000) % 1 : pt);
    trail.push({ x: k.x, y: k.y }); if (trail.length > 18) trail.shift();
    for (var ti = 0; ti < trail.length - 1; ti++) { var ta = ti / trail.length; ctx.fillStyle = 'rgba(' + col + ',' + (ta * .5) + ')'; ctx.beginPath(); ctx.arc(trail[ti].x, trail[ti].y, 1 + ta * 3, 0, 6.28); ctx.fill(); }
    var glow = ctx.createRadialGradient(k.x, k.y, 0, k.x, k.y, 70); glow.addColorStop(0, 'rgba(' + col + ',.55)'); glow.addColorStop(1, 'rgba(' + col + ',0)'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(k.x, k.y, 70, 0, 6.28); ctx.fill();
    ctx.fillStyle = light ? 'rgb(' + col + ')' : '#fff'; ctx.beginPath(); ctx.arc(k.x, k.y, 4.5, 0, 6.28); ctx.fill();
    // encryption ring (stage 3): orbiting glyph particles
    if (s === 3 || (s === 4 && p < .82)) { var ringA = s === 3 ? Math.min(1, (p - .5) * 6) : 1 - (p - .75) * 14; ctx.strokeStyle = 'rgba(' + col + ',' + (.6 * ringA) + ')'; ctx.lineWidth = 1; for (var r = 0; r < 3; r++) { ctx.beginPath(); ctx.ellipse(k.x, k.y, 26 + r * 12, (26 + r * 12) * .45, time / (900 + r * 300) + r, 0, 6.28); ctx.stroke(); } for (var g2 = 0; g2 < 12; g2++) { var ang = time / 700 + g2 * .52, rad = 30 + (g2 % 3) * 11; ctx.fillStyle = 'rgba(' + col + ',' + (.9 * ringA) + ')'; ctx.beginPath(); ctx.arc(k.x + Math.cos(ang) * rad, k.y + Math.sin(ang) * rad * .45, 1.6, 0, 6.28); ctx.fill(); } }
    // arrival pulses
    if (s === 4) { var ap = (p - .75) / .25; for (var w = 0; w < 3; w++) { var ph = ((time / 1600) + w / 3) % 1; ctx.strokeStyle = 'rgba(' + col + ',' + ((1 - ph) * .6 * ap) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(n.B.x, n.B.y, 20 + ph * 110, 0, 6.28); ctx.stroke(); } }
    ctx.restore();
    // hud + beat panels
    if (s !== lastStage) { lastStage = s; if (idx) idx.textContent = '0' + Math.max(1, s); if (label) label.textContent = names[s] || 'SCROLL TO FOLLOW THE SIGNAL'; beats.forEach(function (b, bi) { b.classList.toggle('on', bi === s - 1); b.classList.toggle('done', bi < s - 1); }); }
    beats.forEach(function (b, bi) { b.style.setProperty('--w', Math.max(0, Math.min(1, p * 4 - bi)).toFixed(3)); });
    cv.style.opacity = p >= 1 ? String(Math.max(0, 1 - (scrollY - (journey.offsetTop + journey.offsetHeight - H)) / (H * .8))) : '1';
    if (!reduced) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if (reduced) { addEventListener('scroll', function () { requestAnimationFrame(frame); }, { passive: true }); }
})();
