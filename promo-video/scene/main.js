// The cut as a pure function of time: window.renderFrame(t) draws the frame at t seconds.
(() => {
  const C = window.CONTENT;
  const $ = (sel, root = document) => root.querySelector(sel);
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const out3 = k => 1 - Math.pow(1 - k, 3);
  const ramp = (x, a, d) => clamp((x - a) / d);           // 0→1 from a over d seconds
  const win = (x, a, b, f = 0.4) => Math.min(ramp(x, a, f), 1 - ramp(x, b - f, f));
  function el(tag, cls, parent, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }
  const css = (e, o) => { for (const k in o) e.style[k] = o[k]; return e; };
  const op = (e, v) => { e.style.opacity = v.toFixed(3); e.style.visibility = v < 0.002 ? 'hidden' : 'visible'; };

  let TL, ENV, S = {}, SEG = {};
  const stage = $('#stage');
  const scene = name => el('div', 'scene', stage);

  // word time: start of word i of segment id (as the caption shows it)
  const W = (id, i) => SEG[id].words[Math.min(i, SEG[id].words.length - 1)].s;
  const segStart = id => SEG[id].speechStart;
  const segEnd = id => SEG[id].speechEnd;

  // ---------------------------------------------------------- images
  const IMG = {};
  function loadImages(list) {
    return Promise.all(list.map(src => new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => { IMG[src] = i; res(); };
      i.onerror = () => rej(new Error('image ' + src));
      i.src = src;
    })));
  }
  // a photo in a frame, with a slow move: focus point (fractions of the image) kept at the frame's centre
  function photo(parent, src, x, y, w, h, cls = '') {
    const f = el('div', 'photo ' + cls, parent);
    css(f, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    const im = el('img', '', f);
    im.src = src;
    return { f, im, w, h, src };
  }
  function kb(p, fx, fy, zoom) {
    const n = IMG[p.src];
    const cover = Math.max(p.w / n.naturalWidth, p.h / n.naturalHeight) * zoom;
    const iw = n.naturalWidth * cover, ih = n.naturalHeight * cover;
    let tx = p.w / 2 - fx * iw, ty = p.h / 2 - fy * ih;
    tx = clamp(tx, p.w - iw, 0); ty = clamp(ty, p.h - ih, 0);
    css(p.im, { width: iw + 'px', height: ih + 'px', transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px)` });
    return (ax, ay) => [tx + ax * iw, ty + ay * ih];   // image point → frame point
  }

  // ---------------------------------------------------------- recited verses
  function verseBlock(parent, segId, top, size = 66) {
    const seg = SEG[segId];
    const box = el('div', 'verses', parent);
    css(box, { top: top + 'px' });
    const spans = [];
    seg.lines.forEach((pair, b) => {
      const bay = el('div', 'bayt', box);
      pair.forEach((txt, h) => {
        const s = el('div', 'shatr', bay, txt);
        s.style.fontSize = size + 'px';
        spans.push({ ...seg.shatrs[b * 2 + h], el: s });
      });
    });
    return { box, spans, seg };
  }
  function drawVerses(v, t) {
    for (const s of v.spans) {
      const shown = ramp(t, s.s - 0.35, 0.35);
      s.el.className = 'shatr' + (t >= s.s - 0.05 && t < s.e ? ' on' : t >= s.e ? ' done' : '');
      s.el.style.opacity = (0.25 + 0.75 * shown).toFixed(3);
      s.el.style.transform = `translateY(${((1 - out3(shown)) * 18).toFixed(1)}px)`;
    }
  }
  // the reciter's voice as bars around the playhead
  function wave(parent, top, w = 800, h = 120) {
    const c = el('canvas', 'wave', parent);
    c.width = w * 2; c.height = h * 2;
    css(c, { top: top + 'px', width: w + 'px', height: h + 'px', left: (540 - w / 2) + 'px' });
    return c;
  }
  function drawWave(c, env, pos, alpha = 1, gold = true) {
    const g = c.getContext('2d');
    const w = c.width, h = c.height, n = 64, bw = w / n;
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < n; i++) {
      const k = Math.round(pos * 60) + (i - n / 2) * 2;
      const v = k >= 0 && k < env.length ? env[k] : 0;
      const near = 1 - Math.abs(i - n / 2) / (n / 2);
      const bh = Math.max(6, v * h * 0.92);
      g.fillStyle = gold ? `rgba(216,180,106,${(0.25 + 0.75 * near) * alpha})` : `rgba(245,236,220,${0.5 * near * alpha})`;
      const x = w - (i + 1) * bw + bw * 0.25;          // right to left, like the text
      g.beginPath();
      g.roundRect(x, (h - bh) / 2, bw * 0.5, bh, bw * 0.25);
      g.fill();
    }
  }
  function reciteState(t) {
    for (const s of TL.segments) {
      if (s.kind !== 'recite') continue;
      for (const c of s.clips) {
        const L = t - c.at, len = c.srcEnd - c.src;
        if (L >= -0.6 && L <= len + 0.6) return { seg: s, env: ENV.clips[String(c.src)], pos: L, len };
      }
    }
    return null;
  }

  // ---------------------------------------------------------- scenes
  function build() {
    // 1. hook: the opening verses in Sayed's voice
    { const s = S.hook = { e: scene() };
      s.orn = el('div', 'center label', s.e, 'من أرجوزة');
      css(s.orn, { top: '330px', fontSize: '36px' });
      s.title = el('div', 'center amiri gold', s.e, '«حمار الشعراء»');
      css(s.title, { top: '380px', fontSize: '76px' });
      s.v = verseBlock(s.e, 'r1', 600, 70);
      s.wave = wave(s.e, 1290);
    }
    // 2. title
    { const s = S.title = { e: scene() };
      s.big = el('div', 'center amiri gold', s.e, C.title);
      css(s.big, { top: '560px', fontSize: '200px', lineHeight: '1.3', textShadow: '0 8px 40px rgba(0,0,0,0.5)' });
      s.r1 = el('div', 'rule', s.e); css(s.r1, { position: 'absolute', top: '880px', left: '240px', right: '240px' });
      s.sub = el('div', 'center kufi', s.e, C.subtitle);
      css(s.sub, { top: '930px', fontSize: '58px', fontWeight: '600' });
      s.num = el('div', 'center kufi', s.e, '');
      css(s.num, { top: '1040px', fontSize: '58px', fontWeight: '500', color: 'var(--gold2)' });
    }
    // 3. the author
    { const s = S.author = { e: scene() };
      s.p1 = photo(s.e, 'img/hmittou-portrait.jpg', 210, 230, 660, 820, 'arch');
      s.p2 = photo(s.e, 'img/hmittou-bachir.jpg', 210, 230, 660, 820, 'arch');
      s.name = el('div', 'center amiri gold', s.e, C.author);
      css(s.name, { top: '1090px', fontSize: '92px' });
      s.note = el('div', 'center amiri', s.e, C.authorNote);
      css(s.note, { top: '1225px', fontSize: '52px', color: 'var(--muted)' });
      s.role = el('div', 'center kufi', s.e, C.authorRole);
      css(s.role, { top: '1325px', fontSize: '34px', color: 'var(--cream)' });
      s.cap2 = el('div', 'center', s.e, `<span class="chip" style="font-size:30px">${C.bachirCaption}</span>`);
      css(s.cap2, { top: '975px' });
    }
    // 4. the rajaz: its poets, then its beat
    { const s = S.rajaz = { e: scene() };
      s.head = el('div', 'center amiri gold', s.e, 'بحر الرَّجَز');
      css(s.head, { top: '300px', fontSize: '120px' });
      s.nick = el('div', 'center kufi', s.e, 'لُقِّبَ «حمار الشعراء»');
      css(s.nick, { top: '480px', fontSize: '44px', color: 'var(--muted)' });
      s.names = C.rajaz.map((n, i) => {
        const e = el('div', 'amiri', s.e, n);
        const col = i % 2, row = Math.floor(i / 2);
        css(e, { position: 'absolute', top: (620 + row * 150) + 'px', width: '540px', textAlign: 'center',
          left: (col ? 40 : 500) + 'px', fontSize: '66px', color: i % 3 === 0 ? 'var(--gold2)' : 'var(--cream)' });
        return e;
      });
      s.feet = [0, 1, 2].map(i => {
        const e = el('div', 'amiri', s.e, 'مُسْتَفْعِلُنْ');
        css(e, { position: 'absolute', top: '470px', width: '330px', left: (705 - i * 330) + 'px', textAlign: 'center',
          fontSize: '68px', color: 'var(--gold2)' });
        return e;
      });
      s.dots = [0, 1, 2].map(i => {
        const e = el('div', '', s.e);
        css(e, { position: 'absolute', top: '600px', left: (855 - i * 330) + 'px', width: '30px', height: '30px',
          borderRadius: '50%', background: 'var(--gold)' });
        return e;
      });
      s.v = verseBlock(s.e, 'r2', 820, 62);
      s.wave = wave(s.e, 1290);
    }
    // 5. Yahya al-Fifi, at his ijaza
    { const s = S.fifi = { e: scene() };
      s.p = photo(s.e, 'img/ijaza-fifi.jpg', 60, 230, 960, 700);
      s.lab = [C.fifi.name, 'د. عبد الهادي حميتو', 'د. الناجي لمين'].map(n => el('div', 'chip', s.e, n));
      s.lab.forEach(e => css(e, { position: 'absolute', fontSize: '30px' }));
      s.note = el('div', 'center kufi', s.e, C.fifi.photoNote + ' · ' + C.fifi.host);
      css(s.note, { top: '950px', fontSize: '30px', color: 'var(--muted)' });
      s.route = el('div', 'center', s.e,
        `<span class="amiri gold" style="font-size:96px">${C.fifi.route[0]}</span>
         <span class="kufi" style="font-size:60px;color:var(--muted);margin:0 34px">←</span>
         <span class="amiri gold" style="font-size:96px">${C.fifi.route[1]}</span>`);
      css(s.route, { top: '1050px', direction: 'rtl' });
      s.ask = el('div', 'center amiri', s.e, 'وَحِينَمَا افْتَقَدْتَ فِيهِ رَجَزًا ⁂ سَأَلْتَنِيهِ');
      css(s.ask, { top: '1260px', fontSize: '50px', color: 'var(--cream)' });
      s.v = verseBlock(s.e, 'r3', 1010, 64);
      s.wave = wave(s.e, 1350, 700, 100);
    }
    // 6. a poem for every completed reading
    { const s = S.honor = { e: scene() };
      s.head = el('div', 'center kufi', s.e, 'قصائد د. حميتو للشيخ يحيى الفيفي');
      css(s.head, { top: '270px', fontSize: '40px', fontWeight: '600', color: 'var(--gold2)' });
      s.sub = el('div', 'center kufi', s.e, 'قصيدةٌ لكل ختمة');
      css(s.sub, { top: '340px', fontSize: '34px', color: 'var(--muted)' });
      s.cards = C.khatmat.map((k, i) => {
        const c = el('div', 'card', s.e, `<div class="t">«${k.t}»</div><div class="d">${k.d}</div>`);
        css(c, { top: (440 + i * 255) + 'px', textAlign: 'center' });
        return c;
      });
      s.v = verseBlock(s.e, 'r4', 660, 72);
      s.wave = wave(s.e, 1290);
    }
    // 7. the edition and its editor
    { const s = S.edition = { e: scene() };
      s.ph = el('div', 'phone', s.e); css(s.ph, { left: '260px', top: '240px' });
      s.scr = el('div', 'scr', s.ph); el('img', '', s.scr).src = 'img/site-light-top.png';
      s.p = photo(s.e, 'img/khalid-reading.jpg', 225, 250, 630, 860, 'arch');
      s.name = el('div', 'center amiri gold', s.e, C.editor);
      css(s.name, { top: '1160px', fontSize: '96px' });
      s.role = el('div', 'center kufi', s.e, C.editorRole + ' بالشكل الكامل');
      css(s.role, { top: '1310px', fontSize: '38px', color: 'var(--muted)' });
    }
    // 8. symmetry, kashida, numbering
    { const s = S.layout = { e: scene() };
      s.box = el('div', 'sample', s.e); css(s.box, { top: '300px' });
      s.rows = C.bayts.map((b, i) => {
        const r = el('div', 'bayt', s.box);
        const plain = b.map(x => x.replace(/ـ/g, ''));
        const a = el('div', 'v', r, plain[0]), z = el('div', 'v', r, plain[1]);
        const n = el('div', 'num', r, String(i + 1));
        return { r, a, z, n, b, plain };
      });
      s.spine = el('div', 'spine', s.box);
      s.k = el('div', 'center', s.e, '');
      css(s.k, { top: '930px' });
      s.k1 = el('div', 'center amiri', s.e, 'مِنَ الْقَوَافِي نَبَذُوهُ بِالْعَرَا');
      s.k2 = el('div', 'center amiri', s.e, C.bayts[0][1]);
      [s.k1, s.k2].forEach(e => css(e, { top: '1080px', fontSize: '84px', color: 'var(--cream)' }));
      s.kl = el('div', 'center kufi', s.e, 'الكشيدة حيث يحسن المدّ');
      css(s.kl, { top: '1260px', fontSize: '36px', color: 'var(--gold2)' });
      s.ph = el('div', 'phone', s.e); css(s.ph, { left: '316px', top: '250px', width: '448px', height: '970px', borderRadius: '58px', padding: '14px' });
      s.phs = el('div', 'scr', s.ph); s.phs.style.borderRadius = '46px';
      el('img', '', s.phs).src = 'img/site-light-top.png';
      s.tags = ['الصدر', 'العجز'].map(n => { const e = el('div', 'tag', s.e, n); css(e, { background: 'rgba(216,180,106,0.18)', color: 'var(--gold2)', top: '230px' }); return e; });
    }
    // 9. the reader's controls
    { const s = S.features = { e: scene() };
      s.ph = el('div', 'phone', s.e); css(s.ph, { left: '260px', top: '220px' });
      s.scr = el('div', 'scr', s.ph);
      s.base = el('img', '', s.scr); s.base.src = 'img/site-light-top.png';
      s.layers = C.features.filter(f => f.img).map(f => { const i = el('img', '', s.scr); i.src = f.img; return { f, i }; });
      s.sel = el('div', '', s.scr);
      css(s.sel, { position: 'absolute', left: '60px', right: '60px', top: '345px', height: '140px', background: 'rgba(66,133,244,0.28)', borderRadius: '6px' });
      s.toast = el('div', '', s.scr);
      css(s.toast, { position: 'absolute', left: '30px', right: '30px', top: '560px', padding: '24px 26px', borderRadius: '24px',
        background: '#2b2b2b', color: '#fff', fontFamily: 'Amiri', fontSize: '34px', lineHeight: '1.7', textAlign: 'center' });
      s.toast.innerHTML = '<div style="font-family:Kufi;font-size:22px;color:#bbb;margin-bottom:6px">النص المنسوخ</div>جَشَّمْتَنِي النَّظْمَ عَلَى بَحْرٍ عَرَا<br>مِنَ الْقَوَافِي نَبَذُوهُ بِالْعَرَا';
      s.pdf1 = photo(s.e, 'img/pdf-mobile-01.png', 120, 330, 400, 700);
      s.pdf2 = photo(s.e, 'img/pdf-desk-01.png', 560, 330, 400, 566);
      s.pl1 = el('div', 'chip', s.e, 'للهاتف'); s.pl2 = el('div', 'chip', s.e, 'للطباعة (A4)');
      css(s.pl1, { position: 'absolute', top: '1060px', left: '220px' }); css(s.pl2, { position: 'absolute', top: '930px', left: '620px' });
      s.chip = el('div', 'center', s.e, ''); css(s.chip, { top: '1468px' });
    }
    // 10. how rarely poems are published like this
    { const s = S.rare = { e: scene() };
      s.c1 = el('div', 'sample', s.e); css(s.c1, { top: '300px', padding: '40px 46px', background: '#e9e6e0' });
      el('div', 'plain', s.c1, C.plain);
      s.t1 = el('div', 'tag', s.e, 'النشر المعتاد'); css(s.t1, { top: '250px', right: '100px', background: '#5a5047', color: '#eee' });
      s.c2 = photo(s.e, 'img/site-desk-verses.png', 70, 820, 940, 520);
      s.t2 = el('div', 'tag', s.e, 'هذه النشرة'); css(s.t2, { top: '770px', right: '100px', background: 'var(--gold)', color: '#1b1511' });
      s.strip = photo(s.e, 'img/site-light-strip.png', 260, 240, 560, 1180);
      s.sl = el('div', 'center', s.e, '<span class="chip">222 بيتًا · بالضبط التام</span>'); css(s.sl, { top: '1460px' });
    }
    // 11. the voice
    { const s = S.sayed = { e: scene() };
      s.lab = el('div', 'center kufi', s.e, 'إلقاء'); css(s.lab, { top: '420px', fontSize: '46px', color: 'var(--muted)' });
      s.name = el('div', 'center amiri gold', s.e, C.sayed); css(s.name, { top: '500px', fontSize: '150px' });
      s.wave = wave(s.e, 860, 900, 220);
      s.qrow = el('div', 'center', s.e); css(s.qrow, { top: '1180px', display: 'flex', justifyContent: 'center', gap: '22px' });
      s.q = ['عذبٌ متقن', 'يُبين المعاني', 'يُحسن الوقف والابتداء'].map(n => {
        const e = el('div', 'chip', s.qrow, n); e.style.fontSize = '34px'; return e;
      });
    }
    // 12. the YouTube edition
    { const s = S.youtube = { e: scene() };
      s.lab = el('div', 'center', s.e, '<span class="chip">يوتيوب · الضبط النهائي على صوت محمد سايد</span>'); css(s.lab, { top: '320px' });
      s.p = photo(s.e, 'img/youtube-thumb.jpg', 60, 440, 960, 540);
      s.cap = el('div', '', s.p.f);
      css(s.cap, { position: 'absolute', left: '40px', right: '40px', bottom: '34px', textAlign: 'center', fontFamily: 'Amiri',
        fontSize: '44px', color: '#fff', padding: '6px 18px 12px', background: 'rgba(0,0,0,0.72)', borderRadius: '10px' });
      s.bar = el('div', '', s.e); css(s.bar, { position: 'absolute', left: '60px', width: '960px', top: '1000px', height: '8px', borderRadius: '4px', background: 'rgba(245,236,220,0.2)' });
      s.fill = el('div', '', s.bar); css(s.fill, { height: '100%', borderRadius: '4px', background: 'var(--gold)', width: '0%' });
      s.list = el('div', 'center amiri', s.e, ''); css(s.list, { top: '1060px', fontSize: '46px', lineHeight: '1.7' });
    }
    // 13. the invitation, and the poem's own last word
    { const s = S.cta = { e: scene() };
      s.url = el('div', 'center', s.e, '<span class="kufi" style="direction:ltr;display:inline-block;font-size:70px;font-weight:600;padding:22px 50px 30px;border-radius:70px;border:2px solid var(--gold);background:rgba(23,18,14,0.7)"></span>');
      css(s.url, { top: '420px' });
      s.urlText = s.url.firstChild;
      s.acts = ['اقرأ', 'استمع', 'شارك'].map((n, i) => {
        const e = el('div', 'chip', s.e, n); css(e, { position: 'absolute', top: '650px', left: (690 - i * 270) + 'px', width: '230px', textAlign: 'center', fontSize: '44px' });
        return e;
      });
      s.v = verseBlock(s.e, 'r5', 860, 72);
      s.wave = wave(s.e, 1290);
    }
    // 14. credits
    { const s = S.end = { e: scene() };
      s.p = photo(s.e, 'img/khalid-library.jpg', 370, 250, 340, 340, 'round');
      s.lines = C.credits.map(([k, v], i) => {
        const e = el('div', 'center', s.e, `<div class="kufi" style="font-size:32px;color:var(--muted)">${k}</div><div class="amiri" style="font-size:62px;color:${i === 2 ? 'var(--gold2)' : 'var(--cream)'};line-height:1.5">${v}</div>`);
        css(e, { top: (680 + i * 210) + 'px' });
        return e;
      });
      s.title = el('div', 'center amiri gold', s.e, C.title); css(s.title, { top: '1330px', fontSize: '84px' });
    }
  }

  // ---------------------------------------------------------- per-scene drawing
  const D = {
    hook(s, t, L) {
      op(s.orn, ramp(L, 0.2, 0.6) * 0.9); op(s.title, ramp(L, 0.3, 0.8));
      drawVerses(s.v, t);
      const r = reciteState(t);
      if (r) drawWave(s.wave, r.env, r.pos);
    },
    title(s, t, L, sc) {
      const a = sc.start;
      const k = out3(ramp(t, a + 0.1, 1.1));
      s.big.style.clipPath = `inset(0 0 0 ${((1 - k) * 100).toFixed(1)}%)`;
      s.big.style.transform = `scale(${lerp(1.06, 1, k).toFixed(4)})`;
      op(s.r1, ramp(t, a + 0.7, 0.6)); s.r1.style.transform = `scaleX(${out3(ramp(t, a + 0.7, 0.8)).toFixed(3)})`;
      op(s.sub, ramp(t, W('a1', 3) - 0.1, 0.5));
      const c0 = W('a1', 5), c1 = W('a1', 8) + 0.5;
      const n = Math.round(222 * out3(ramp(t, c0, c1 - c0)));
      s.num.textContent = `${n} بيتًا`;
      op(s.num, ramp(t, c0 - 0.2, 0.4));
    },
    author(s, t, L, sc) {
      const sw = W('a2', 9) - 0.3;                     // the second photo, with "أحد أعلام"
      const zin = ramp(t, sc.start, sc.end - sc.start);
      kb(s.p1, 0.52, 0.42, lerp(1.25, 1.42, zin));
      kb(s.p2, 0.4, 0.35, lerp(1.05, 1.15, ramp(t, sw, 4)));
      op(s.p1.f, 1 - ramp(t, sw, 0.6)); op(s.p2.f, ramp(t, sw, 0.6));
      op(s.cap2, ramp(t, sw + 0.3, 0.5));
      op(s.name, ramp(t, W('a2', 3) - 0.2, 0.6));
      op(s.note, ramp(t, W('a2', 6) - 0.1, 0.5));
      op(s.role, ramp(t, W('a2', 9) - 0.1, 0.5));
      s.name.style.transform = `translateY(${((1 - out3(ramp(t, W('a2', 3) - 0.2, 0.8))) * 20).toFixed(1)}px)`;
    },
    rajaz(s, t, L, sc) {
      const r2 = segStart('r2');
      const a = 1 - ramp(t, r2 - 0.6, 0.5);           // the poets give way to the beat
      op(s.head, Math.min(ramp(L, 0.1, 0.6), a));
      op(s.nick, Math.min(ramp(t, W('a3', 4) - 0.2, 0.5), 1 - ramp(t, W('a3', 6), 0.6)));
      const n0 = W('a3', 6), n1 = W('a3', 11);
      s.names.forEach((e, i) => {
        const at = n0 + (n1 - n0) * i / s.names.length;
        const k = ramp(t, at, 0.5);
        op(e, Math.min(k, a));
        e.style.transform = `translateY(${((1 - out3(k)) * 26).toFixed(1)}px)`;
      });
      // three feet, lit with the recitation
      const seg = SEG.r2, sh = seg.shatrs[0];
      const footLen = (sh.e - sh.s) / 3;
      s.feet.forEach((e, i) => {
        const at = sh.s + i * footLen;
        op(e, ramp(t, r2 - 0.3, 0.4) * (t < at ? 0.3 : 1));
        e.style.transform = `scale(${(1 + 0.08 * Math.exp(-Math.max(0, t - at) * 6) * (t >= at ? 1 : 0)).toFixed(3)})`;
      });
      s.dots.forEach((e, i) => {
        const at = sh.s + i * footLen;
        const hit = t >= at ? Math.exp(-(t - at) * 5) : 0;
        op(e, ramp(t, r2 - 0.3, 0.4) * (t >= at ? 1 : 0.25));
        e.style.transform = `scale(${(1 + 1.4 * hit).toFixed(3)})`;
      });
      op(s.v.box, ramp(t, r2 - 0.4, 0.4));
      drawVerses(s.v, t);
      op(s.wave, ramp(t, r2 - 0.4, 0.4));
      const r = reciteState(t); if (r && r.seg.id === 'r2') drawWave(s.wave, r.env, r.pos);
    },
    fifi(s, t, L, sc) {
      const r3 = segStart('r3');
      const zf = ramp(t, W('a4', 4) - 0.3, 2.5), z2 = ramp(t, W('a4', 16), 5);
      // whole photo, then toward al-Fifi, then back to the writing hand
      const fx = lerp(lerp(0.5, 0.36, ease(zf)), 0.5, ease(z2)), fy = lerp(lerp(0.5, 0.42, ease(zf)), 0.5, ease(z2));
      const z = lerp(lerp(1.0, 1.75, ease(zf)), 1.08, ease(z2));
      const map = kb(s.p, fx, fy, z);
      const dim = ramp(t, r3 - 0.8, 0.6);
      s.p.f.style.filter = `brightness(${(1 - 0.55 * dim).toFixed(3)})`;
      const pts = [[0.335, 0.13], [0.6, 0.17], [0.9, 0.11]];
      const vis = [Math.min(ramp(t, W('a4', 5) - 0.2, 0.5), 1 - dim),
        Math.min(ramp(L, 0.6, 0.5), 1 - ramp(t, W('a4', 4) - 0.4, 0.4)) + Math.min(ramp(t, W('a4', 16) + 1.5, 0.5), 1 - dim),
        Math.min(ramp(L, 0.6, 0.5), 1 - ramp(t, W('a4', 4) - 0.4, 0.4)) + Math.min(ramp(t, W('a4', 16) + 1.5, 0.5), 1 - dim)];
      s.lab.forEach((e, i) => {
        const [x, y] = map(...pts[i]);
        const bw = e.offsetWidth, inside = x > -40 && x < 1000 && y > 0 && y < 700;
        css(e, { left: clamp(60 + x - bw / 2, 70, 1010 - bw) + 'px', top: (230 + clamp(y - 70, 10, 620)) + 'px' });
        op(e, inside ? clamp(vis[i]) : 0);
      });
      op(s.note, Math.min(ramp(L, 0.8, 0.5), 1 - dim));
      op(s.route, Math.min(ramp(t, W('a4', 10) - 0.2, 0.5), 1 - ramp(t, W('a4', 16) - 0.2, 0.4)));
      op(s.ask, Math.min(ramp(t, W('a4', 25) - 0.2, 0.5), 1 - ramp(t, r3 - 0.7, 0.4)));
      op(s.v.box, ramp(t, r3 - 0.5, 0.4)); drawVerses(s.v, t);
      op(s.wave, ramp(t, r3 - 0.5, 0.4));
      const r = reciteState(t); if (r && r.seg.id === 'r3') drawWave(s.wave, r.env, r.pos);
    },
    honor(s, t, L, sc) {
      const r4 = segStart('r4');
      const away = ramp(t, W('a5', 14) - 0.1, 0.5);
      op(s.head, Math.min(ramp(L, 0.2, 0.5), 1 - away)); op(s.sub, Math.min(ramp(t, W('a5', 3), 0.5), 1 - away));
      const c0 = W('a5', 8) - 0.2, c1 = W('a5', 13);
      s.cards.forEach((c, i) => {
        const k = ramp(t, c0 + (c1 - c0) * i / 4, 0.45);
        op(c, Math.min(k, 1 - away));
        c.style.transform = `translateX(${((1 - out3(k)) * -60).toFixed(1)}px)`;
      });
      op(s.v.box, ramp(t, r4 - 0.6, 0.5)); drawVerses(s.v, t);
      // gold leaf: a sheen across the verse in gold
      const sheen = ((t - r4) / 2.2) % 1;
      s.v.spans.forEach(x => {
        x.el.style.backgroundImage = `linear-gradient(100deg, #b98d3e 0%, #f6e3b0 ${(sheen * 100).toFixed(1)}%, #c99a48 ${Math.min(100, sheen * 100 + 18).toFixed(1)}%, #b98d3e 100%)`;
        x.el.style.webkitBackgroundClip = 'text'; x.el.style.color = 'transparent';
      });
      op(s.wave, ramp(t, r4 - 0.5, 0.4));
      const r = reciteState(t); if (r && r.seg.id === 'r4') drawWave(s.wave, r.env, r.pos);
    },
    edition(s, t, L, sc) {
      const sw = W('a6', 6) - 0.3;
      op(s.ph, 1 - ramp(t, sw, 0.5));
      s.ph.style.transform = `translateY(${((1 - out3(ramp(L, 0, 1))) * 80).toFixed(1)}px)`;
      $('img', s.scr).style.transform = `translateY(${(-lerp(0, 260, ease(ramp(t, sc.start + 0.5, sw - sc.start)))).toFixed(1)}px)`;
      op(s.p.f, ramp(t, sw, 0.5)); kb(s.p, 0.5, 0.4, lerp(1.0, 1.08, ramp(t, sw, 5)));
      op(s.name, ramp(t, W('a6', 10) - 0.2, 0.5)); op(s.role, ramp(t, W('a6', 6), 0.5));
    },
    layout(s, t, L, sc) {
      const ph0 = W('a7', 7) - 0.2, ph1 = W('a7', 13) - 0.3;   // "and on the phone…"
      const kAt = W('a7', 15) - 0.1;
      const withK = t >= kAt;
      s.rows.forEach((r, i) => {
        const txt = withK ? r.b : r.plain;
        if (r.a.textContent !== txt[0]) { r.a.textContent = txt[0]; r.z.textContent = txt[1]; }
        op(r.n, ramp(t, W('a7', 19) + i * 0.15, 0.3));
      });
      const phone = Math.min(ramp(t, ph0, 0.45), 1 - ramp(t, ph1, 0.45));
      op(s.box, Math.min(ramp(L, 0, 0.5), 1 - phone));
      op(s.ph, phone);
      s.ph.style.transform = `translateY(${((1 - out3(ramp(t, ph0, 0.6))) * 60).toFixed(1)}px)`;
      // the spine: the straight column between the two halves
      const sp = out3(ramp(t, W('a7', 3) - 0.1, 0.8));
      const bw = s.box.clientWidth;
      css(s.spine, { left: (bw / 2 - 2) + 'px', top: '40px', height: ((s.box.clientHeight - 80) * sp) + 'px' });
      op(s.spine, ramp(t, W('a7', 3) - 0.1, 0.3) * (1 - 0.6 * ramp(t, ph0, 0.5)));
      s.tags.forEach((e, i) => { css(e, { left: (i ? 200 : 680) + 'px' }); op(e, Math.min(ramp(t, W('a7', 0), 0.4), 1 - ramp(t, ph0, 0.4))); });
      const k1 = ramp(t, W('a7', 13) - 0.2, 0.4), k2 = ramp(t, kAt, 0.5);
      op(s.k1, k1 * (1 - k2)); op(s.k2, k2); op(s.kl, k2);
      s.k2.style.transform = `scaleX(${lerp(0.9, 1, out3(k2)).toFixed(3)})`;
    },
    features(s, t, L, sc) {
      const at = i => W('a8', i) - 0.15;
      const marks = [at(1), at(3), at(5), at(8), at(9), at(12)];
      let cur = -1; marks.forEach((m, i) => { if (t >= m) cur = i; });
      s.layers.forEach((l, i) => op(l.i, Math.min(ramp(t, marks[i], 0.35), i < 3 ? 1 - ramp(t, marks[i + 1], 0.35) : 1 - ramp(t, marks[4], 0.35))));
      if (s.layers[1]) s.layers[1].i.style.transform = `scale(${lerp(0.94, 1, out3(ramp(t, marks[1], 0.5))).toFixed(3)})`;
      const cp = ramp(t, marks[4], 0.3) * (1 - ramp(t, marks[5], 0.3));
      op(s.sel, cp * ramp(t, marks[4], 0.2)); op(s.toast, cp * ramp(t, marks[4] + 0.7, 0.4));
      const pd = ramp(t, marks[5], 0.45);
      op(s.ph, 1 - pd); s.ph.style.transform = `scale(${lerp(1, 0.92, pd).toFixed(3)})`;
      op(s.pdf1.f, pd); op(s.pdf2.f, pd);
      kb(s.pdf1, 0.5, 0.5, 1); kb(s.pdf2, 0.5, 0.5, 1);
      op(s.pl1, ramp(t, at(14), 0.3)); op(s.pl2, ramp(t, at(15), 0.3));
      const lab = cur >= 0 ? C.features[cur].label : '';
      if (s.chip.dataset.l !== lab) { s.chip.dataset.l = lab; s.chip.innerHTML = lab ? `<span class="chip" style="font-size:40px">${lab}</span>` : ''; }
      op(s.chip, cur >= 0 ? ramp(t, marks[cur], 0.25) : 0);
    },
    rare(s, t, L, sc) {
      const sw = W('a9', 5) - 0.2;
      const a = 1 - ramp(t, sw, 0.5);
      op(s.c1, Math.min(ramp(L, 0, 0.5), a)); op(s.t1, Math.min(ramp(L, 0.2, 0.4), a));
      op(s.c2.f, Math.min(ramp(t, W('a9', 3) - 0.2, 0.5), a)); op(s.t2, Math.min(ramp(t, W('a9', 3), 0.4), a));
      kb(s.c2, 0.52, 0.45, 1.25);
      op(s.strip.f, ramp(t, sw, 0.5)); op(s.sl, ramp(t, W('a9', 10) - 0.2, 0.4));
      // the long strip scrolls: page after page of a long poem
      const n = IMG['img/site-light-strip.png'];
      const iw = 560, ih = n.naturalHeight * iw / n.naturalWidth;
      const y = -lerp(0, ih - 1180, ease(ramp(t, sw, sc.end - sw)));
      css(s.strip.im, { width: iw + 'px', height: ih + 'px', transform: `translate(0px, ${y.toFixed(1)}px)` });
    },
    sayed(s, t, L, sc) {
      op(s.lab, ramp(L, 0.1, 0.5)); op(s.name, ramp(t, W('a10', 3) - 0.3, 0.6));
      s.name.style.letterSpacing = `${lerp(8, 0, out3(ramp(t, W('a10', 3) - 0.3, 1.2))).toFixed(2)}px`;
      op(s.wave, ramp(L, 0, 0.6));
      drawWave(s.wave, ENV.clips.bed, 2 + L * 1.0);
      [5, 7, 9].forEach((w, i) => op(s.q[i], ramp(t, W('a10', w) - 0.15, 0.35)));
    },
    youtube(s, t, L, sc) {
      op(s.lab, ramp(L, 0, 0.4)); op(s.p.f, ramp(L, 0.1, 0.5)); kb(s.p, 0.5, 0.5, 1);
      const c0 = W('a11', 5) - 0.2, per = 0.85;
      const i = clamp(Math.floor((t - c0) / per), 0, C.yt.length - 1);
      const on = t >= c0;
      s.cap.innerHTML = on ? C.yt[i] : '';
      op(s.cap, on ? 1 : 0);
      s.fill.style.width = (clamp((t - sc.start) / (sc.end - sc.start)) * 100).toFixed(1) + '%';
      op(s.bar, ramp(L, 0.3, 0.4));
      s.list.innerHTML = C.yt.map((x, k) => `<div style="color:${k === i && on ? 'var(--gold2)' : k < i && on ? 'var(--cream)' : 'var(--dim)'}">${x}</div>`).join('');
      op(s.list, ramp(t, c0, 0.4));
    },
    cta(s, t, L, sc) {
      const n = Math.round(clamp((L - 0.2) / 1.6) * C.url.length);
      s.urlText.textContent = C.url.slice(0, n) + (n < C.url.length ? '|' : '');
      op(s.url, ramp(L, 0, 0.3));
      s.acts.forEach((e, i) => {
        const k = ramp(t, W('a12', i) - 0.15, 0.3);
        op(e, k); e.style.borderColor = k > 0.5 ? 'var(--gold)' : 'var(--line)';
      });
      const r5 = segStart('r5');
      op(s.v.box, ramp(t, r5 - 0.5, 0.4)); drawVerses(s.v, t);
      op(s.wave, ramp(t, r5 - 0.5, 0.4));
      const r = reciteState(t); if (r && r.seg.id === 'r5') drawWave(s.wave, r.env, r.pos);
    },
    end(s, t, L, sc) {
      op(s.p.f, ramp(L, 0.1, 0.6)); kb(s.p, 0.5, 0.36, 2.1);
      s.lines.forEach((e, i) => op(e, ramp(L, 0.5 + i * 0.5, 0.5)));
      op(s.title, ramp(L, 2.2, 0.6));
    },
  };

  // ---------------------------------------------------------- captions
  const capLine = $('#cap-line');
  let capKey = '';
  function drawCaption(t) {
    let html = '', key = '', alpha = 0;
    for (const s of TL.segments) {
      if (t < s.speechStart - 0.4 || t > s.speechEnd + 0.5) continue;
      if (s.kind === 'recite') {
        key = 'r' + s.id; html = '<span class="label" style="font-size:40px">بصوت محمد سايد</span>';
        alpha = win(t, s.speechStart - 0.4, s.speechEnd + 0.4, 0.3);
        break;
      }
      for (let c = 0; c < s.chunks.length; c++) {
        const ws = s.chunks[c].map(i => s.words[i]);
        const next = s.chunks[c + 1] ? s.words[s.chunks[c + 1][0]].s : s.speechEnd + 0.5;
        if (t >= ws[0].s - 0.25 && t < next - 0.05) {
          key = s.id + ':' + c + ':' + ws.map(w => (t >= w.s ? (t < w.e ? 'n' : 'd') : 'x')).join('');
          html = ws.map(w => `<span class="w ${t < w.s ? 'next' : t < w.e ? 'now' : ''}">${w.t}</span>`).join(' ');
          alpha = Math.min(ramp(t, ws[0].s - 0.25, 0.2), 1 - ramp(t, next - 0.25, 0.2));
          if (c === 0) alpha = Math.min(alpha + 0, ramp(t, ws[0].s - 0.25, 0.2));
          break;
        }
      }
      if (key) break;
    }
    if (key !== capKey) { capLine.innerHTML = html; capKey = key; }
    op(capLine, alpha);
  }

  // ---------------------------------------------------------- grain
  const gc = el('canvas', '', $('#grain')); gc.width = 540; gc.height = 960;
  css(gc, { width: '1080px', height: '1920px' });
  function drawGrain(f) {
    const g = gc.getContext('2d'), d = g.createImageData(540, 960);
    let s = (f * 9301 + 49297) % 233280;
    for (let i = 0; i < d.data.length; i += 4) {
      s = (s * 9301 + 49297) % 233280;
      const v = (s / 233280) * 255;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
  }

  // ---------------------------------------------------------- frame
  const FADE = 0.45;
  window.renderFrame = t => {
    for (const name of TL.order) {
      const sc = TL.scenes[name], s = S[name];
      const first = name === TL.order[0], last = name === TL.order[TL.order.length - 1];
      const a = Math.min(first ? 1 : ramp(t, sc.start - FADE / 2, FADE), last ? 1 - ramp(t, sc.end - 0.8, 0.8) : 1 - ramp(t, sc.end - FADE / 2, FADE));
      op(s.e, a);
      if (a > 0) D[name](s, t, t - sc.start, sc);
    }
    $('#bg').style.transform = `translateY(${(Math.sin(t / 9) * 18).toFixed(1)}px) scale(1.02)`;
    op($('#url'), Math.min(ramp(t, 0.3, 0.6), 1 - ramp(t, TL.scenes.end.start - 0.3, 0.6)));
    drawCaption(t);
    drawGrain(Math.round(t * 30));
  };

  // ---------------------------------------------------------- sound cues for the mixer
  function sfx() {
    const out = [];
    const add = (t, type, gain = 1) => out.push({ t: +t.toFixed(3), type, gain });
    for (const name of TL.order.slice(1)) {
      const st = TL.scenes[name].start;
      // no whoosh right on top of a recitation
      const rec = TL.segments.some(s => s.kind === 'recite' && Math.abs(s.speechStart - st) < 0.6);
      if (!rec) add(st - 0.3, 'whoosh', 0.7);
    }
    add(TL.scenes.title.start + 0.1, 'shimmer', 0.8);
    const c = TL.scenes.cta.start;
    for (let i = 1; i <= C.url.length; i++) add(c + 0.2 + 1.6 * i / C.url.length, 'key', 0.8);
    add(TL.scenes.end.start + 0.3, 'swell', 0.6);
    return out;
  }

  // ---------------------------------------------------------- start
  const lang = new URLSearchParams(location.search).get('lang') || 'ar';
  window.ready = (async () => {
    const [tl, env] = await Promise.all([fetch(`timeline.${lang}.json`).then(r => r.json()), fetch('data/env.json').then(r => r.json())]);
    TL = tl; ENV = env;
    TL.segments.forEach(s => (SEG[s.id] = s));
    window.FPS = TL.fps; window.DURATION = TL.duration;
    build();
    await loadImages([...document.querySelectorAll('img')].map(i => i.getAttribute('src')));
    await document.fonts.ready;
    await Promise.all(['Amiri', 'Kufi'].map(f => document.fonts.load(`40px ${f}`, 'حمار')));
    window.SFX = sfx();
    window.renderFrame(0);
    if (new URLSearchParams(location.search).has('play')) {
      const t0 = performance.now();
      const loop = () => { window.renderFrame((performance.now() - t0) / 1000); requestAnimationFrame(loop); };
      loop();
    }
  })();
})();
