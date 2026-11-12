/* Openings Local: app shell, router and pages. */
window.App = (() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, s, p) => `${n.toLocaleString()} ${n === 1 ? s : (p || s + 's')}`;
  const main = $('#main');

  /* ======================= small UI helpers ======================= */
  const toastsEl = document.createElement('div'); toastsEl.className = 'toasts'; document.body.appendChild(toastsEl);
  function toast(msg, type = '') {
    const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg;
    toastsEl.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 240); }, 2600);
  }
  function modal({ title, sub, body, buttons, wide, onOpen }) {
    return new Promise(resolve => {
      const back = document.createElement('div'); back.className = 'modal-back';
      back.innerHTML = `<div class="modal" ${wide ? 'style="width:min(720px,100%)"' : ''}><h2>${esc(title)}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}<div class="modal-body">${body || ''}</div><div class="btn-row"></div></div>`;
      const row = $('.btn-row', back);
      (buttons || [{ label: 'OK', value: true, cls: 'primary' }]).forEach(b => {
        const btn = document.createElement('button'); btn.className = 'btn ' + (b.cls || ''); btn.textContent = b.label;
        btn.onclick = () => { const v = typeof b.value === 'function' ? b.value(back) : b.value; if (v === '__keep') return; close(v); };
        row.appendChild(btn);
      });
      function close(v) { back.remove(); document.removeEventListener('keydown', onKey); resolve(v); }
      function onKey(e) { if (e.key === 'Escape') close(null); }
      document.addEventListener('keydown', onKey);
      back.addEventListener('mousedown', e => { if (e.target === back) close(null); });
      document.body.appendChild(back);
      const first = $('input, textarea, select', back); if (first) setTimeout(() => first.focus(), 30);
      if (onOpen) onOpen(back);
    });
  }
  const confirmDlg = (title, html, okLabel = 'Confirm', cls = 'danger') => modal({ title, body: `<p>${html}</p>`, buttons: [{ label: 'Cancel', value: null }, { label: okLabel, value: true, cls }] });

  let openMenuEl = null;
  function menu(x, y, items) {
    closeMenu();
    const m = document.createElement('div'); m.className = 'menu';
    items.forEach(it => {
      const b = document.createElement('button'); b.innerHTML = (it.icon ? Icon(it.icon) : '') + esc(it.label); if (it.danger) b.classList.add('danger');
      b.onclick = (e) => { e.stopPropagation(); closeMenu(); it.action(); }; m.appendChild(b);
    });
    document.body.appendChild(m);
    const r = m.getBoundingClientRect();
    m.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
    m.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
    openMenuEl = m;
    setTimeout(() => document.addEventListener('mousedown', onMenuDoc), 0);
  }
  function onMenuDoc(e) { if (openMenuEl && !openMenuEl.contains(e.target)) closeMenu(); }
  function closeMenu() { if (openMenuEl) { openMenuEl.remove(); openMenuEl = null; document.removeEventListener('mousedown', onMenuDoc); } }

  function download(filename, text, type = 'text/plain') {
    if (window.OpeningsAndroid) return OpeningsAndroid.save(filename, text, type);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function copy(text) {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast('Copied to clipboard', 'ok')).catch(() => {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Copied to clipboard', 'ok');
    });
  }

  /* ======================= opening database ======================= */
  const DB = (window.OPENINGS_DB || []).map((o, i) => {
    const name = o[1], ci = name.indexOf(':');
    const family = ci < 0 ? name.trim() : name.slice(0, ci).trim();
    const rest = ci < 0 ? '' : name.slice(ci + 1).trim();
    return { i, eco: o[0], name, family, sub: rest ? rest.split(',')[0].trim() : 'Main line', rest, moves: o[2].split(' '), key: o[2], gambit: /gambit/i.test(name) && !/declined/i.test(name), search: (o[0] + ' ' + name + ' ' + o[2]).toLowerCase() };
  });
  const DB_BY_KEY = new Map(DB.map(d => [d.key, d]));
  const FAMILIES = (() => {
    const m = new Map();
    for (const d of DB) {
      let f = m.get(d.family);
      if (!f) { f = { name: d.family, items: [], ecoMin: d.eco, ecoMax: d.eco, gambits: 0, first: d.moves[0] }; m.set(d.family, f); }
      f.items.push(d);
      if (d.eco < f.ecoMin) f.ecoMin = d.eco;
      if (d.eco > f.ecoMax) f.ecoMax = d.eco;
      if (d.gambit) f.gambits++;
    }
    const arr = [...m.values()];
    for (const f of arr) f.items.sort((a, b) => a.moves.length - b.moves.length || a.name.localeCompare(b.name));
    arr.sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
    return arr;
  })();
  function detectOpening(moves) {
    for (let n = Math.min(moves.length, 40); n >= 1; n--) { const d = DB_BY_KEY.get(moves.slice(0, n).join(' ')); if (d) return d; }
    return null;
  }
  // which built-in courses cover a family
  const famCache = new Map();
  function coursesForFamily(family) {
    if (!famCache.has(family)) famCache.set(family, Courses.builtIn().filter(c => c.lines.some(l => (l.name || '').split(':')[0].trim() === family)));
    return famCache.get(family);
  }

  /* ======================= settings → DOM ======================= */
  const THEMES = {
    brown: ['#f0d9b5', '#b58863'], blue: ['#dee3e6', '#8ca2ad'], green: ['#ffffdd', '#86a666'], purple: ['#e5dcf2', '#9078b6'],
    wood: ['#e6c89c', '#a87a4f'], grey: ['#e3e3e3', '#a3a3a3'], pink: ['#f6dfe4', '#d68fa0'], ocean: ['#cfe3ee', '#5d8fb0'],
  };
  function animMs() { return { off: 0, fast: 90, normal: 180, slow: 320 }[Store.settings.animation] ?? 180; }
  function applySettings() {
    const s = Store.settings, r = document.documentElement;
    r.dataset.appearance = s.appearance;
    r.style.setProperty('--scale', s.uiScale / 100);
    r.style.setProperty('--anim', animMs() + 'ms');
    const [l, d] = THEMES[s.boardTheme] || THEMES.brown;
    r.style.setProperty('--sq-light', l); r.style.setProperty('--sq-dark', d);
    r.style.setProperty('--coord-light', d); r.style.setProperty('--coord-dark', l);
    const t = $('#theme-toggle'); if (t) t.innerHTML = Icon(s.appearance === 'dark' ? 'moon' : 'sun');
  }

  /* ======================= header ======================= */
  function updateStreak() {
    const el = $('#streak'); if (!el) return;
    $('.n', el).textContent = Courses.streak();
    el.classList.toggle('lit', Courses.trainedToday());
    el.title = Courses.trainedToday() ? 'Day streak: you trained today' : 'Day streak: finish a line today to keep it going';
  }

  /* ======================= router ======================= */
  let cleanup = null;
  function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    const view = parts[0] || 'courses';
    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
    closeMenu();
    $$('.topnav a').forEach(a => a.classList.toggle('active', a.dataset.view === view || (view === 'course' && a.dataset.view === 'courses')));
    $$('.top-right [data-view]').forEach(a => a.classList.toggle('active', a.dataset.view === view));
    window.scrollTo(0, 0);
    const fn = Views[view] || Views.courses;
    const c = fn(parts.slice(1));
    if (typeof c === 'function') cleanup = c;
    updateStreak();
    document.title = (fn.title ? fn.title(parts.slice(1)) + ' · ' : '') + 'Openings Local';
  }
  const go = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };
  window.addEventListener('hashchange', route);

  const Views = {};

  /* ======================= Courses (home) ======================= */
  const homeState = { q: '', side: 'all', group: 'all', style: 'all', status: 'all', filtersOpen: false };
  const GROUPS = ['1.e4', '1.d4', 'Flank', 'vs 1.e4', 'vs 1.d4', 'Mine'];
  const STYLES = ['Gambit', 'Traps', 'Aggressive', 'Solid', 'System', 'Sharp', 'Offbeat'];

  function courseCard(c, i) {
    const st = Courses.stats(c);
    const p = Courses.peek(c.id) || {};
    const pct = (a, b) => b ? Math.min(100, a / b * 100) : 0;
    const segs = [
      ['learn', pct(st.learned, st.total)], ['practice', pct(st.perfected, st.total)],
      ['drill', Math.min(100, (p.drillBest || 0) / Math.max(3, Math.min(10, st.total)) * 100)], ['time', Math.min(100, (p.timeBest || 0) / 10 * 100)],
    ];
    const tags = [
      `<span class="tag ${c.side}">${c.side === 'w' ? 'White' : 'Black'}</span>`,
      c.custom ? '<span class="tag mine">My course</span>' : '',
      ...c.tags.slice(0, 3).map(t => `<span class="tag ${/gambit|trap/i.test(t) ? 'gambit' : ''}">${esc(t)}</span>`),
    ].join('');
    return `<div class="course-card" data-id="${esc(c.id)}" style="animation-delay:${Math.min(i, 12) * 30}ms">
      <div class="mini">${Board.mini(c.cover, c.side, Store.settings.pieceSet)}</div>
      <div class="body">
        <h3>${esc(c.name)}</h3>
        <div class="meta">${tags}</div>
        <div class="desc">${esc(c.desc || (c.custom ? 'Your own course.' : ''))}</div>
        <div class="foot">
          <div class="count">${st.started ? `${st.learned}/${st.total} learned · ${st.perfected} perfected · ` : ''}${plural(st.all, 'line')} total</div>
          <div class="segbar">${segs.map(([k, v]) => `<i class="${k}"><b style="width:${v}%"></b></i>`).join('')}</div>
          <span class="try">${st.started ? 'Continue' : 'Try the first line'} ${Icon('arrowRight')}</span>
        </div>
      </div>
      ${c.custom ? `<button class="icon-btn card-menu" data-menu="${esc(c.id)}" title="More">${Icon('more')}</button>` : ''}
    </div>`;
  }

  Views.courses = () => {
    const all = Courses.all();
    const totalLines = all.reduce((a, c) => a + c.lines.length, 0);
    main.innerHTML = `<div class="page">
      <div class="hero"><h1>Chess Opening Courses</h1><p>${plural(all.length, 'course')} · ${plural(totalLines, 'line')} built from millions of real games · trains 100% offline</p></div>
      <div class="toolbar">
        <button class="btn ${homeState.filtersOpen ? 'primary' : ''}" id="filters-btn">${Icon('filter')} Filters</button>
        <div class="search">${Icon('search')}<input class="input" id="q" placeholder="Search openings..." value="${esc(homeState.q)}"></div>
        <span class="grow"></span>
        <a class="btn" href="#/create">${Icon('plus')} Create a Course</a>
        <a class="btn" href="#/library">${Icon('library')} Opening Library ${Icon('arrowRight')}</a>
      </div>
      <div class="filters-pop ${homeState.filtersOpen ? 'open' : ''}" id="filters">
        <div class="fgroup"><span>Side</span><div class="chips">${[['all', 'All'], ['w', 'White'], ['b', 'Black']].map(([v, l]) => `<button class="chip ${homeState.side === v ? 'on' : ''}" data-f="side" data-v="${v}">${l}</button>`).join('')}</div></div>
        <div class="fgroup"><span>Opening</span><div class="chips">${['all', ...GROUPS].map(v => `<button class="chip ${homeState.group === v ? 'on' : ''}" data-f="group" data-v="${v}">${v === 'all' ? 'All' : v}</button>`).join('')}</div></div>
        <div class="fgroup"><span>Style</span><div class="chips">${['all', ...STYLES].map(v => `<button class="chip ${homeState.style === v ? 'on' : ''}" data-f="style" data-v="${v}">${v === 'all' ? 'All' : v}</button>`).join('')}</div></div>
        <div class="fgroup"><span>Progress</span><div class="chips">${[['all', 'All'], ['started', 'In progress'], ['new', 'Not started']].map(([v, l]) => `<button class="chip ${homeState.status === v ? 'on' : ''}" data-f="status" data-v="${v}">${l}</button>`).join('')}</div></div>
      </div>
      <div id="continue"></div>
      <div id="grid"></div>
      <div class="section-title"><h2>Opening Library</h2></div>
      <div class="lib-banner" id="lib-banner"><div class="ico">${Icon('library')}</div><div><h3>Browse all ${DB.length.toLocaleString()} named openings</h3><div class="muted">Every variation and gambit from the lichess opening database. Explore any of them on the board or add them to your own course.</div></div><span class="go">${Icon('arrowRight')}</span></div>
    </div>`;

    function draw() {
      const q = homeState.q.trim().toLowerCase();
      const list = all.filter(c => {
        if (homeState.side !== 'all' && c.side !== homeState.side) return false;
        if (homeState.group !== 'all' && (homeState.group === 'Mine' ? !c.custom : c.group !== homeState.group)) return false;
        if (homeState.style !== 'all' && !c.tags.some(t => t.toLowerCase().includes(homeState.style.toLowerCase()))) return false;
        const st = Courses.stats(c);
        if (homeState.status === 'started' && !st.started) return false;
        if (homeState.status === 'new' && st.started) return false;
        if (q && !(c.name + ' ' + c.desc + ' ' + c.tags.join(' ') + ' ' + c.group).toLowerCase().includes(q)) return false;
        return true;
      });
      const started = Courses.all().filter(c => (Courses.peek(c.id) || {}).last).sort((a, b) => Courses.peek(b.id).last - Courses.peek(a.id).last).slice(0, 2);
      const showContinue = started.length && !q && homeState.side === 'all' && homeState.group === 'all' && homeState.style === 'all' && homeState.status === 'all';
      $('#continue').innerHTML = showContinue ? `<div class="section-title" style="margin-top:6px"><h2>Continue where you left off</h2></div><div class="course-grid">${started.map(courseCard).join('')}</div><div class="section-title"><h2>All courses</h2></div>` : '';
      $('#grid').innerHTML = list.length ? `<div class="course-grid">${list.map(courseCard).join('')}</div>` : `<div class="empty"><h3>No courses match</h3><p>Try another search or clear the filters.</p></div>`;
      $$('.course-card', main).forEach(el => el.onclick = (e) => { if (e.target.closest('[data-menu]')) return; go('#/course/' + encodeURIComponent(el.dataset.id)); });
      $$('[data-menu]', main).forEach(b => b.onclick = (e) => {
        e.stopPropagation();
        const id = b.dataset.menu;
        const r = b.getBoundingClientRect();
        menu(r.left, r.bottom + 4, [
          { label: 'Edit course', icon: 'edit', action: () => go('#/create/' + encodeURIComponent(id)) },
          { label: 'Export PGN', icon: 'download', action: () => { const c = Courses.get(id); download(id + '.pgn', PGN.courseToPgn({ name: c.name, side: c.side, lines: c.lines.map(l => ({ m: l.moves.join(' '), n: l.notes, k: l.marks })) })); } },
          { label: 'Delete course', icon: 'trash', danger: true, action: async () => { if (await confirmDlg('Delete course?', `<b>${esc(Courses.get(id).name)}</b> and its progress will be removed.`, 'Delete')) { Courses.removeCustom(id); route(); } } },
        ]);
      });
    }
    draw();
    $('#q').oninput = (e) => { homeState.q = e.target.value; draw(); };
    $('#filters-btn').onclick = () => { homeState.filtersOpen = !homeState.filtersOpen; $('#filters').classList.toggle('open', homeState.filtersOpen); $('#filters-btn').classList.toggle('primary', homeState.filtersOpen); };
    $$('[data-f]', main).forEach(b => b.onclick = () => {
      homeState[b.dataset.f] = b.dataset.v;
      $$(`[data-f="${b.dataset.f}"]`, main).forEach(x => x.classList.toggle('on', x === b));
      draw();
    });
    $('#lib-banner').onclick = () => go('#/library');
  };
  Views.courses.title = () => 'Courses';

  /* ======================= Course player ======================= */
  Views.course = (parts) => {
    const course = Courses.get(parts[0]);
    if (!course) { main.innerHTML = `<div class="page"><div class="empty"><h3>Course not found</h3><a class="btn" href="#/">Back to courses</a></div></div>`; return; }
    if (!course.lines.length) { main.innerHTML = `<div class="page"><div class="empty"><h3>This course has no lines yet</h3><a class="btn primary" href="#/create/${encodeURIComponent(course.id)}">Add lines</a></div></div>`; return; }
    return Trainer.mount(main, course, { mode: parts[1], lineId: parts[2] });
  };
  Views.course.title = (parts) => { const c = Courses.get(parts[0]); return c ? c.name : 'Course'; };

  /* ======================= Analysis board ======================= */
  function bookNode(sans) {
    let n = window.BOOK_DATA;
    if (!n) return null;
    for (const s of sans) {
      if (!n[4]) return null;
      n = n[4][s] || n[4][s.replace(/[+#]$/, '')];
      if (!n) return null;
    }
    return n;
  }
  Views.analysis = (parts) => {
    const S = Store.settings;
    let moves = parts[0] ? parts[0].split('.').filter(Boolean) : [];
    moves = PGN.validate(moves).moves;
    let cur = moves.length;
    let orientation = parts[1] === 'b' ? 'b' : 'w';
    main.innerHTML = `
      <div class="play" id="play">
        <div class="board-area"><div class="board-col"><div class="material" id="mat-top"></div><div class="board-holder"><div id="board"></div></div><div class="material" id="mat-bot"></div></div></div>
        <aside class="side an-side">
          <div class="side-head">${Icon('board')}<span>Analysis board</span><span class="num" id="an-count"></span></div>
          <div class="side-body" id="an-body"></div>
          <div class="side-foot">
            <button class="foot-btn" id="a-flip" title="Flip board (F)">${Icon('flip')}<span>Flip</span></button>
            <button class="foot-btn" id="a-reset" title="Start position">${Icon('restart')}<span>Reset</span></button>
            <button class="foot-btn" id="a-copy" title="Copy PGN">${Icon('copy')}<span>PGN</span></button>
            <button class="foot-btn" id="a-add" title="Add this line to one of your courses">${Icon('plus')}<span>Add</span></button>
            <span class="spacer"></span>
            <button class="foot-btn nav-btn" id="a-first" title="Start (Home)">${Icon('first')}</button>
            <button class="foot-btn nav-btn" id="a-prev" title="Back (←)">${Icon('left')}</button>
            <button class="foot-btn nav-btn" id="a-next" title="Forward (→)">${Icon('right')}</button>
            <button class="foot-btn nav-btn" id="a-last" title="End (End)">${Icon('last')}</button>
          </div>
        </aside>
      </div>`;
    const play = $('#play');
    let chess = new Chess();
    const board = new Board($('#board'), {
      pieceSet: S.pieceSet, coords: S.showCoords, orientation, showLegal: S.showLegal,
      onMove: (from, to) => {
        const legal = chess.moves({ verbose: true }).filter(m => m.from === from && m.to === to);
        if (!legal.length) return false;
        const mv = chess.move({ from, to, promotion: legal.some(m => m.promotion) ? 'q' : undefined });
        moves = moves.slice(0, cur).concat(mv.san);
        cur = moves.length;
        Sound.forMove(mv, chess);
        sync(); return true;
      },
      legalMoves: (sq) => chess.moves({ square: sq, verbose: true }).map(m => ({ to: m.to, capture: !!m.captured })),
    });
    board.setInteractive('both');
    function layout() {
      const W = Math.min(innerWidth, document.documentElement.clientWidth), H = Math.min(innerHeight, document.documentElement.clientHeight || innerHeight);
      const narrow = W <= 860;
      let bs = narrow ? Math.min(W - 20, (H - 60) * 0.72) : Math.min(H - 60 - 36 - 56, W - (W <= 1080 ? 360 : 410) - 22 - 44);
      if (S.boardMax > 0) bs = Math.min(bs, S.boardMax);
      play.style.setProperty('--bs', Math.max(240, Math.floor(bs / 8) * 8) + 'px');
    }
    layout(); addEventListener('resize', layout);

    function sync(animate = true) {
      chess = new Chess();
      let last = null;
      for (const m of moves.slice(0, cur)) last = chess.move(m);
      board.setPosition(chess, animate);
      const king = (() => { if (!chess.in_check()) return null; const b = chess.board(); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const p = b[i][j]; if (p && p.type === 'k' && p.color === chess.turn()) return 'abcdefgh'[j] + (8 - i); } return null; })();
      board.setMarks({ last: last ? [last.from, last.to] : [], check: king });
      history.replaceState(null, '', '#/analysis/' + moves.join('.') + (orientation === 'b' ? '/b' : ''));
      renderSide();
    }
    function renderSide() {
      const path = moves.slice(0, cur);
      const op = detectOpening(path);
      const node = bookNode(path);
      let html = `<div class="opening-name">${op ? `<span class="eco">${esc(op.eco)}</span>${esc(op.name)}` : '<span class="muted">Starting position</span>'}</div>`;
      html += `<div class="movelist">${moves.map((m, i) => (i % 2 === 0 ? `<span class="no">${i / 2 + 1}.</span>` : '') + `<span class="mv ${i + 1 === cur ? 'cur' : ''}" data-i="${i + 1}">${esc(m)}</span>`).join('') || '<span class="faint small">Make a move on the board, or pick one below.</span>'}</div>`;
      if (node && node[4]) {
        const kids = Object.entries(node[4]).map(([san, v]) => ({ san, n: v[0], w: v[1], d: v[2], b: v[3] })).sort((a, b) => b.n - a.n).slice(0, 12);
        const tot = kids.reduce((a, k) => a + k.n, 0) || 1;
        html += `<div class="sub-title">Games database · ${node[0].toLocaleString()} games</div><div class="explorer"><table>${kids.map(k => {
          const t = (k.w + k.d + k.b) || 1;
          const pw = Math.round(k.w / t * 100), pd = Math.round(k.d / t * 100), pb = 100 - pw - pd;
          return `<tr data-san="${esc(k.san)}"><td class="san">${esc(k.san)}</td><td class="pct">${Math.round(k.n / tot * 100)}%</td><td class="n">${k.n.toLocaleString()}</td><td><div class="wdl"><i class="w" style="width:${pw}%">${pw > 12 ? pw + '%' : ''}</i><i class="d" style="width:${pd}%">${pd > 12 ? pd + '%' : ''}</i><i class="b" style="width:${pb}%">${pb > 12 ? pb + '%' : ''}</i></div></td></tr>`;
        }).join('')}</table></div>`;
      } else if (cur > 0) html += `<div class="faint small">No games in the offline database reach this position.</div>`;
      const key = path.join(' ');
      const next = new Map();
      for (const d of DB) {
        if (d.moves.length <= path.length) continue;
        if (path.length && !d.key.startsWith(key + ' ')) continue;
        const nm = d.moves[path.length];
        const prev = next.get(nm);
        if (!prev || d.moves.length < prev.moves.length || (d.moves.length === prev.moves.length && d.name.length < prev.name.length)) next.set(nm, d);
      }
      if (next.size) {
        const list = [...next.entries()].sort((a, b) => a[1].moves.length - b[1].moves.length).slice(0, 14);
        html += `<div class="sub-title">Named continuations</div><div class="named">${list.map(([m, d]) => `<button data-line="${esc(d.key)}"><b>${esc(m)}</b><span>${esc(d.name)}</span></button>`).join('')}</div>`;
      }
      const related = op ? coursesForFamily(op.family) : [];
      if (related.length) html += `<div class="sub-title">Train it</div>${related.map(c => `<a class="btn sm" href="#/course/${encodeURIComponent(c.id)}" style="margin:0 6px 6px 0">${Icon('learn')} ${esc(c.name)}</a>`).join('')}`;
      $('#an-body').innerHTML = html;
      $('#an-count').textContent = cur ? `move ${Math.ceil(cur / 2)}` : '';
      $$('#an-body .mv').forEach(el => el.onclick = () => { cur = +el.dataset.i; sync(); });
      $$('#an-body tr[data-san]').forEach(el => el.onclick = () => { const c = new Chess(chess.fen()); const mv = c.move(el.dataset.san, { sloppy: true }); if (!mv) return; moves = moves.slice(0, cur).concat(mv.san); cur = moves.length; Sound.forMove(mv, c); sync(); });
      $$('#an-body [data-line]').forEach(el => el.onclick = () => { moves = el.dataset.line.split(' '); cur = moves.length; sync(); });
      const cm = $('#an-body .mv.cur'); if (cm) cm.scrollIntoView({ block: 'nearest' });
    }
    const step = (d) => { cur = Math.max(0, Math.min(moves.length, cur + d)); sync(); };
    $('#a-flip').onclick = () => { orientation = orientation === 'w' ? 'b' : 'w'; board.setOrientation(orientation); sync(false); };
    $('#a-reset').onclick = () => { moves = []; cur = 0; sync(); };
    $('#a-copy').onclick = () => copy(PGN.format(moves) || '(no moves)');
    $('#a-add').onclick = () => addToCourse(moves.slice(0, cur), (detectOpening(moves.slice(0, cur)) || {}).name || '');
    $('#a-first').onclick = () => { cur = 0; sync(); };
    $('#a-prev').onclick = () => step(-1);
    $('#a-next').onclick = () => step(1);
    $('#a-last').onclick = () => { cur = moves.length; sync(); };
    const onKey = (e) => {
      if (e.target.closest('input, textarea, select') || $('.modal-back')) return;
      if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'Home') { cur = 0; sync(); } else if (e.key === 'End') { cur = moves.length; sync(); }
      else if (e.key === 'f' || e.key === 'F') $('#a-flip').click();
    };
    document.addEventListener('keydown', onKey);
    sync(false);
    return () => { document.removeEventListener('keydown', onKey); removeEventListener('resize', layout); };
  };
  Views.analysis.title = () => 'Analysis';

  // Add a move sequence to one of the user's courses
  async function addToCourse(moves, name) {
    if (!moves.length) return toast('Make some moves first', 'err');
    const mine = Courses.customs();
    const body = `
      <div class="field"><label>Add to</label><select class="select" id="atc-course">${mine.map(c => `<option value="${esc(c.id)}">${esc(c.name)} (${c.side === 'w' ? 'White' : 'Black'})</option>`).join('')}<option value="__new">+ New course…</option></select></div>
      <div id="atc-new" class="${mine.length ? 'hidden' : ''}">
        <div class="field"><label>Course name</label><input class="input" id="atc-name" value="${esc(name ? name.split(':')[0] : 'My repertoire')}"></div>
        <div class="field"><label>I play</label><select class="select" id="atc-side"><option value="w">White</option><option value="b" ${moves.length % 2 === 0 ? 'selected' : ''}>Black</option></select></div>
      </div>
      <div class="field"><label>Line name</label><input class="input" id="atc-line" value="${esc(name)}"></div>
      <p class="faint small">${esc(PGN.format(moves))}</p>`;
    const res = await modal({
      title: 'Add line to a course', body,
      onOpen: (back) => { const sel = $('#atc-course', back); if (!mine.length) sel.value = '__new'; sel.onchange = () => $('#atc-new', back).classList.toggle('hidden', sel.value !== '__new'); },
      buttons: [{ label: 'Cancel', value: null }, { label: 'Add line', cls: 'primary', value: (b) => ({ course: $('#atc-course', b).value, name: $('#atc-name', b).value.trim(), side: $('#atc-side', b).value, line: $('#atc-line', b).value.trim() }) }],
    });
    if (!res) return;
    let id = res.course;
    if (id === '__new') id = Courses.saveCustom({ name: res.name || 'My repertoire', side: res.side, desc: '', group: 'Mine', tags: [], lines: [] });
    const c = JSON.parse(JSON.stringify(Store.state.custom[id]));
    const isStudent = (ply) => (ply % 2 === 0) === (c.side === 'w');
    const m = moves.slice();
    while (m.length && !isStudent(m.length - 1)) m.pop();
    if (!m.length) return toast('The line needs at least one move for your side', 'err');
    const key = m.join(' ');
    if (c.lines.some(l => l.m === key || l.m.startsWith(key + ' '))) return toast('That line is already in the course');
    c.lines = c.lines.filter(l => !key.startsWith(l.m + ' '));
    c.lines.push({ id: Courses.lineId(m), m: key, n: {}, k: {}, name: res.line || '' });
    Courses.saveCustom(c);
    toast(`Added to ${c.name}`, 'ok');
  }

  /* ======================= Create a course ======================= */
  Views.create = (parts) => {
    const editing = parts[0] ? Store.state.custom[parts[0]] : null;
    const st = {
      side: editing ? editing.side : 'w',
      pgn: editing ? PGN.courseToPgn({ name: editing.name, side: editing.side, lines: editing.lines }) : '', parsed: null,
    };
    main.innerHTML = `<div class="page">
      <div class="page-head"><div><h1>${editing ? 'Edit course' : 'Create a Course'}</h1><div class="sub">Paste a PGN with variations. Every path through the tree becomes a line. Branch on your opponent's moves, and add comments to get coaching notes.</div></div></div>
      <div class="create-grid">
        <div class="card">
          <div class="field"><label>Course name</label><input class="input" id="c-name" placeholder="e.g. My London System" value="${esc(editing ? editing.name : '')}"></div>
          <div class="field"><label>I play</label><div class="seg" id="c-side"><button data-v="w" class="${st.side === 'w' ? 'on' : ''}">♔ White</button><button data-v="b" class="${st.side === 'b' ? 'on' : ''}">♚ Black</button></div></div>
          <div class="field"><label>Description <span class="faint">(optional)</span></label><input class="input" id="c-desc" value="${esc(editing ? editing.desc || '' : '')}" placeholder="What is this course about?"></div>
          <div class="field"><label>PGN</label><textarea class="textarea" id="c-pgn" spellcheck="false" placeholder="1. e4 e5 2. Nf3 Nc6 3. Bc4 { Aim at f7. } Bc5 (3... Nf6 { Attack f7 twice! } 4. Ng5) 4. c3 *">${esc(st.pgn)}</textarea></div>
          <div class="btn-row"><label class="btn">${Icon('upload')} Open .pgn file<input type="file" id="c-file" accept=".pgn,.txt" hidden multiple></label></div>
          <p class="faint small" style="margin-top:12px">Tip: a comment after your opponent's move is shown when it's your turn to reply. Mark opponent mistakes with ? or ?? to turn them into puzzles.</p>
        </div>
        <div class="card" id="c-preview"></div>
      </div>
      <div class="btn-row" style="margin-top:18px;justify-content:flex-end">
        ${editing ? `<button class="btn danger" id="c-del">${Icon('trash')} Delete course</button><span style="flex:1"></span>` : ''}
        <a class="btn ghost" href="#/">Cancel</a>
        <button class="btn primary lg" id="c-save">${editing ? 'Save changes' : 'Create course'}</button>
      </div>
    </div>`;
    function parse() {
      st.pgn = $('#c-pgn').value;
      const r = st.pgn.trim() ? PGN.parseCourse(st.pgn, st.side) : { lines: [], errors: [], games: 0 };
      st.parsed = r;
      const prev = $('#c-preview');
      if (!st.pgn.trim()) { prev.innerHTML = `<div class="empty" style="padding:30px 10px"><h3>Preview</h3><p>Your lines will appear here as you type.</p></div>`; return; }
      const notes = r.lines.reduce((a, l) => a + Object.keys(l.n).length, 0);
      prev.innerHTML = `<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:10px"><h2 style="font-size:1.6rem">${plural(r.lines.length, 'line')}</h2><span class="muted">${plural(r.games, 'game')} · ${plural(notes, 'note')}</span></div>
        ${r.errors.length ? `<div class="err" style="margin-bottom:10px">${r.errors.slice(0, 4).map(esc).join('<br>')}${r.errors.length > 4 ? `<br>…and ${r.errors.length - 4} more` : ''}</div>` : ''}
        ${r.lines.length ? `<div class="tree">${r.lines.slice(0, 300).map((l, i) => `<div><b>#${i + 1}</b> ${esc(PGN.format(l.m.split(' ')))}${l.name ? ` <span class="var">· ${esc(l.name)}</span>` : ''}</div>`).join('')}</div>` : '<p class="muted">No playable lines found yet. A line needs at least one move for your side.</p>'}`;
    }
    $('#c-pgn').oninput = parse;
    $$('#c-side button').forEach(b => b.onclick = () => { st.side = b.dataset.v; $$('#c-side button').forEach(x => x.classList.toggle('on', x === b)); parse(); });
    $('#c-file').onchange = async (e) => {
      const files = [...e.target.files];
      const texts = await Promise.all(files.map(f => f.text()));
      $('#c-pgn').value = ($('#c-pgn').value.trim() ? $('#c-pgn').value.trim() + '\n\n' : '') + texts.join('\n\n');
      if (!$('#c-name').value.trim() && files[0]) $('#c-name').value = files[0].name.replace(/\.(pgn|txt)$/i, '');
      parse();
    };
    $('#c-save').onclick = () => {
      parse();
      const name = $('#c-name').value.trim();
      if (!name) { toast('Give your course a name', 'err'); $('#c-name').focus(); return; }
      if (!st.parsed.lines.length) { toast('Add at least one line', 'err'); return; }
      const lines = st.parsed.lines.map(l => ({ id: Courses.lineId(l.m.split(' ')), m: l.m, n: l.n, k: l.k, name: l.name }));
      const id = Courses.saveCustom({ id: editing ? editing.id : undefined, name, side: st.side, desc: $('#c-desc').value.trim(), group: 'Mine', tags: [], lines });
      toast(editing ? 'Course saved' : 'Course created', 'ok');
      go('#/course/' + encodeURIComponent(id));
    };
    if (editing) $('#c-del').onclick = async () => { if (await confirmDlg('Delete course?', `<b>${esc(editing.name)}</b> and its progress will be removed.`, 'Delete')) { Courses.removeCustom(editing.id); go('#/'); } };
    parse();
  };
  Views.create.title = () => 'Create a Course';

  /* ======================= Library ======================= */
  const libState = { q: '', first: 'all', gambits: false };
  Views.library = (parts) => {
    if (parts[0]) return familyView(parts[0]);
    main.innerHTML = `<div class="page">
      <div class="page-head"><div><h1>Opening Library</h1><div class="sub">${DB.length.toLocaleString()} named openings in ${FAMILIES.length} families. Open any line on the analysis board or add it to your own course.</div></div></div>
      <div class="toolbar"><div class="search">${Icon('search')}<input class="input" id="lq" placeholder="Search by name, ECO code or moves (e.g. 'Fried Liver', 'C57', 'e4 e5 f4')" value="${esc(libState.q)}"></div></div>
      <div class="toolbar">${[['all', 'All'], ['e4', '1.e4'], ['d4', '1.d4'], ['c4', '1.c4'], ['Nf3', '1.Nf3'], ['other', 'Other']].map(([v, l]) => `<button class="chip ${libState.first === v ? 'on' : ''}" data-first="${v}">${l}</button>`).join('')}<button class="chip ${libState.gambits ? 'on' : ''}" id="lg">${Icon('swords')} Gambits only</button></div>
      <div id="lib-out"></div></div>`;
    function draw() {
      const q = libState.q.trim().toLowerCase();
      const firstOk = (m) => libState.first === 'all' || (libState.first === 'other' ? !['e4', 'd4', 'c4', 'Nf3'].includes(m) : m === libState.first);
      const out = $('#lib-out');
      if (q) {
        const qm = q.replace(/\d+\.+\s*/g, '').trim();
        const items = DB.filter(d => firstOk(d.moves[0]) && (!libState.gambits || d.gambit) && (d.search.includes(q) || (qm && d.key.toLowerCase().startsWith(qm)))).slice(0, 200);
        out.innerHTML = items.length ? items.map(d => dbRow(d)).join('') : `<div class="empty"><h3>Nothing found</h3></div>`;
        bindRows(out);
      } else {
        const fams = FAMILIES.filter(f => firstOk(f.first) && (!libState.gambits || f.gambits));
        out.innerHTML = `<div class="fam-grid">${fams.map(f => `<div class="fam" data-fam="${esc(f.name)}"><h3>${esc(f.name)}</h3><span class="sub">${f.ecoMin === f.ecoMax ? f.ecoMin : f.ecoMin + '–' + f.ecoMax} · ${plural(f.items.length, 'variation')}${f.gambits ? ` · ${plural(f.gambits, 'gambit')}` : ''}</span>${coursesForFamily(f.name).length ? `<span class="tag mine" style="align-self:flex-start">${Icon('learn')} Course available</span>` : ''}</div>`).join('')}</div>`;
        $$('.fam', out).forEach(el => el.onclick = () => go('#/library/' + encodeURIComponent(el.dataset.fam)));
      }
    }
    $('#lq').oninput = (e) => { libState.q = e.target.value; draw(); };
    $$('[data-first]').forEach(b => b.onclick = () => { libState.first = b.dataset.first; $$('[data-first]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
    $('#lg').onclick = () => { libState.gambits = !libState.gambits; $('#lg').classList.toggle('on', libState.gambits); draw(); };
    draw();
  };
  Views.library.title = (p) => p[0] || 'Opening Library';

  function dbRow(d, short) {
    return `<div class="vrow" data-i="${d.i}"><div class="txt"><div class="nm"><span class="tag eco">${esc(d.eco)}</span>${esc(short ? (d.rest || d.name) : d.name)}${d.gambit ? `<span class="tag gambit">${Icon('swords')} gambit</span>` : ''}</div><div class="mv">${esc(PGN.format(d.moves))}</div></div>
      <button class="btn sm" data-act="analyse">${Icon('search')} Explore</button><button class="btn sm" data-act="add">${Icon('plus')} Add to course</button></div>`;
  }
  function bindRows(root) {
    $$('.vrow [data-act]', root).forEach(b => b.onclick = () => {
      const d = DB[+b.closest('.vrow').dataset.i];
      if (b.dataset.act === 'analyse') go('#/analysis/' + d.moves.join('.'));
      else addToCourse(d.moves, d.name);
    });
  }
  function familyView(name) {
    const f = FAMILIES.find(x => x.name === name);
    if (!f) { main.innerHTML = `<div class="page"><div class="empty"><h3>Unknown opening</h3><a class="btn" href="#/library">Back</a></div></div>`; return; }
    const related = coursesForFamily(f.name);
    const groups = new Map();
    for (const d of f.items) { const g = groups.get(d.sub) || []; g.push(d); groups.set(d.sub, g); }
    main.innerHTML = `<div class="page">
      <div class="page-head"><div><a class="faint small" href="#/library">${Icon('left')} Opening Library</a><h1 style="margin-top:6px">${esc(f.name)}</h1><div class="sub">${f.ecoMin === f.ecoMax ? f.ecoMin : f.ecoMin + '–' + f.ecoMax} · ${plural(f.items.length, 'variation')}</div></div></div>
      ${related.map(c => `<div class="callout">${Icon('learn')}<div class="grow"><b>Train this opening</b><div class="muted small">${esc(c.name)} · ${plural(c.lines.length, 'line')} for ${c.side === 'w' ? 'White' : 'Black'}</div></div><a class="btn primary" href="#/course/${encodeURIComponent(c.id)}">Open course ${Icon('arrowRight')}</a></div>`).join('')}
      ${[...groups.entries()].map(([g, items]) => `<div class="var-group"><h3>${esc(g)}</h3>${items.map(d => dbRow(d, true)).join('')}</div>`).join('')}
    </div>`;
    bindRows(main);
  }

  /* ======================= Stats ======================= */
  Views.stats = () => {
    let learned = 0, perfected = 0, plays = 0;
    const rows = [];
    for (const c of Courses.all()) {
      const p = Courses.peek(c.id);
      if (!p || !p.last) continue;
      const st = Courses.stats(c);
      const lines = Object.values(p.lines || {});
      learned += lines.filter(l => l.learned).length;
      perfected += lines.filter(l => l.perfect).length;
      plays += lines.reduce((a, l) => a + (l.plays || 0), 0);
      rows.push({ c, st, p });
    }
    rows.sort((a, b) => b.p.last - a.p.last);
    const h = Store.state.history;
    const today = h[Store.todayKey()] || { lines: 0 };
    const cells = [];
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const start = new Date(d); start.setDate(start.getDate() - (7 * 26 - 1) - d.getDay());
    for (let x = new Date(start); x <= d; x.setDate(x.getDate() + 1)) {
      const k = Store.todayKey(x), r = h[k] ? h[k].lines : 0;
      cells.push(`<i class="l${r === 0 ? 0 : r < 5 ? 1 : r < 15 ? 2 : r < 30 ? 3 : 4}" title="${k}: ${plural(r, 'line')}"></i>`);
    }
    main.innerHTML = `<div class="page">
      <div class="page-head"><div><h1>${Icon('trophy')} Your progress</h1><div class="sub">Personal records, all stored on this device.</div></div></div>
      <div class="stat-grid">
        <div class="stat"><span class="v" style="color:#fb923c">${Courses.streak()}</span><span class="l">Day streak · best ${Store.state.meta.bestStreak || 0}</span></div>
        <div class="stat"><span class="v">${today.lines}</span><span class="l">Lines played today</span></div>
        <div class="stat"><span class="v" style="color:var(--learn)">${learned}</span><span class="l">Lines discovered</span></div>
        <div class="stat"><span class="v" style="color:var(--practice)">${perfected}</span><span class="l">Lines perfected</span></div>
        <div class="stat"><span class="v">${plays}</span><span class="l">Lines played in total</span></div>
      </div>
      <div class="card" style="margin-bottom:22px"><h3 style="margin-bottom:12px">Activity · last 6 months</h3><div style="overflow:auto"><div class="heatmap">${cells.join('')}</div></div></div>
      <div class="card"><h3 style="margin-bottom:8px">Courses</h3>
      ${rows.length ? `<div style="overflow:auto"><table class="tbl"><thead><tr><th>Course</th><th>Progress</th><th>Learned</th><th>Perfected</th><th>Drill best</th><th>Time best</th><th>Puzzles</th></tr></thead><tbody>
        ${rows.map(({ c, st, p }) => `<tr style="cursor:pointer" data-id="${esc(c.id)}"><td><b>${esc(c.name)}</b> <span class="tag ${c.side}">${c.side === 'w' ? 'White' : 'Black'}</span></td>
          <td><div class="bar"><i style="width:${st.total ? st.perfected / st.total * 100 : 0}%;background:var(--practice)"></i><i style="width:${st.total ? (st.learned - st.perfected) / st.total * 100 : 0}%;background:var(--learn)"></i></div></td>
          <td>${st.learned}/${st.total}</td><td>${st.perfected}</td><td>${p.drillBest || 0}</td><td>${p.timeBest || 0}</td><td>${st.puzzles ? `${st.puzzlesSolved}/${st.puzzles}` : '–'}</td></tr>`).join('')}
      </tbody></table></div>` : `<div class="empty"><h3>No courses started yet</h3><p>Pick a course and play your first line.</p><a class="btn primary" href="#/">Browse courses</a></div>`}
      </div></div>`;
    $$('tr[data-id]').forEach(r => r.onclick = () => go('#/course/' + encodeURIComponent(r.dataset.id)));
  };
  Views.stats.title = () => 'Progress';

  /* ======================= Settings ======================= */
  Views.settings = () => {
    const s = Store.settings;
    const sw = (k, label, sub) => `<div class="set-row"><div class="lbl"><b>${label}</b><span>${sub}</span></div><label class="switch"><input type="checkbox" data-sw="${k}" ${s[k] ? 'checked' : ''}><span></span></label></div>`;
    main.innerHTML = `<div class="page">
      <div class="page-head"><div><h1>${Icon('settings')} Settings</h1><div class="sub">Everything is saved automatically on this device.</div></div></div>
      <div class="set-grid"><div>
        <div class="card set-card"><h2>Board & pieces</h2>
          <div class="set-row"><div class="lbl"><b>Piece set</b><span>Bundled lichess sets</span></div></div>
          <div class="piece-sets" style="padding-bottom:14px">${['cburnett', 'merida', 'alpha', 'staunty'].map(p => `<button class="piece-set ${s.pieceSet === p ? 'on' : ''}" data-ps="${p}"><img src="pieces/${p}/wN.svg" alt=""><img src="pieces/${p}/bQ.svg" alt=""><span>${p}</span></button>`).join('')}</div>
          <div class="set-row"><div class="lbl"><b>Board colours</b></div><div class="swatches">${Object.entries(THEMES).map(([k, [l, d]]) => `<button class="board-theme-preview ${s.boardTheme === k ? 'on' : ''}" data-theme="${k}" style="--l:${l};--d:${d}" title="${k}"></button>`).join('')}</div></div>
          <div class="set-row"><div class="lbl"><b>Board size limit</b><span>"fit" fills the screen</span></div><input type="range" min="0" max="1000" step="40" value="${s.boardMax}" data-range="boardMax"><span class="mono" id="v-boardMax">${s.boardMax ? s.boardMax + 'px' : 'fit'}</span></div>
          ${sw('showCoords', 'Coordinates', 'Files and ranks inside the squares')}
          ${sw('showLegal', 'Legal move dots', 'Show where the selected piece can go')}
          ${sw('evalBar', 'Evaluation bar', 'Engine evaluation of each course position (pre-computed)')}
          ${sw('showMaterial', 'Captured pieces', 'Material count above and below the board')}
        </div>
        <div class="card set-card"><h2>Training</h2>
          <div class="set-row"><div class="lbl"><b>Opponent speed</b><span>Pause before the opponent replies</span></div><input type="range" min="0" max="1500" step="50" value="${s.opponentDelay}" data-range="opponentDelay"><span class="mono" id="v-opponentDelay">${s.opponentDelay}ms</span></div>
          <div class="set-row"><div class="lbl"><b>Animation speed</b></div><select class="select" style="width:150px" data-sel="animation">${['off', 'fast', 'normal', 'slow'].map(v => `<option ${s.animation === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          ${sw('learnArrows', 'Move arrows in Learn', 'Draw the move to play as an arrow on the board')}
          ${sw('autoNext', 'Auto-continue', 'Start the next line automatically after finishing one')}
          ${sw('effects', 'Effects', 'Stars and confetti when you finish a line')}
        </div>
        <div class="card set-card"><h2>Sound</h2>
          ${sw('sound', 'Sound effects', 'Moves, captures, checks and feedback')}
          <div class="set-row"><div class="lbl"><b>Volume</b></div><input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-range="volume"><span class="mono" id="v-volume">${Math.round(s.volume * 100)}%</span></div>
        </div>
        <div class="card set-card"><h2>Display</h2>
          <div class="set-row"><div class="lbl"><b>Theme</b></div><div class="seg" id="appearance"><button data-v="dark" class="${s.appearance === 'dark' ? 'on' : ''}">${Icon('moon')} Dark</button><button data-v="light" class="${s.appearance === 'light' ? 'on' : ''}">${Icon('sun')} Light</button></div></div>
          <div class="set-row"><div class="lbl"><b>Text size</b><span>Scales the whole interface</span></div><input type="range" min="80" max="140" step="5" value="${s.uiScale}" data-range="uiScale"><span class="mono" id="v-uiScale">${s.uiScale}%</span></div>
        </div>
        <div class="card set-card"><h2>Your data</h2>
          <div class="set-row"><div class="lbl"><b>Backup</b><span>Progress, your courses and settings in one file</span></div><button class="btn" id="d-export">${Icon('download')} Export</button><label class="btn">${Icon('upload')} Import<input type="file" id="d-import" accept=".json" hidden></label></div>
          <div class="set-row"><div class="lbl"><b>Reset everything</b><span>Deletes all progress and your own courses</span></div><button class="btn danger" id="d-reset">${Icon('trash')} Reset</button></div>
        </div>
      </div>
      <div class="card set-preview"><h3 style="margin-bottom:12px">Preview</h3><div id="prev-board" style="--bs:320px;width:100%;aspect-ratio:1"></div></div>
      </div></div>`;
    const prev = new Board($('#prev-board'), { pieceSet: s.pieceSet, coords: s.showCoords });
    const pc = new Chess(); ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5'].forEach(m => pc.move(m));
    prev.setPosition(pc, false); prev.setMarks({ last: ['d7', 'd5'] }); prev.setArrows([{ from: 'e4', to: 'd5' }]); prev.setBadges([{ sq: 'g5', type: 'ok' }]);
    const save = () => { Store.save(); applySettings(); };
    $$('[data-sw]').forEach(i => i.onchange = () => { s[i.dataset.sw] = i.checked; save(); if (i.dataset.sw === 'showCoords') prev.setCoords(s.showCoords); });
    $$('[data-ps]').forEach(b => b.onclick = () => { s.pieceSet = b.dataset.ps; $$('[data-ps]').forEach(x => x.classList.toggle('on', x === b)); prev.setPieceSet(s.pieceSet); save(); });
    $$('[data-theme]').forEach(b => b.onclick = () => { s.boardTheme = b.dataset.theme; $$('[data-theme]').forEach(x => x.classList.toggle('on', x === b)); save(); });
    $$('[data-range]').forEach(r => r.oninput = () => {
      const k = r.dataset.range, v = +r.value; s[k] = v;
      $('#v-' + k).textContent = k === 'volume' ? Math.round(v * 100) + '%' : k === 'uiScale' ? v + '%' : k === 'boardMax' ? (v ? v + 'px' : 'fit') : v + 'ms';
      save();
      if (k === 'volume') Sound.play('move');
    });
    $$('[data-sel]').forEach(sel => sel.onchange = () => { s[sel.dataset.sel] = sel.value; save(); });
    $$('#appearance button').forEach(b => b.onclick = () => { s.appearance = b.dataset.v; $$('#appearance button').forEach(x => x.classList.toggle('on', x === b)); save(); });
    $('#d-export').onclick = () => download(`openings-local-backup-${Store.todayKey()}.json`, Store.exportJson(), 'application/json');
    $('#d-import').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { Store.importJson(await f.text()); applySettings(); toast('Backup restored', 'ok'); route(); } catch (err) { toast('Could not read that file: ' + err.message, 'err'); }
    };
    $('#d-reset').onclick = async () => { if (await confirmDlg('Reset everything?', 'All progress and your own courses will be deleted. Export a backup first if you might want them back.', 'Reset everything')) { Store.reset(); applySettings(); toast('Everything was reset'); go('#/'); } };
  };
  Views.settings.title = () => 'Settings';

  /* ======================= boot ======================= */
  function boot() {
    $$('[data-icon]').forEach(el => el.insertAdjacentHTML('afterbegin', Icon(el.dataset.icon)));
    applySettings();
    Sound.preload();
    $('#theme-toggle').onclick = () => { Store.settings.appearance = Store.settings.appearance === 'dark' ? 'light' : 'dark'; Store.save(); applySettings(); };
    route();
    // sw.js exists only in the GitHub Pages build (tools/build-web.js); the extension and the Android WebView serve app/ directly.
    if ('serviceWorker' in navigator && isSecureContext && /^https?:$/.test(location.protocol) && location.hostname !== 'appassets.androidplatform.net') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  return { boot, toast, modal, confirm: confirmDlg, download, copy, go, applySettings, updateStreak, DB, detectOpening };
})();
document.addEventListener('DOMContentLoaded', () => App.boot());
