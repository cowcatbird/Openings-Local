/* Openings Local — main application */
(() => {
  'use strict';

  /* ======================= helpers ======================= */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dayKey = Store.todayKey;
  const colorName = c => c === 'w' ? 'White' : 'Black';
  const colorBadge = c => `<span class="badge ${c}">${c === 'w' ? '♔ White' : '♚ Black'}</span>`;
  const pips = lvl => `<span class="pips lvl-${lvl}" title="${SRS.LEVELS[lvl]}">${[0, 1, 2, 3, 4].map(i => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</span>`;
  const movesPreview = (moves, max = 14) => PGN.format(moves.slice(0, max)) + (moves.length > max ? ' …' : '');
  const plural = (n, s, p) => `${n} ${n === 1 ? s : (p || s + 's')}`;

  const toastsEl = document.createElement('div'); toastsEl.className = 'toasts'; document.body.appendChild(toastsEl);
  function toast(msg, type = '') {
    const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg;
    toastsEl.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 240); }, 2600);
  }

  function modal({ title, body, buttons, wide }) {
    return new Promise(resolve => {
      const back = document.createElement('div'); back.className = 'modal-back';
      back.innerHTML = `<div class="modal" ${wide ? 'style="width:min(760px,94vw)"' : ''}><h2>${esc(title)}</h2><div class="modal-body">${body}</div><div class="btn-row"></div></div>`;
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
    });
  }
  const confirmDlg = (title, text, okLabel = 'Confirm', cls = 'danger') => modal({ title, body: `<p>${text}</p>`, buttons: [{ label: 'Cancel', value: null }, { label: okLabel, value: true, cls }] });
  const promptDlg = (title, value = '', label = 'Name') => modal({
    title, body: `<div class="field"><label>${esc(label)}</label><input class="input" id="prompt-input" value="${esc(value)}"></div>`,
    buttons: [{ label: 'Cancel', value: null }, { label: 'Save', cls: 'primary', value: back => $('#prompt-input', back).value.trim() }],
  });

  let openMenu = null;
  function contextMenu(x, y, items) {
    closeMenu();
    const m = document.createElement('div'); m.className = 'menu';
    items.forEach(it => {
      const b = document.createElement('button'); b.textContent = it.label; if (it.danger) b.classList.add('danger');
      b.onclick = () => { closeMenu(); it.action(); }; m.appendChild(b);
    });
    document.body.appendChild(m);
    const r = m.getBoundingClientRect();
    m.style.left = Math.min(x, window.innerWidth - r.width - 8) + 'px';
    m.style.top = Math.min(y, window.innerHeight - r.height - 8) + 'px';
    openMenu = m;
    setTimeout(() => document.addEventListener('mousedown', onDocDown), 0);
  }
  function onDocDown(e) { if (openMenu && !openMenu.contains(e.target)) closeMenu(); }
  function closeMenu() { if (openMenu) { openMenu.remove(); openMenu = null; document.removeEventListener('mousedown', onDocDown); } }

  function download(filename, text, type = 'text/plain') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ======================= opening database ======================= */
  const DB = (window.OPENINGS_DB || []).map((o, i) => {
    const name = o[1];
    const ci = name.indexOf(':');
    const family = ci < 0 ? name.trim() : name.slice(0, ci).trim();
    const rest = ci < 0 ? '' : name.slice(ci + 1).trim();
    const sub = rest ? rest.split(',')[0].trim() : 'Main line';
    const moves = o[2].split(' ');
    return { i, eco: o[0], name, family, sub, rest, moves, key: o[2], gambit: /gambit/i.test(name) && !/declined/i.test(name), search: (o[0] + ' ' + name + ' ' + o[2]).toLowerCase() };
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

  // Longest-prefix match in the database for a sequence of moves
  function detectOpening(moves) {
    for (let n = Math.min(moves.length, 40); n >= 1; n--) {
      const d = DB_BY_KEY.get(moves.slice(0, n).join(' '));
      if (d) return d;
    }
    return null;
  }

  /* ======================= repertoire lines ======================= */
  const Lines = {
    all() { return Object.values(Store.state.lines); },
    get(id) { return Store.state.lines[id]; },
    byColor(c) { return this.all().filter(l => l.color === c); },
    find(color, moves) { const k = moves.join(' '); return this.all().find(l => l.color === color && l.moves.join(' ') === k); },
    add({ name, eco, color, moves, source = 'custom' }) {
      const existing = this.find(color, moves);
      if (existing) return { line: existing, existed: true };
      const det = detectOpening(moves);
      const line = {
        id: uid(), name: name || (det ? det.name : 'Custom line'), eco: eco || (det ? det.eco : ''),
        family: det ? det.family : 'Custom', color, moves: [...moves], source, created: Date.now(),
        srs: SRS.create(), stats: { attempts: 0, mistakes: 0, lastMistakes: 0, lastHints: 0 },
      };
      Store.state.lines[line.id] = line;
      Store.save();
      return { line, existed: false };
    },
    remove(id) { delete Store.state.lines[id]; Store.save(); },
    update(id, patch) { Object.assign(Store.state.lines[id], patch); Store.save(); },
    due(now = Date.now()) { return this.all().filter(l => SRS.isDue(l.srs, now)).sort((a, b) => a.srs.due - b.srs.due); },
    fresh() { return this.all().filter(l => SRS.isNew(l.srs)).sort((a, b) => a.created - b.created); },
    mistakes() { return this.all().filter(l => l.stats.lastMistakes > 0); },
  };

  function todayHist() {
    const h = Store.state.history;
    const k = dayKey();
    if (!h[k]) h[k] = { reps: 0, clean: 0, mistakes: 0, learned: 0 };
    return h[k];
  }
  function newAllowance() { return Math.max(0, Store.settings.newPerDay - todayHist().learned); }
  function streak() {
    const h = Store.state.history;
    let n = 0; const d = new Date();
    if (!(h[dayKey(d)] && h[dayKey(d)].reps > 0)) d.setDate(d.getDate() - 1);
    while (h[dayKey(d)] && h[dayKey(d)].reps > 0) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  /* ======================= starter packs ======================= */
  const PACKS = [
    { id: 'e4w', name: 'Classical 1.e4 for White', ico: '♔', color: 'w', desc: 'Italian, Ruy Lopez, Scotch and Vienna main lines.', prefixes: ['Italian Game: Giuoco Piano', 'Italian Game: Two Knights', 'Ruy Lopez: Morphy Defense', 'Ruy Lopez: Berlin', 'Scotch Game', 'Vienna Game'], per: 4 },
    { id: 'd4w', name: 'Solid 1.d4 for White', ico: '♕', color: 'w', desc: "Queen's Gambit, London System, Catalan and Slav.", prefixes: ["Queen's Gambit Declined", "Queen's Gambit Accepted", 'Queen\'s Pawn Game: London System', 'Catalan Opening', 'Slav Defense'], per: 4 },
    { id: 'e4b', name: 'Black vs 1.e4', ico: '♚', color: 'b', desc: 'Sicilian Najdorf, Caro-Kann, French, Scandinavian and Petrov.', prefixes: ['Sicilian Defense: Najdorf', 'Caro-Kann Defense', 'French Defense', 'Scandinavian Defense', "Petrov's Defense"], per: 4 },
    { id: 'd4b', name: 'Black vs 1.d4', ico: '♛', color: 'b', desc: "King's Indian, Nimzo-Indian, Queen's Indian, Grünfeld and Dutch.", prefixes: ["King's Indian Defense", 'Nimzo-Indian Defense', "Queen's Indian Defense", 'Grünfeld Defense', 'Dutch Defense'], per: 4 },
    { id: 'gamw', name: 'Gambit attack pack', ico: '⚔', color: 'w', desc: "King's Gambit, Evans, Danish, Göring, Smith-Morra, Blackmar-Diemer.", prefixes: ["King's Gambit Accepted", 'Evans Gambit', 'Danish Gambit', 'Göring Gambit', 'Smith-Morra', 'Blackmar-Diemer Gambit', 'Vienna Gambit'], per: 3 },
    { id: 'gamb', name: 'Gambits for Black', ico: '🗡', color: 'b', desc: 'Latvian, Elephant, Englund, Budapest, Benko, Albin and Stafford.', prefixes: ['Latvian Gambit', 'Elephant Gambit', 'Englund Gambit', 'Budapest Defense', 'Benko Gambit', 'Albin Countergambit', 'Stafford Gambit'], per: 3 },
  ];
  function packItems(pack) {
    const out = [];
    for (const p of pack.prefixes) {
      const items = DB.filter(d => d.name.includes(p)).sort((a, b) => (a.rest.split(',').length - b.rest.split(',').length) || (a.moves.length - b.moves.length)).slice(0, pack.per);
      out.push(...items);
    }
    return [...new Set(out)];
  }
  function addPack(pack) {
    let added = 0;
    for (const d of packItems(pack)) { const r = Lines.add({ name: d.name, eco: d.eco, color: pack.color, moves: d.moves, source: 'library' }); if (!r.existed) added++; }
    toast(`Added ${plural(added, 'line')} from "${pack.name}"`, 'ok');
    updateNav();
  }

  /* ======================= board factory ======================= */
  function makeBoard(container, opts) {
    const s = Store.settings;
    const b = new Board(container, { pieceSet: s.pieceSet, theme: s.boardTheme, coords: s.showCoords, ...opts });
    return b;
  }
  function animMs() { return { off: 0, fast: 90, normal: 180, slow: 320 }[Store.settings.animation] ?? 180; }
  function applySettingsToDom() {
    const s = Store.settings;
    document.documentElement.dataset.appearance = s.appearance;
    document.documentElement.style.setProperty('--scale', s.uiScale / 100);
    document.documentElement.style.setProperty('--anim', animMs() + 'ms');
    document.documentElement.style.setProperty('--board-size', s.boardSize + 'px');
  }

  /* ======================= router ======================= */
  const main = $('#main');
  let current = { view: null, cleanup: null };
  function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    const view = parts[0] || 'dashboard';
    if (current.cleanup) { try { current.cleanup(); } catch (e) { console.error(e); } }
    current = { view, cleanup: null };
    closeMenu();
    $$('.nav a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
    main.scrollTop = 0;
    const fn = Views[view] || Views.dashboard;
    const cleanup = fn(parts.slice(1));
    if (typeof cleanup === 'function') current.cleanup = cleanup;
    updateNav();
  }
  const go = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };
  window.addEventListener('hashchange', route);

  function updateNav() {
    const due = Lines.due().length + Math.min(newAllowance(), Lines.fresh().length);
    const b = $('#nav-due');
    if (b) { b.textContent = due; b.style.display = due ? '' : 'none'; }
  }

  /* ======================= Views ======================= */
  const Views = {};

  /* ---------- Dashboard ---------- */
  Views.dashboard = () => {
    const lines = Lines.all();
    const due = Lines.due();
    const fresh = Lines.fresh();
    const newN = Math.min(newAllowance(), fresh.length);
    const mist = Lines.mistakes();
    const th = todayHist();
    const st = streak();
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const mastered = lines.filter(l => l.srs.level >= 5).length;

    const empty = lines.length === 0;
    main.innerHTML = `
      <div class="view">
        <div class="view-head">
          <div><h1>${greet} ♟</h1><div class="sub">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · ${plural(lines.length, 'line')} in your repertoire</div></div>
          <div class="btn-row">
            <a class="btn" href="#/library">📚 Browse library</a>
            <a class="btn" href="#/import">＋ Add opening</a>
          </div>
        </div>

        ${empty ? `
        <div class="card onboard" style="margin-bottom:24px">
          <h2>Welcome to Openings Local</h2>
          <p class="muted" style="margin:8px 0 16px;font-size:1.05rem">Build a repertoire from <b>${DB.length.toLocaleString()}</b> built-in openings and gambits, then drill them with spaced repetition. Everything stays on this computer.</p>
          <div class="btn-row">
            <a class="btn primary lg" href="#/library">Open the library</a>
            <a class="btn lg" href="#/import">Import a PGN</a>
            <a class="btn lg" href="#/explore">Build on the board</a>
          </div>
        </div>` : ''}

        <div class="grid cols-4" style="margin-bottom:24px">
          <div class="card stat"><span class="num accent">${due.length + newN}</span><span class="lbl">Reps due now</span></div>
          <div class="card stat"><span class="num blue">${th.reps}</span><span class="lbl">Reps done today</span></div>
          <div class="card stat"><span class="num warn streak"><span class="flame">${st > 0 ? '🔥' : '🕯'}</span>${st}</span><span class="lbl">Day streak${Store.state.meta.bestStreak > st ? ` · best ${Store.state.meta.bestStreak}` : ''}</span></div>
          <div class="card stat"><span class="num purple">${mastered}</span><span class="lbl">Lines mastered</span></div>
        </div>

        <div class="mode-grid" style="margin-bottom:28px">
          <button class="mode-card primary" data-mode="due" ${due.length + newN ? '' : 'disabled'}><span class="ico">⚡</span><b>Start reps</b><span>${due.length ? plural(due.length, 'review') : 'No reviews'}${newN ? ` + ${newN} new` : ''}</span></button>
          <button class="mode-card" data-mode="new" ${fresh.length ? '' : 'disabled'}><span class="ico">🌱</span><b>Learn new lines</b><span>${plural(fresh.length, 'unseen line')}</span></button>
          <button class="mode-card" data-mode="mistakes" ${mist.length ? '' : 'disabled'}><span class="ico">🎯</span><b>Fix mistakes</b><span>${plural(mist.length, 'line')} with recent errors</span></button>
          <button class="mode-card" data-mode="random" ${lines.length ? '' : 'disabled'}><span class="ico">🎲</span><b>Random drill</b><span>10 random lines, any colour</span></button>
        </div>

        <div class="grid cols-2">
          <div class="card">
            <div class="panel-title"><h3>Activity</h3><span class="muted small">last 20 weeks</span></div>
            ${heatmapHtml()}
          </div>
          <div class="card">
            <div class="panel-title"><h3>Mastery</h3><a class="small" href="#/stats">All stats →</a></div>
            ${masteryBars(lines)}
          </div>
        </div>

        ${lines.length < 8 ? `
        <h2 style="margin:30px 0 14px">Starter packs</h2>
        <div class="grid auto">${PACKS.map(p => `
          <div class="card hover pack"><div style="font-size:1.8rem">${p.ico}</div><h3>${esc(p.name)} ${colorBadge(p.color)}</h3><span class="muted">${esc(p.desc)}</span><span class="faint small">${packItems(p).length} lines</span><button class="btn sm" data-pack="${p.id}">Add pack</button></div>`).join('')}
        </div>` : ''}

        ${due.length ? `<h2 style="margin:30px 0 14px">Up next</h2><div class="row-list">${due.slice(0, 6).map(l => lineRow(l, { rep: true })).join('')}</div>` : ''}
      </div>`;

    $$('[data-mode]', main).forEach(b => b.onclick = () => Trainer.startMode(b.dataset.mode));
    $$('[data-pack]', main).forEach(b => b.onclick = () => { addPack(PACKS.find(p => p.id === b.dataset.pack)); route(); });
    bindLineRows(main);
  };

  function heatmapHtml() {
    const h = Store.state.history;
    const cells = [];
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const end = new Date(d);
    const start = new Date(d); start.setDate(start.getDate() - (7 * 20 - 1) - end.getDay());
    for (let x = new Date(start); x <= end; x.setDate(x.getDate() + 1)) {
      const k = dayKey(x); const r = h[k] ? h[k].reps : 0;
      const lvl = r === 0 ? 0 : r < 5 ? 1 : r < 15 ? 2 : r < 30 ? 3 : 4;
      cells.push(`<i class="l${lvl}" title="${k}: ${plural(r, 'rep')}"></i>`);
    }
    return `<div style="overflow:auto"><div class="heatmap">${cells.join('')}</div></div>`;
  }
  function masteryBars(lines) {
    if (!lines.length) return `<p class="muted">Add some lines to see your progress.</p>`;
    const counts = [0, 0, 0, 0, 0, 0];
    lines.forEach(l => counts[l.srs.level]++);
    return counts.map((n, i) => `<div class="hbar"><span>${SRS.LEVELS[i]}</span><div class="progress"><i style="width:${(n / lines.length * 100).toFixed(1)}%"></i></div><span class="n">${n}</span></div>`).reverse().join('');
  }

  function lineRow(l, opts = {}) {
    const dueLbl = SRS.dueLabel(l.srs);
    const dueCls = SRS.isNew(l.srs) ? 'blue' : SRS.isDue(l.srs) ? 'accent' : '';
    return `<div class="line-row" data-id="${l.id}">
      <div class="main">
        <div class="title">${esc(l.name)} ${colorBadge(l.color)} ${l.eco ? `<span class="badge">${esc(l.eco)}</span>` : ''}</div>
        <div class="moves">${esc(movesPreview(l.moves))}</div>
        <div class="meta">${pips(l.srs.level)} <span>${SRS.LEVELS[l.srs.level]}</span> · <span class="badge ${dueCls}">${dueLbl}</span>${l.stats.lastMistakes ? ` · <span class="badge danger">${plural(l.stats.lastMistakes, 'mistake')} last time</span>` : ''}${l.srs.reps ? ` · ${plural(l.srs.reps, 'rep')}` : ''}</div>
      </div>
      <div class="actions">
        <button class="btn sm primary" data-act="drill">▶ Drill</button>
        <button class="btn sm" data-act="explore" title="Explore">🔍</button>
        ${opts.rep ? '' : '<button class="btn sm icon" data-act="menu" title="More">⋯</button>'}
      </div>
    </div>`;
  }
  function bindLineRows(root) {
    $$('.line-row [data-act]', root).forEach(b => b.onclick = (e) => {
      const id = b.closest('.line-row').dataset.id; const l = Lines.get(id); if (!l) return;
      const act = b.dataset.act;
      if (act === 'drill') Trainer.startLine(id);
      else if (act === 'explore') go(`#/explore/line/${id}`);
      else if (act === 'menu') lineMenu(e, l);
    });
  }
  function lineMenu(e, l) {
    contextMenu(e.clientX, e.clientY, [
      { label: '✏️ Rename', action: async () => { const n = await promptDlg('Rename line', l.name); if (n) { Lines.update(l.id, { name: n }); route(); } } },
      { label: '♟ Edit moves on board', action: () => go(`#/explore/edit/${l.id}`) },
      { label: '⇄ Switch to ' + colorName(l.color === 'w' ? 'b' : 'w'), action: () => { if (Lines.find(l.color === 'w' ? 'b' : 'w', l.moves)) return toast('That line already exists for the other colour', 'err'); Lines.update(l.id, { color: l.color === 'w' ? 'b' : 'w' }); route(); } },
      { label: '↺ Reset progress', action: async () => { if (await confirmDlg('Reset progress', `Reset all scheduling for "${esc(l.name)}"?`, 'Reset')) { Lines.update(l.id, { srs: SRS.create(), stats: { attempts: 0, mistakes: 0, lastMistakes: 0, lastHints: 0 } }); route(); } } },
      { label: '🗑 Remove from repertoire', danger: true, action: async () => { if (await confirmDlg('Remove line', `Remove "${esc(l.name)}" (${colorName(l.color)}) from your repertoire?`, 'Remove')) { Lines.remove(l.id); toast('Line removed'); route(); } } },
    ]);
  }

  /* ---------- Library ---------- */
  const libState = { q: '', first: 'all', gambit: false, eco: 'all' };
  Views.library = (parts) => {
    if (parts[0]) return familyView(parts[0]);
    main.innerHTML = `
      <div class="view">
        <div class="view-head"><div><h1>Opening library</h1><div class="sub">${DB.length.toLocaleString()} named openings and variations in ${FAMILIES.length} families · ${DB.filter(d => d.gambit).length.toLocaleString()} gambits</div></div></div>
        <div class="toolbar">
          <div class="search-wrap"><input class="input" id="lib-q" placeholder="Search openings, ECO codes or moves (e.g. Najdorf, B90, e4 c5)…" value="${esc(libState.q)}"></div>
        </div>
        <div class="toolbar">
          <div class="chips" id="lib-first">${[['all', 'All'], ['e4', '1. e4'], ['d4', '1. d4'], ['c4', '1. c4'], ['Nf3', '1. Nf3'], ['other', 'Other']].map(([v, t]) => `<button class="chip ${libState.first === v ? 'active' : ''}" data-v="${v}">${t}</button>`).join('')}</div>
          <div class="chips" id="lib-eco">${['all', 'A', 'B', 'C', 'D', 'E'].map(v => `<button class="chip ${libState.eco === v ? 'active' : ''}" data-v="${v}">${v === 'all' ? 'Any ECO' : 'ECO ' + v}</button>`).join('')}</div>
          <button class="chip ${libState.gambit ? 'active' : ''}" id="lib-gambit">⚔ Gambits only</button>
        </div>
        <div id="lib-body"></div>
      </div>`;
    const body = $('#lib-body');
    const render = () => {
      const q = libState.q.trim().toLowerCase();
      const matchesFilter = d => (libState.first === 'all' || (libState.first === 'other' ? !['e4', 'd4', 'c4', 'Nf3'].includes(d.moves[0]) : d.moves[0] === libState.first))
        && (libState.eco === 'all' || d.eco[0] === libState.eco) && (!libState.gambit || d.gambit);
      if (q) {
        const terms = q.split(/\s+/);
        const res = DB.filter(d => matchesFilter(d) && terms.every(t => d.search.includes(t)));
        body.innerHTML = `<p class="muted" style="margin-bottom:12px">${res.length.toLocaleString()} result${res.length === 1 ? '' : 's'}${res.length > 200 ? ' (showing first 200)' : ''}</p><div class="row-list">${res.slice(0, 200).map(dbRow).join('') || '<div class="empty"><div class="big">🔍</div>No openings match.</div>'}</div>`;
        bindDbRows(body);
        return;
      }
      const fams = FAMILIES.map(f => ({ f, items: f.items.filter(matchesFilter) })).filter(x => x.items.length);
      const rep = Lines.all();
      body.innerHTML = `<div class="grid auto">${fams.map(({ f, items }) => {
        const inRep = rep.filter(l => l.family === f.name).length;
        return `<div class="card hover clickable" data-family="${esc(f.name)}">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><h3>${esc(f.name)}</h3><span class="badge">${f.ecoMin === f.ecoMax ? f.ecoMin : f.ecoMin + '–' + f.ecoMax}</span></div>
          <div class="muted mono small" style="margin-bottom:10px">${esc(movesPreview(items[0].moves, 8))}</div>
          <div class="btn-row"><span class="badge">${plural(items.length, 'variation')}</span>${f.gambits ? `<span class="badge warn">⚔ ${f.gambits} gambit${f.gambits > 1 ? 's' : ''}</span>` : ''}${inRep ? `<span class="badge accent">✓ ${inRep} in repertoire</span>` : ''}</div>
        </div>`;
      }).join('')}</div>`;
      $$('[data-family]', body).forEach(c => c.onclick = () => go('#/library/' + encodeURIComponent(c.dataset.family)));
    };
    $('#lib-q').oninput = e => { libState.q = e.target.value; render(); };
    $$('#lib-first .chip').forEach(c => c.onclick = () => { libState.first = c.dataset.v; $$('#lib-first .chip').forEach(x => x.classList.toggle('active', x === c)); render(); });
    $$('#lib-eco .chip').forEach(c => c.onclick = () => { libState.eco = c.dataset.v; $$('#lib-eco .chip').forEach(x => x.classList.toggle('active', x === c)); render(); });
    $('#lib-gambit').onclick = () => { libState.gambit = !libState.gambit; $('#lib-gambit').classList.toggle('active', libState.gambit); render(); };
    render();
    setTimeout(() => $('#lib-q') && $('#lib-q').focus(), 50);
  };

  function dbRow(d, shortName) {
    const inW = Lines.find('w', d.moves), inB = Lines.find('b', d.moves);
    const name = shortName ? (d.rest || d.name) : d.name;
    return `<div class="line-row ${inW || inB ? 'in-rep' : ''}" data-db="${d.i}">
      <div class="main"><div class="title"><span class="badge">${d.eco}</span> ${esc(name)} ${d.gambit ? '<span class="badge warn">⚔</span>' : ''}</div><div class="moves">${esc(PGN.format(d.moves))}</div></div>
      <div class="actions">
        <button class="btn sm" data-act="explore">🔍 Explore</button>
        <button class="btn sm ${inW ? 'on' : ''}" data-act="w" title="${inW ? 'Remove from White repertoire' : 'Add to White repertoire'}">${inW ? '✓' : '+'} White</button>
        <button class="btn sm ${inB ? 'on' : ''}" data-act="b" title="${inB ? 'Remove from Black repertoire' : 'Add to Black repertoire'}">${inB ? '✓' : '+'} Black</button>
      </div></div>`;
  }
  function bindDbRows(root) {
    $$('.line-row[data-db] [data-act]', root).forEach(b => b.onclick = () => {
      const row = b.closest('.line-row'); const d = DB[+row.dataset.db];
      if (b.dataset.act === 'explore') return go(`#/explore/db/${d.i}`);
      toggleDb(d, b.dataset.act);
      const fresh = document.createElement('div'); fresh.innerHTML = dbRow(d, row.dataset.short === '1');
      const nr = fresh.firstElementChild; if (row.dataset.short) nr.dataset.short = row.dataset.short;
      row.replaceWith(nr); bindDbRows(nr.parentElement || nr);
    });
  }
  function toggleDb(d, color) {
    const ex = Lines.find(color, d.moves);
    if (ex) { Lines.remove(ex.id); toast(`Removed from ${colorName(color)} repertoire`); }
    else { Lines.add({ name: d.name, eco: d.eco, color, moves: d.moves, source: 'library' }); toast(`Added to ${colorName(color)} repertoire`, 'ok'); Sound.play('confirm'); }
    updateNav();
  }

  function familyView(name) {
    const f = FAMILIES.find(x => x.name === name);
    if (!f) { go('#/library'); return; }
    const subs = new Map();
    for (const d of f.items) { if (!subs.has(d.sub)) subs.set(d.sub, []); subs.get(d.sub).push(d); }
    const subArr = [...subs.entries()].sort((a, b) => (a[0] === 'Main line' ? -1 : b[0] === 'Main line' ? 1 : b[1].length - a[1].length || a[0].localeCompare(b[0])));
    main.innerHTML = `
      <div class="view">
        <a class="btn ghost sm" href="#/library">← All openings</a>
        <div class="view-head" style="margin-top:10px">
          <div><h1>${esc(f.name)}</h1><div class="sub">ECO ${f.ecoMin === f.ecoMax ? f.ecoMin : f.ecoMin + '–' + f.ecoMax} · ${plural(f.items.length, 'variation')} · starts ${esc(movesPreview(f.items[0].moves, 6))}</div></div>
          <div class="btn-row">
            <button class="btn" id="fam-explore">🔍 Explore</button>
            <button class="btn" id="fam-all-w">+ All as White</button>
            <button class="btn" id="fam-all-b">+ All as Black</button>
          </div>
        </div>
        <div class="toolbar"><div class="search-wrap"><input class="input" id="fam-q" placeholder="Filter variations…"></div></div>
        <div id="fam-body">${subArr.map(([sub, items]) => `
          <div class="group ${subArr.length > 6 && items.length > 12 ? 'collapsed' : ''}">
            <div class="group-head"><span class="caret">▾</span>${esc(sub)} <span class="count">${items.length}</span></div>
            <div class="group-body row-list">${items.map(d => dbRow(d, true).replace('<div class="line-row', '<div data-short="1" class="line-row')).join('')}</div>
          </div>`).join('')}
        </div>
      </div>`;
    $$('.group-head', main).forEach(h => h.onclick = () => h.parentElement.classList.toggle('collapsed'));
    bindDbRows(main);
    $('#fam-explore').onclick = () => go(`#/explore/db/${f.items[0].i}`);
    const addAll = async color => {
      if (!await confirmDlg(`Add ${f.items.length} lines`, `Add every ${esc(f.name)} variation (${f.items.length} lines) to your ${colorName(color)} repertoire? You can remove lines later.`, 'Add all', 'primary')) return;
      let n = 0; for (const d of f.items) if (!Lines.add({ name: d.name, eco: d.eco, color, moves: d.moves, source: 'library' }).existed) n++;
      toast(`Added ${plural(n, 'line')}`, 'ok'); updateNav(); familyView(name);
    };
    $('#fam-all-w').onclick = () => addAll('w');
    $('#fam-all-b').onclick = () => addAll('b');
    $('#fam-q').oninput = e => {
      const q = e.target.value.trim().toLowerCase();
      $$('#fam-body .line-row').forEach(r => { r.style.display = !q || DB[+r.dataset.db].search.includes(q) ? '' : 'none'; });
      $$('#fam-body .group').forEach(g => { const vis = $$('.line-row', g).some(r => r.style.display !== 'none'); g.style.display = vis ? '' : 'none'; if (q) g.classList.remove('collapsed'); });
    };
  }

  /* ---------- Repertoire ---------- */
  const repState = { tab: 'w', q: '', sort: 'family' };
  Views.repertoire = () => {
    const all = Lines.all();
    main.innerHTML = `
      <div class="view">
        <div class="view-head">
          <div><h1>My repertoire</h1><div class="sub">${plural(all.length, 'line')} · ${all.filter(l => l.color === 'w').length} White · ${all.filter(l => l.color === 'b').length} Black</div></div>
          <div class="btn-row">
            <button class="btn primary" id="rep-train">▶ Train all ${repState.tab === 'all' ? '' : colorName(repState.tab)}</button>
            <button class="btn" id="rep-export">⬇ Export PGN</button>
            <a class="btn" href="#/import">＋ Add</a>
          </div>
        </div>
        <div class="toolbar">
          <div class="tabs" id="rep-tabs">${[['w', '♔ White'], ['b', '♚ Black'], ['all', 'All']].map(([v, t]) => `<button class="${repState.tab === v ? 'active' : ''}" data-v="${v}">${t}</button>`).join('')}</div>
          <div class="search-wrap"><input class="input" id="rep-q" placeholder="Filter lines…" value="${esc(repState.q)}"></div>
          <select class="input" id="rep-sort" style="width:auto"><option value="family">Group by opening</option><option value="due">Sort by due</option><option value="level">Sort by mastery</option><option value="name">Sort by name</option></select>
        </div>
        <div id="rep-body"></div>
      </div>`;
    $('#rep-sort').value = repState.sort;
    const body = $('#rep-body');
    const render = () => {
      let lines = repState.tab === 'all' ? all : all.filter(l => l.color === repState.tab);
      const q = repState.q.trim().toLowerCase();
      if (q) lines = lines.filter(l => (l.name + ' ' + l.eco + ' ' + l.moves.join(' ')).toLowerCase().includes(q));
      if (!lines.length) { body.innerHTML = `<div class="empty"><div class="big">♟</div><p>No lines here yet.</p><p style="margin-top:12px"><a class="btn primary" href="#/library">Browse the library</a></p></div>`; return; }
      if (repState.sort === 'family') {
        const groups = new Map();
        for (const l of lines) { if (!groups.has(l.family)) groups.set(l.family, []); groups.get(l.family).push(l); }
        body.innerHTML = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([fam, ls]) => {
          const due = ls.filter(l => SRS.isDue(l.srs) || SRS.isNew(l.srs)).length;
          return `<div class="group"><div class="group-head"><span class="caret">▾</span>${esc(fam)} <span class="count">${ls.length}</span>${due ? `<span class="badge accent">${due} due</span>` : ''}<span class="spacer"></span><button class="btn sm" data-fam-train="${esc(fam)}">▶ Drill group</button></div><div class="group-body row-list">${ls.sort((a, b) => a.name.localeCompare(b.name)).map(l => lineRow(l)).join('')}</div></div>`;
        }).join('');
        $$('.group-head', body).forEach(h => h.onclick = e => { if (e.target.closest('button')) return; h.parentElement.classList.toggle('collapsed'); });
        $$('[data-fam-train]', body).forEach(b => b.onclick = () => Trainer.start('group', lines.filter(l => l.family === b.dataset.famTrain).map(l => l.id)));
      } else {
        const sorters = { due: (a, b) => (SRS.isNew(a.srs) ? Infinity : a.srs.due) - (SRS.isNew(b.srs) ? Infinity : b.srs.due), level: (a, b) => a.srs.level - b.srs.level || a.name.localeCompare(b.name), name: (a, b) => a.name.localeCompare(b.name) };
        body.innerHTML = `<div class="row-list">${[...lines].sort(sorters[repState.sort]).map(l => lineRow(l)).join('')}</div>`;
      }
      bindLineRows(body);
    };
    $$('#rep-tabs button').forEach(b => b.onclick = () => { repState.tab = b.dataset.v; Views.repertoire(); });
    $('#rep-q').oninput = e => { repState.q = e.target.value; render(); };
    $('#rep-sort').onchange = e => { repState.sort = e.target.value; render(); };
    $('#rep-train').onclick = () => { const ids = (repState.tab === 'all' ? all : all.filter(l => l.color === repState.tab)).map(l => l.id); if (!ids.length) return toast('No lines to train', 'err'); Trainer.start('all', ids); };
    $('#rep-export').onclick = () => { const ls = repState.tab === 'all' ? all : all.filter(l => l.color === repState.tab); if (!ls.length) return toast('Nothing to export', 'err'); download(`repertoire-${repState.tab}.pgn`, PGN.exportLines(ls)); toast('PGN exported', 'ok'); };
    render();
  };

  /* ---------- Train ---------- */
  Views.train = (parts) => {
    if (parts[0] === 'session' && Trainer.session) return Trainer.renderSession();
    const due = Lines.due(), fresh = Lines.fresh(), mist = Lines.mistakes(), all = Lines.all();
    const newN = Math.min(newAllowance(), fresh.length);
    main.innerHTML = `
      <div class="view">
        <div class="view-head"><div><h1>Train</h1><div class="sub">Pick a drill. Your side's moves are tested, the opponent's moves play automatically.</div></div></div>
        <div class="mode-grid">
          <button class="mode-card primary" data-mode="due" ${due.length + newN ? '' : 'disabled'}><span class="ico">⚡</span><b>Reps due</b><span>${plural(due.length, 'review')}${newN ? ` + ${newN} new` : ''}</span></button>
          <button class="mode-card" data-mode="new" ${fresh.length ? '' : 'disabled'}><span class="ico">🌱</span><b>Learn new lines</b><span>${plural(fresh.length, 'line')} you have not drilled yet</span></button>
          <button class="mode-card" data-mode="mistakes" ${mist.length ? '' : 'disabled'}><span class="ico">🎯</span><b>Fix mistakes</b><span>${plural(mist.length, 'line')} with errors last time</span></button>
          <button class="mode-card" data-mode="white" ${all.some(l => l.color === 'w') ? '' : 'disabled'}><span class="ico">♔</span><b>All White lines</b><span>${plural(all.filter(l => l.color === 'w').length, 'line')}</span></button>
          <button class="mode-card" data-mode="black" ${all.some(l => l.color === 'b') ? '' : 'disabled'}><span class="ico">♚</span><b>All Black lines</b><span>${plural(all.filter(l => l.color === 'b').length, 'line')}</span></button>
          <button class="mode-card" data-mode="random" ${all.length ? '' : 'disabled'}><span class="ico">🎲</span><b>Random 10</b><span>A quick mixed session</span></button>
          <button class="mode-card" data-mode="weak" ${all.some(l => l.srs.reps > 0) ? '' : 'disabled'}><span class="ico">🧠</span><b>Weakest lines</b><span>Most lapses and lowest mastery</span></button>
        </div>
        ${all.length ? '' : `<div class="empty"><div class="big">📚</div><p>Your repertoire is empty.</p><p style="margin-top:12px"><a class="btn primary" href="#/library">Add openings from the library</a></p></div>`}
        <div class="hint-box" style="margin-top:26px">⌨ Shortcuts during a drill: <span class="kbd">H</span> hint · <span class="kbd">S</span> skip line · <span class="kbd">1</span>–<span class="kbd">4</span> grade · <span class="kbd">Space</span> continue · <span class="kbd">Esc</span> end session</div>
      </div>`;
    $$('[data-mode]', main).forEach(b => b.onclick = () => Trainer.startMode(b.dataset.mode));
  };

  const Trainer = {
    session: null, board: null, chess: null,
    startMode(mode) {
      let ids = [];
      const due = Lines.due(), fresh = Lines.fresh();
      if (mode === 'due') ids = [...due.map(l => l.id), ...fresh.slice(0, newAllowance()).map(l => l.id)];
      else if (mode === 'new') ids = fresh.map(l => l.id);
      else if (mode === 'mistakes') ids = Lines.mistakes().map(l => l.id);
      else if (mode === 'white') ids = Lines.byColor('w').map(l => l.id);
      else if (mode === 'black') ids = Lines.byColor('b').map(l => l.id);
      else if (mode === 'random') ids = Lines.all().sort(() => Math.random() - 0.5).slice(0, 10).map(l => l.id);
      else if (mode === 'weak') ids = Lines.all().filter(l => l.srs.reps > 0).sort((a, b) => b.srs.lapses - a.srs.lapses || a.srs.level - b.srs.level).slice(0, 10).map(l => l.id);
      if (!ids.length) return toast('Nothing to train in that mode', 'err');
      this.start(mode, ids);
    },
    startLine(id) { this.start('line', [id]); },
    start(mode, ids) {
      this.session = { mode, queue: ids, idx: 0, results: [], started: Date.now(), reps: 0, clean: 0, mistakes: 0, done: false };
      go('#/train/session');
    },
    renderSession() {
      const s = this.session;
      main.innerHTML = `
        <div class="view">
          <div class="play-layout">
            <div class="board-col"><div class="board-wrap"><div id="train-board"></div>
              <div class="under-board">
                <div class="session-bar"><div class="queue" id="queue"></div></div>
                <div class="btn-row">
                  <button class="btn sm" id="btn-hint">💡 Hint <span class="kbd">H</span></button>
                  <button class="btn sm" id="btn-skip">Skip <span class="kbd">S</span></button>
                  <button class="btn sm ghost" id="btn-end">End session</button>
                </div>
              </div>
            </div></div>
            <div class="side-col">
              <div class="panel" id="line-panel"></div>
              <div class="status" id="status"><span class="ico">♟</span><span>Loading…</span></div>
              <div class="panel" id="moves-panel"><div class="panel-title"><h3>Moves</h3><span class="muted small" id="phase-lbl"></span></div><div class="movelist" id="movelist"></div></div>
              <div id="result-panel"></div>
            </div>
          </div>
        </div>`;
      this.board = makeBoard($('#train-board'), {
        onMove: (from, to) => this.userMove(from, to),
        legalMoves: sq => this.chess ? this.chess.moves({ square: sq, verbose: true }).map(m => ({ to: m.to, capture: !!m.captured })) : [],
      });
      $('#btn-hint').onclick = () => this.hint();
      $('#btn-skip').onclick = () => this.skip();
      $('#btn-end').onclick = () => this.end();
      const onKey = e => this.onKey(e);
      document.addEventListener('keydown', onKey);
      current.cleanup = () => { document.removeEventListener('keydown', onKey); this.clearTimers(); this.board = null; if (this.session && !this.session.done) this.session = null; };
      if (s.done) return this.renderSummary();
      this.nextLine();
    },
    clearTimers() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } },
    renderQueue() {
      const s = this.session;
      $('#queue').innerHTML = s.queue.map((id, i) => { const r = s.results[i]; return `<i class="${i === s.idx ? 'cur' : r ? (r.mistakes ? 'bad' : 'done') : ''}" title="${esc(Lines.get(id)?.name || '')}"></i>`; }).join('');
    },
    nextLine() {
      const s = this.session;
      this.clearTimers();
      if (s.idx >= s.queue.length) { s.done = true; return this.renderSummary(); }
      const line = Lines.get(s.queue[s.idx]);
      if (!line) { s.idx++; return this.nextLine(); }
      this.line = line;
      this.phase = SRS.isNew(line.srs) && Store.settings.learnFirst && s.mode !== 'practice' ? 'learn' : 'test';
      this.scheduled = s.mode !== 'practice' && (s.mode !== 'line' || SRS.isDue(line.srs) || SRS.isNew(line.srs));
      this.renderQueue();
      $('#result-panel').innerHTML = '';
      this.beginPass();
    },
    beginPass() {
      const line = this.line;
      this.chess = new Chess();
      this.ply = 0; this.mistakes = this.phase === 'learn' ? 0 : (this.mistakes || 0); this.hints = 0; this.wrongTries = 0; this.finished = false;
      if (this.phase === 'test') { this.mistakes = 0; }
      this.board.setArrows([]); this.board.setMarks({ last: [], check: null, hint: [] });
      this.board.setOrientation(line.color, true);
      this.board.setPosition(this.chess, false);
      this.board.setInteractive(null);
      $('#line-panel').innerHTML = `
        <div class="panel-title"><h3>${esc(line.name)}</h3>${colorBadge(line.color)}</div>
        <div class="btn-row" style="margin-bottom:10px">${line.eco ? `<span class="badge">${esc(line.eco)}</span>` : ''}${pips(line.srs.level)}<span class="muted small">${SRS.LEVELS[line.srs.level]}</span>${this.scheduled ? '' : '<span class="badge">Practice · not scheduled</span>'}</div>
        <div class="progress"><i id="line-progress" style="width:0%"></i></div>
        <div class="muted small" style="margin-top:8px"><span id="line-counter">Line ${this.session.idx + 1} of ${this.session.queue.length}</span> · ${plural(line.moves.length, 'move')}</div>`;
      $('#phase-lbl').textContent = this.phase === 'learn' ? 'Guided pass — follow the arrows' : 'From memory';
      this.setStatus(this.phase === 'learn' ? `Guided pass: play the highlighted moves` : `Playing as ${colorName(line.color)}`, 'info', '📖');
      this.renderMoves();
      this.timer = setTimeout(() => this.step(), 500);
    },
    renderMoves() {
      const line = this.line, ply = this.ply;
      const myColor = line.color;
      let html = '<span class="start" data-i="-1">Start</span>';
      line.moves.forEach((san, i) => {
        const mine = (i % 2 === 0 ? 'w' : 'b') === myColor;
        let cls = 'mv';
        let text = san;
        if (i < ply) cls += ' played' + (mine ? ' mine' : '');
        else if (i === ply) { cls += this.phase === 'learn' || !mine ? ' cur' : ' hidden'; if (this.phase === 'test' && mine) text = '?'; }
        else if (this.phase === 'test' && mine) { cls += ' hidden'; text = '?'; }
        else if (this.phase === 'test') { text = '·'; cls += ' hidden'; }
        if (i % 2 === 0) html += `<span class="num">${i / 2 + 1}.</span>`;
        html += `<span class="${cls}">${esc(text)}</span>`;
      });
      $('#movelist').innerHTML = html;
      const p = $('#line-progress'); if (p) p.style.width = (ply / line.moves.length * 100) + '%';
    },
    setStatus(text, cls = '', ico = '') {
      const el = $('#status'); if (!el) return;
      el.className = 'status ' + cls;
      el.innerHTML = `<span class="ico">${ico}</span><span>${text}</span>`;
      el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
    },
    expectedMove() {
      const tmp = new Chess(this.chess.fen());
      return tmp.move(this.line.moves[this.ply], { sloppy: true });
    },
    step() {
      const line = this.line;
      if (this.ply >= line.moves.length) return this.passDone();
      const toMove = this.chess.turn();
      if (toMove !== line.color) {
        this.board.setInteractive(null);
        this.setStatus('Opponent is thinking…', 'think', '🤔');
        this.timer = setTimeout(() => {
          const mv = this.chess.move(line.moves[this.ply], { sloppy: true });
          if (!mv) { toast('This line contains an illegal move and was cut short', 'err'); line.moves = line.moves.slice(0, this.ply); Store.save(); return this.passDone(); }
          this.ply++;
          this.afterMove(mv);
          this.step();
        }, Math.max(80, Store.settings.opponentDelay));
        return;
      }
      this.expected = this.expectedMove();
      if (!this.expected) { toast('This line contains an illegal move and was cut short', 'err'); line.moves = line.moves.slice(0, this.ply); Store.save(); return this.passDone(); }
      this.board.setInteractive(line.color);
      this.renderMoves();
      if (this.phase === 'learn') {
        this.board.setArrows([{ from: this.expected.from, to: this.expected.to }]);
        this.board.setMarks({ hint: [this.expected.from] });
        this.setStatus(`Play <b class="mono">${esc(this.expected.san)}</b>`, 'info', '👉');
      } else {
        this.setStatus('Your move', '', '♟');
      }
    },
    afterMove(mv) {
      this.board.setPosition(this.chess);
      this.board.setArrows([]);
      this.board.setMarks({ last: Store.settings.highlightLast ? [mv.from, mv.to] : [], check: this.chess.in_check() ? kingSquare(this.chess) : null, hint: [] });
      Sound.forMove(mv, this.chess);
      this.renderMoves();
    },
    userMove(from, to) {
      if (!this.expected || this.finished) return false;
      const exp = this.expected;
      const promo = exp.promotion || 'q';
      const probe = new Chess(this.chess.fen());
      const mv = probe.move({ from, to, promotion: promo });
      if (!mv) return false;
      if (mv.from === exp.from && mv.to === exp.to && (mv.promotion || null) === (exp.promotion || null)) {
        this.chess.move({ from, to, promotion: promo });
        this.ply++;
        this.expected = null;
        this.afterMove(mv);
        this.board.flash(to, 'correct');
        this.board.setInteractive(null);
        this.setStatus(this.wrongTries ? 'That\'s it.' : ['Correct!', 'Nice.', 'Yes!', 'Good.', 'Exactly.'][Math.floor(Math.random() * 5)], 'good', '✅');
        this.wrongTries = 0;
        this.timer = setTimeout(() => this.step(), 120);
        return true;
      }
      // wrong move
      this.wrongTries++;
      if (this.phase === 'test') { this.mistakes++; }
      Sound.play('error');
      this.board.shake();
      this.board.flash(to, 'wrong');
      const showHint = this.phase === 'learn' || this.wrongTries >= Math.max(1, Store.settings.hintAfterMistakes);
      if (showHint) {
        this.board.setArrows([{ from: exp.from, to: exp.to, color: 'rgba(248,113,113,0.8)' }]);
        this.board.setMarks({ hint: [exp.from] });
        this.setStatus(`Not in your line. The repertoire move is <b class="mono">${esc(exp.san)}</b>`, 'bad', '✖');
      } else {
        this.setStatus(`<b class="mono">${esc(mv.san)}</b> is not your repertoire move. Try again.`, 'bad', '✖');
      }
      return false;
    },
    hint() {
      if (!this.expected || this.finished) return;
      this.hints++;
      if (this.phase === 'test') this.line.stats.lastHints = (this.line.stats.lastHints || 0) + 1;
      this.board.setArrows([{ from: this.expected.from, to: this.expected.to }]);
      this.board.setMarks({ hint: [this.expected.from] });
      this.setStatus(`Hint: <b class="mono">${esc(this.expected.san)}</b>`, 'info', '💡');
      Sound.play('select');
    },
    passDone() {
      this.board.setInteractive(null);
      this.expected = null;
      if (this.phase === 'learn') {
        this.phase = 'test';
        this.setStatus('Now play the whole line from memory!', 'info', '🧠');
        Sound.play('confirm');
        this.timer = setTimeout(() => this.beginPass(), 1300);
        return;
      }
      this.lineDone();
    },
    lineDone() {
      const line = this.line, s = this.session;
      this.finished = true;
      this.renderMoves();
      const clean = this.mistakes === 0;
      const sug = SRS.suggest(this.mistakes, this.hints, line.srs);
      if (clean && this.hints === 0) { Sound.play('victory'); this.board.glow(); const r = this.board.el.getBoundingClientRect(); Confetti.burst({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); }
      else Sound.play('confirm');
      this.setStatus(clean ? 'Line complete!' : `Line complete with ${plural(this.mistakes, 'mistake')}`, clean ? 'good' : '', clean ? '🏆' : '🏁');
      const names = ['Again', 'Hard', 'Good', 'Easy'];
      const cls = ['again', 'hard', 'good', 'easy'];
      const grades = this.scheduled
        ? `<div class="grade-row">${[0, 1, 2, 3].map(g => `<button class="grade-btn ${cls[g]} ${g === sug ? 'rec' : ''}" data-g="${g}">${names[g]}<small>${SRS.preview(line.srs, g)}</small><small class="kbd">${g + 1}</small></button>`).join('')}</div>
           <p class="muted small" style="text-align:center;margin-top:10px">Suggested: <b>${names[sug]}</b> · press <span class="kbd">Space</span> to accept</p>`
        : `<div class="btn-row" style="justify-content:center;margin-top:14px"><button class="btn primary lg" data-g="-1">Continue <span class="kbd">Space</span></button></div>`;
      $('#result-panel').innerHTML = `<div class="panel result-card"><div class="big">${clean ? (this.hints ? '👍' : '🎉') : this.mistakes === 1 ? '🙂' : '📚'}</div><h2>${clean ? 'Perfect run' : 'Keep at it'}</h2><p class="muted">${plural(this.mistakes, 'mistake')} · ${plural(this.hints, 'hint')} · ${plural(line.moves.length, 'move')}</p>${grades}</div>`;
      $$('#result-panel [data-g]').forEach(b => b.onclick = () => this.applyGrade(+b.dataset.g));
      this.suggested = sug;
      if (Store.settings.autoContinue) this.timer = setTimeout(() => this.applyGrade(this.scheduled ? sug : -1), 1600);
    },
    applyGrade(g) {
      const line = this.line, s = this.session;
      if (!this.finished) return;
      this.clearTimers();
      const wasNew = SRS.isNew(line.srs);
      line.stats.attempts++; line.stats.mistakes += this.mistakes; line.stats.lastMistakes = this.mistakes; line.stats.lastHints = this.hints;
      if (g >= 0) line.srs = SRS.grade(line.srs, g);
      const th = todayHist();
      th.reps++; if (this.mistakes === 0) th.clean++; th.mistakes += this.mistakes; if (wasNew && g >= 0) th.learned++;
      Store.state.log.unshift({ t: Date.now(), id: line.id, name: line.name, color: line.color, grade: g, mistakes: this.mistakes, hints: this.hints });
      if (Store.state.log.length > 500) Store.state.log.length = 500;
      const st = streak(); if (st > Store.state.meta.bestStreak) Store.state.meta.bestStreak = st;
      Store.save();
      s.results[s.idx] = { id: line.id, grade: g, mistakes: this.mistakes };
      s.reps++; if (this.mistakes === 0) s.clean++; s.mistakes += this.mistakes;
      s.idx++;
      updateNav();
      this.nextLine();
    },
    skip() {
      if (!this.session || this.session.done) return;
      this.clearTimers();
      this.session.results[this.session.idx] = { id: this.line.id, grade: null, mistakes: 0, skipped: true };
      this.session.idx++;
      this.nextLine();
    },
    end() {
      if (!this.session) return go('#/train');
      this.clearTimers();
      this.session.done = true;
      this.renderSummary();
    },
    renderSummary() {
      const s = this.session;
      const mins = Math.max(1, Math.round((Date.now() - s.started) / 60000));
      const acc = s.reps ? Math.round(s.clean / s.reps * 100) : 0;
      main.innerHTML = `
        <div class="view" style="max-width:860px">
          <div class="card result-card">
            <div class="big">${s.reps === 0 ? '🙂' : acc >= 80 ? '🏆' : acc >= 50 ? '💪' : '📚'}</div>
            <h1>Session complete</h1>
            <p class="muted" style="font-size:1.05rem;margin-top:6px">${plural(s.reps, 'line')} drilled in about ${plural(mins, 'minute')}</p>
            <div class="grid cols-3" style="margin:26px 0">
              <div class="stat"><span class="num accent">${acc}%</span><span class="lbl">Clean lines</span></div>
              <div class="stat"><span class="num blue">${s.reps}</span><span class="lbl">Reps</span></div>
              <div class="stat"><span class="num warn">${s.mistakes}</span><span class="lbl">Mistakes</span></div>
            </div>
            <div class="row-list" style="text-align:left;margin-bottom:22px">${s.results.filter(Boolean).map(r => { const l = Lines.get(r.id); if (!l) return ''; return `<div class="line-row"><div class="main"><div class="title">${esc(l.name)} ${colorBadge(l.color)}</div><div class="meta">${r.skipped ? 'Skipped' : r.mistakes === 0 ? '✅ Clean' : `✖ ${plural(r.mistakes, 'mistake')}`}${r.grade != null && r.grade >= 0 ? ` · graded ${['Again', 'Hard', 'Good', 'Easy'][r.grade]} · next ${SRS.dueLabel(l.srs)}` : ''}</div></div><div class="actions"><button class="btn sm" data-redo="${l.id}">Drill again</button></div></div>`; }).join('')}</div>
            <div class="btn-row" style="justify-content:center">
              <a class="btn primary lg" href="#/dashboard">Back to dashboard</a>
              <a class="btn lg" href="#/train">Train more</a>
              ${s.mistakes ? '<button class="btn lg" id="redo-mistakes">🎯 Redo mistakes</button>' : ''}
            </div>
          </div>
        </div>`;
      $$('[data-redo]', main).forEach(b => b.onclick = () => this.startLine(b.dataset.redo));
      const rm = $('#redo-mistakes'); if (rm) rm.onclick = () => this.start('mistakes', s.results.filter(r => r && r.mistakes > 0).map(r => r.id));
      this.session = null;
      updateNav();
    },
    onKey(e) {
      if (e.target.matches('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!this.session) return;
      const k = e.key.toLowerCase();
      if (this.finished) {
        if (k === ' ' || k === 'enter') { e.preventDefault(); this.applyGrade(this.scheduled ? this.suggested : -1); return; }
        if (this.scheduled && ['1', '2', '3', '4'].includes(k)) { e.preventDefault(); this.applyGrade(+k - 1); return; }
      }
      if (k === 'h') { e.preventDefault(); this.hint(); }
      else if (k === 's') { e.preventDefault(); this.skip(); }
      else if (k === 'escape') { e.preventDefault(); this.end(); }
    },
  };
  function kingSquare(chess) {
    const b = chess.board(); const c = chess.turn();
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const p = b[i][j]; if (p && p.type === 'k' && p.color === c) return 'abcdefgh'[j] + (8 - i); }
    return null;
  }

  /* ---------- Explore / Build ---------- */
  Views.explore = (parts) => {
    const ex = { moves: [], ply: 0, editId: null, title: '' };
    if (parts[0] === 'db' && DB[+parts[1]]) { ex.moves = [...DB[+parts[1]].moves]; ex.ply = ex.moves.length; }
    else if ((parts[0] === 'line' || parts[0] === 'edit') && Lines.get(parts[1])) { const l = Lines.get(parts[1]); ex.moves = [...l.moves]; ex.ply = parts[0] === 'edit' ? l.moves.length : 0; if (parts[0] === 'edit') ex.editId = l.id; ex.lineColor = l.color; }
    main.innerHTML = `
      <div class="view">
        <div class="play-layout">
          <div class="board-col"><div class="board-wrap"><div id="ex-board"></div>
            <div class="under-board">
              <div class="btn-row">
                <button class="btn sm icon" id="ex-first" title="Start">⏮</button>
                <button class="btn sm icon" id="ex-prev" title="Back (←)">◀</button>
                <button class="btn sm icon" id="ex-next" title="Forward (→)">▶</button>
                <button class="btn sm icon" id="ex-last" title="End">⏭</button>
                <button class="btn sm" id="ex-flip">⇅ Flip <span class="kbd">F</span></button>
              </div>
              <div class="btn-row"><button class="btn sm ghost" id="ex-undo" title="Delete moves from here">✂ Cut from here</button><button class="btn sm ghost" id="ex-clear">Clear</button></div>
            </div>
          </div></div>
          <div class="side-col">
            <div class="panel" id="ex-info"></div>
            <div class="panel"><div class="panel-title"><h3>Moves</h3><span class="muted small">play on the board to extend or branch</span></div><div class="movelist" id="ex-moves"></div></div>
            <div class="panel"><div class="panel-title"><h3>Named continuations</h3><span class="muted small" id="ex-branch-count"></span></div><div class="explore-branches" id="ex-branches"></div></div>
            <div class="panel">
              <div class="panel-title"><h3>${ex.editId ? 'Save changes' : 'Add to repertoire'}</h3></div>
              <div class="field"><label>Line name</label><input class="input" id="ex-name" placeholder="Detected automatically"></div>
              <div class="btn-row" style="margin-top:12px">
                ${ex.editId ? `<button class="btn primary" id="ex-save">💾 Save moves to line</button>` : `<button class="btn primary" id="ex-add-w">+ Add as White</button><button class="btn primary" id="ex-add-b">+ Add as Black</button>`}
                <button class="btn" id="ex-drill">▶ Drill now</button>
                <button class="btn ghost" id="ex-copy">Copy PGN</button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    const chess = new Chess();
    const board = makeBoard($('#ex-board'), {
      onMove: (from, to) => {
        const mv = chess.move({ from, to, promotion: 'q' });
        if (!mv) return false;
        ex.moves = ex.moves.slice(0, ex.ply); ex.moves.push(mv.san); ex.ply++;
        afterChange(mv); return true;
      },
      legalMoves: sq => chess.moves({ square: sq, verbose: true }).map(m => ({ to: m.to, capture: !!m.captured })),
    });
    board.setInteractive('both');
    if (ex.lineColor === 'b') board.setOrientation('b');
    function sync(animate = true) {
      chess.reset();
      let last = null;
      for (let i = 0; i < ex.ply; i++) last = chess.move(ex.moves[i], { sloppy: true }) || last;
      board.setPosition(chess, animate);
      board.setMarks({ last: last ? [last.from, last.to] : [], check: chess.in_check() ? kingSquare(chess) : null, hint: [] });
      render();
    }
    function afterChange(mv) {
      board.setPosition(chess);
      board.setMarks({ last: [mv.from, mv.to], check: chess.in_check() ? kingSquare(chess) : null, hint: [] });
      Sound.forMove(mv, chess);
      render();
    }
    function render() {
      const cur = ex.moves.slice(0, ex.ply);
      const det = detectOpening(cur);
      const full = detectOpening(ex.moves);
      $('#ex-info').innerHTML = `<div class="panel-title"><h3>${esc(det ? det.name : cur.length ? 'Unnamed position' : 'Starting position')}</h3>${det ? `<span class="badge">${det.eco}</span>` : ''}</div>
        <p class="muted small">${cur.length ? `Move ${ex.ply} of ${ex.moves.length} · ${chess.turn() === 'w' ? 'White' : 'Black'} to move` : 'Play moves on the board or pick a continuation below.'}${det && det.gambit ? ' · <span class="badge warn">⚔ Gambit</span>' : ''}</p>`;
      $('#ex-name').placeholder = full ? full.name : 'Custom line';
      let html = `<span class="start ${ex.ply === 0 ? 'mv cur' : ''}" data-i="0">Start</span>`;
      ex.moves.forEach((san, i) => { if (i % 2 === 0) html += `<span class="num">${i / 2 + 1}.</span>`; html += `<span class="mv ${i < ex.ply ? 'played' : ''} ${i === ex.ply - 1 ? 'cur' : ''}" data-i="${i + 1}">${esc(san)}</span>`; });
      $('#ex-moves').innerHTML = html;
      $$('#ex-moves [data-i]').forEach(m => m.onclick = () => { ex.ply = +m.dataset.i; sync(); });
      // continuations
      const prefix = cur.join(' ');
      const next = new Map();
      for (const d of DB) {
        if (d.moves.length <= cur.length) continue;
        if (cur.length && !(d.key.startsWith(prefix + ' '))) continue;
        const san = d.moves[cur.length];
        const e = next.get(san) || { san, count: 0, best: null };
        e.count++;
        if (!e.best || d.moves.length < e.best.moves.length || (d.moves.length === e.best.moves.length && d.name.length < e.best.name.length)) e.best = d;
        next.set(san, e);
      }
      const arr = [...next.values()].sort((a, b) => b.count - a.count);
      $('#ex-branch-count').textContent = arr.length ? `${arr.length} move${arr.length > 1 ? 's' : ''}` : '';
      $('#ex-branches').innerHTML = arr.length ? arr.map(e => `<div class="branch" data-san="${esc(e.san)}"><span class="mv">${Math.floor(cur.length / 2) + 1}${cur.length % 2 ? '…' : '.'} ${esc(e.san)}</span><span class="nm">${esc(e.best.name)}</span><span class="ct">${e.count}</span></div>`).join('') : '<p class="muted small">No named continuations from here. Keep playing to build your own line.</p>';
      $$('#ex-branches .branch').forEach(b => b.onclick = () => {
        const mv = chess.move(b.dataset.san, { sloppy: true }); if (!mv) return;
        if (ex.moves[ex.ply] === mv.san) ex.ply++; else { ex.moves = ex.moves.slice(0, ex.ply); ex.moves.push(mv.san); ex.ply++; }
        afterChange(mv);
      });
      $('#ex-prev').disabled = ex.ply === 0; $('#ex-first').disabled = ex.ply === 0;
      $('#ex-next').disabled = ex.ply >= ex.moves.length; $('#ex-last').disabled = ex.ply >= ex.moves.length;
    }
    const nav = (p) => { ex.ply = clamp(p, 0, ex.moves.length); const prev = ex.ply; sync(); if (prev === ex.ply) { const mv = ex.ply ? ex.moves[ex.ply - 1] : null; if (mv) Sound.play(/x/.test(mv) ? 'capture' : 'move'); } };
    $('#ex-first').onclick = () => nav(0); $('#ex-prev').onclick = () => nav(ex.ply - 1);
    $('#ex-next').onclick = () => nav(ex.ply + 1); $('#ex-last').onclick = () => nav(ex.moves.length);
    $('#ex-flip').onclick = () => board.setOrientation(board.orientation === 'w' ? 'b' : 'w', true);
    $('#ex-undo').onclick = () => { ex.moves = ex.moves.slice(0, ex.ply); render(); };
    $('#ex-clear').onclick = () => { ex.moves = []; ex.ply = 0; sync(); };
    const lineName = () => $('#ex-name').value.trim() || $('#ex-name').placeholder;
    const addAs = color => {
      if (!ex.moves.length) return toast('Play some moves first', 'err');
      const r = Lines.add({ name: lineName(), color, moves: ex.moves, source: 'custom' });
      if (r.existed) toast('That line is already in your ' + colorName(color) + ' repertoire'); else { toast(`Added "${r.line.name}" as ${colorName(color)}`, 'ok'); Sound.play('confirm'); }
      updateNav();
    };
    if (ex.editId) $('#ex-save').onclick = () => { if (!ex.moves.length) return toast('A line needs at least one move', 'err'); const nm = $('#ex-name').value.trim(); Lines.update(ex.editId, { moves: [...ex.moves], ...(nm ? { name: nm } : {}) }); toast('Line updated', 'ok'); go('#/repertoire'); };
    else { $('#ex-add-w').onclick = () => addAs('w'); $('#ex-add-b').onclick = () => addAs('b'); }
    $('#ex-drill').onclick = async () => {
      if (!ex.moves.length) return toast('Play some moves first', 'err');
      const color = ex.lineColor || await modal({ title: 'Drill as which colour?', body: '<p class="muted">The other side\'s moves will be played for you.</p>', buttons: [{ label: '♔ White', value: 'w', cls: 'primary' }, { label: '♚ Black', value: 'b', cls: 'primary' }] });
      if (!color) return;
      const existing = Lines.find(color, ex.moves);
      if (existing) return Trainer.startLine(existing.id);
      const r = Lines.add({ name: lineName(), color, moves: ex.moves, source: 'custom' });
      toast(`Added to ${colorName(color)} repertoire`, 'ok');
      Trainer.startLine(r.line.id);
    };
    $('#ex-copy').onclick = () => { navigator.clipboard.writeText(PGN.format(ex.moves)).then(() => toast('PGN copied', 'ok'), () => toast('Could not copy', 'err')); };
    if (ex.editId) $('#ex-name').value = Lines.get(ex.editId).name;
    const onKey = e => {
      if (e.target.matches('input, textarea, select')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); nav(ex.ply - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); nav(ex.ply + 1); }
      else if (e.key === 'Home') { e.preventDefault(); nav(0); }
      else if (e.key === 'End') { e.preventDefault(); nav(ex.moves.length); }
      else if (e.key.toLowerCase() === 'f') { e.preventDefault(); $('#ex-flip').click(); }
    };
    document.addEventListener('keydown', onKey);
    sync(false);
    return () => document.removeEventListener('keydown', onKey);
  };

  /* ---------- Import ---------- */
  Views.import = () => {
    main.innerHTML = `
      <div class="view" style="max-width:1000px">
        <div class="view-head"><div><h1>Add openings</h1><div class="sub">Paste or open a PGN file. Variations are split into separate lines; each line is validated.</div></div>
          <div class="btn-row"><a class="btn" href="#/explore">♟ Build on the board</a><a class="btn" href="#/library">📚 Library</a></div></div>
        <div class="card">
          <div class="grid cols-2" style="margin-bottom:14px">
            <div class="field"><label>Train as</label><div class="radio-group" id="imp-color"><button data-v="w" class="active">♔ White</button><button data-v="b">♚ Black</button></div></div>
            <div class="field"><label>Name (optional — detected from the PGN headers or the opening database)</label><input class="input" id="imp-name" placeholder="e.g. My Caro-Kann repertoire"></div>
          </div>
          <div class="field"><label>PGN</label><textarea class="input" id="imp-text" placeholder="1. e4 c6 2. d4 d5 3. Nc3 (3. e5 Bf5) 3... dxe4 4. Nxe4 Bf5 ...

Multiple games, comments { } and nested variations ( ) are supported."></textarea></div>
          <div class="btn-row" style="margin-top:14px">
            <button class="btn primary" id="imp-parse">Parse PGN</button>
            <label class="btn">📂 Open .pgn file<input type="file" id="imp-file" accept=".pgn,.txt" style="display:none"></label>
            <span class="muted small" id="imp-msg"></span>
          </div>
        </div>
        <div id="imp-result" style="margin-top:20px"></div>
      </div>`;
    let color = 'w';
    $$('#imp-color button').forEach(b => b.onclick = () => { color = b.dataset.v; $$('#imp-color button').forEach(x => x.classList.toggle('active', x === b)); });
    $('#imp-file').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { $('#imp-text').value = r.result; parse(); }; r.readAsText(f); };
    function parse() {
      const text = $('#imp-text').value;
      if (!text.trim()) return toast('Paste some PGN first', 'err');
      let games;
      try { games = PGN.parse(text); } catch (err) { return toast('Could not parse PGN: ' + err.message, 'err'); }
      const found = [];
      games.forEach((g, gi) => {
        const base = $('#imp-name').value.trim() || g.headers.Opening || g.headers.Event || '';
        g.lines.forEach((sans, li) => {
          const v = PGN.validate(sans);
          if (!v.moves.length) return;
          const det = detectOpening(v.moves);
          let name = base && !/^\?*$/.test(base) ? base : (det ? det.name : 'Custom line');
          if (g.lines.length > 1) name += ` (line ${li + 1})`;
          else if (games.length > 1 && !base) name += gi ? '' : '';
          found.push({ name, moves: v.moves, error: v.error, eco: g.headers.ECO || (det ? det.eco : '') });
        });
      });
      const box = $('#imp-result');
      if (!found.length) { box.innerHTML = `<div class="empty"><div class="big">🤷</div>No moves found in that PGN.</div>`; return; }
      box.innerHTML = `<div class="card"><div class="panel-title"><h3>${plural(found.length, 'line')} found</h3><div class="btn-row"><button class="btn sm" id="imp-all">Select all</button><button class="btn sm" id="imp-none">None</button></div></div>
        <div id="imp-list">${found.map((f, i) => `<label class="checkbox-row"><input type="checkbox" checked data-i="${i}"><div style="min-width:0"><div><input class="input" style="padding:4px 8px;width:100%;max-width:420px" value="${esc(f.name)}" data-name="${i}"> ${f.eco ? `<span class="badge">${esc(f.eco)}</span>` : ''} ${Lines.find(color, f.moves) ? '<span class="badge accent">already in repertoire</span>' : ''}</div><div class="mv">${esc(PGN.format(f.moves))}</div>${f.error ? `<div class="small" style="color:var(--danger)">⚠ ${esc(f.error)} — line truncated</div>` : ''}</div></label>`).join('')}</div>
        <div class="btn-row" style="margin-top:14px"><button class="btn primary lg" id="imp-add">Add selected as ${colorName(color)}</button></div></div>`;
      $('#imp-all').onclick = () => $$('#imp-list input[type=checkbox]').forEach(c => c.checked = true);
      $('#imp-none').onclick = () => $$('#imp-list input[type=checkbox]').forEach(c => c.checked = false);
      $('#imp-add').onclick = () => {
        let added = 0, dup = 0;
        $$('#imp-list input[type=checkbox]').forEach(c => {
          if (!c.checked) return;
          const f = found[+c.dataset.i];
          const nm = $(`[data-name="${c.dataset.i}"]`).value.trim() || f.name;
          const r = Lines.add({ name: nm, eco: f.eco, color, moves: f.moves, source: 'import' });
          if (r.existed) dup++; else added++;
        });
        toast(`Added ${plural(added, 'line')}${dup ? ` (${dup} already existed)` : ''}`, 'ok'); Sound.play('confirm'); updateNav();
        if (added) { repState.tab = color; go('#/repertoire'); }
      };
    }
    $('#imp-parse').onclick = parse;
  };

  /* ---------- Stats ---------- */
  Views.stats = () => {
    const lines = Lines.all();
    const h = Store.state.history;
    const days = [];
    for (let i = 29; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = dayKey(d); days.push({ k, reps: h[k] ? h[k].reps : 0, label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }); }
    const maxReps = Math.max(1, ...days.map(d => d.reps));
    const totalReps = Object.values(h).reduce((a, x) => a + x.reps, 0);
    const totalClean = Object.values(h).reduce((a, x) => a + x.clean, 0);
    const acc = totalReps ? Math.round(totalClean / totalReps * 100) : 0;
    const hardest = [...lines].filter(l => l.stats.attempts).sort((a, b) => (b.stats.mistakes / b.stats.attempts) - (a.stats.mistakes / a.stats.attempts) || b.srs.lapses - a.srs.lapses).slice(0, 8);
    const fams = new Map();
    for (const l of lines) { const f = fams.get(l.family) || { n: 0, lvl: 0 }; f.n++; f.lvl += l.srs.level; fams.set(l.family, f); }
    const famArr = [...fams.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 12);
    main.innerHTML = `
      <div class="view">
        <div class="view-head"><div><h1>Statistics</h1><div class="sub">All time, stored locally.</div></div></div>
        <div class="grid cols-4" style="margin-bottom:22px">
          <div class="card stat"><span class="num blue">${totalReps}</span><span class="lbl">Total reps</span></div>
          <div class="card stat"><span class="num accent">${acc}%</span><span class="lbl">Clean-line rate</span></div>
          <div class="card stat"><span class="num warn">${Store.state.meta.bestStreak}</span><span class="lbl">Best streak (days)</span></div>
          <div class="card stat"><span class="num purple">${lines.filter(l => l.srs.level >= 5).length}/${lines.length}</span><span class="lbl">Mastered lines</span></div>
        </div>
        <div class="grid cols-2">
          <div class="card"><div class="panel-title"><h3>Reps per day</h3><span class="muted small">last 30 days</span></div><div class="bars">${days.map(d => `<div class="bar" style="height:${(d.reps / maxReps * 100).toFixed(1)}%"><span>${d.label}: ${d.reps}</span></div>`).join('')}</div></div>
          <div class="card"><div class="panel-title"><h3>Mastery levels</h3></div>${masteryBars(lines)}</div>
          <div class="card"><div class="panel-title"><h3>Hardest lines</h3><span class="muted small">by mistake rate</span></div>${hardest.length ? hardest.map(l => `<div class="hbar" style="grid-template-columns:1fr 100px 60px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.name)} ${colorBadge(l.color)}</span><div class="progress" style="background:var(--surface-3)"><i style="width:${Math.min(100, l.stats.mistakes / Math.max(1, l.stats.attempts) * 100).toFixed(0)}%;background:var(--danger)"></i></div><span class="n">${l.stats.mistakes}/${l.stats.attempts}</span></div>`).join('') : '<p class="muted">Drill some lines first.</p>'}</div>
          <div class="card"><div class="panel-title"><h3>Progress by opening</h3><span class="muted small">average mastery</span></div>${famArr.length ? famArr.map(([f, x]) => `<div class="hbar" style="grid-template-columns:1fr 120px 60px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f)}</span><div class="progress"><i style="width:${(x.lvl / x.n / 5 * 100).toFixed(0)}%"></i></div><span class="n">${x.n}</span></div>`).join('') : '<p class="muted">No lines yet.</p>'}</div>
        </div>
        <h2 style="margin:28px 0 12px">Recent reps</h2>
        <div class="row-list">${Store.state.log.slice(0, 20).map(r => `<div class="line-row"><div class="main"><div class="title">${esc(r.name)} ${colorBadge(r.color)}</div><div class="meta">${new Date(r.t).toLocaleString()} · ${r.mistakes === 0 ? '✅ clean' : '✖ ' + plural(r.mistakes, 'mistake')}${r.hints ? ' · ' + plural(r.hints, 'hint') : ''}${r.grade >= 0 ? ' · ' + ['Again', 'Hard', 'Good', 'Easy'][r.grade] : ' · practice'}</div></div></div>`).join('') || '<p class="muted">Nothing yet.</p>'}</div>
      </div>`;
  };

  /* ---------- Settings ---------- */
  Views.settings = () => {
    const s = Store.settings;
    const sets = ['cburnett', 'merida', 'alpha', 'staunty'];
    const themes = ['brown', 'blue', 'green', 'purple', 'wood', 'slate', 'ice'];
    const sw = (key) => `<button class="switch ${s[key] ? 'on' : ''}" data-switch="${key}" aria-label="${key}"></button>`;
    const row = (title, desc, ctl) => `<div class="option-row"><div class="lbl"><b>${title}</b><span>${desc}</span></div><div class="ctl">${ctl}</div></div>`;
    main.innerHTML = `
      <div class="view" style="max-width:980px">
        <div class="view-head"><div><h1>Settings</h1><div class="sub">Everything is stored in this browser profile. Nothing leaves your computer.</div></div></div>
        <div class="grid cols-2" style="align-items:start">
          <div style="display:flex;flex-direction:column;gap:18px">
            <div class="card"><h3 style="margin-bottom:8px">Board</h3>
              <div class="option-row" style="flex-direction:column;align-items:stretch"><div class="lbl"><b>Piece set</b></div><div class="set-pick" style="margin-top:10px">${sets.map(p => `<button class="${s.pieceSet === p ? 'active' : ''}" data-set="${p}"><i style="background-image:url('pieces/${p}/wN.svg')"></i>${p}</button>`).join('')}</div></div>
              <div class="option-row"><div class="lbl"><b>Board colours</b></div><div class="ctl">${themes.map(t => `<button class="swatch theme-${t} ${s.boardTheme === t ? 'active' : ''}" data-theme="${t}" title="${t}"><i></i><i></i><i></i><i></i></button>`).join('')}</div></div>
              ${row('Board size', 'Maximum width on large screens', `<input type="range" min="380" max="900" step="20" value="${s.boardSize}" data-range="boardSize"><span class="mono" id="val-boardSize">${s.boardSize}px</span>`)}
              ${row('Coordinates', 'Show file and rank labels', sw('showCoords'))}
              ${row('Legal move dots', 'Show where a selected piece can go', sw('showLegal'))}
              ${row('Highlight last move', '', sw('highlightLast'))}
              ${row('Piece animation', 'Speed of piece movement', `<select class="input" data-select="animation">${['off', 'fast', 'normal', 'slow'].map(v => `<option value="${v}" ${s.animation === v ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
              <div class="option-row" style="flex-direction:column;align-items:stretch"><div class="lbl"><b>Preview</b></div><div id="settings-board" style="max-width:300px;margin-top:10px"></div></div>
            </div>
            <div class="card"><h3 style="margin-bottom:8px">Appearance</h3>
              ${row('Theme', 'Dark or light interface', `<select class="input" data-select="appearance"><option value="dark" ${s.appearance === 'dark' ? 'selected' : ''}>Dark</option><option value="light" ${s.appearance === 'light' ? 'selected' : ''}>Light</option></select>`)}
              ${row('Text size', 'Scales the whole interface', `<input type="range" min="80" max="150" step="5" value="${s.uiScale}" data-range="uiScale"><span class="mono" id="val-uiScale">${s.uiScale}%</span>`)}
              ${row('Confetti', 'Celebrate perfect lines', sw('confetti'))}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:18px">
            <div class="card"><h3 style="margin-bottom:8px">Sound</h3>
              ${row('Sound effects', 'Moves, captures, checks and results', sw('sound'))}
              ${row('Volume', '', `<input type="range" min="0" max="100" step="5" value="${Math.round(s.volume * 100)}" data-range="volume"><span class="mono" id="val-volume">${Math.round(s.volume * 100)}%</span>`)}
            </div>
            <div class="card"><h3 style="margin-bottom:8px">Training</h3>
              ${row('New lines per day', 'How many unseen lines are mixed into your daily reps', `<input type="number" class="input" min="0" max="200" value="${s.newPerDay}" data-number="newPerDay" style="width:100px">`)}
              ${row('Guided first pass', 'Show arrows the first time you see a line, then test from memory', sw('learnFirst'))}
              ${row('Show answer after', 'Wrong attempts before the correct move is revealed', `<select class="input" data-select="hintAfterMistakes">${[1, 2, 3].map(v => `<option value="${v}" ${s.hintAfterMistakes == v ? 'selected' : ''}>${v} mistake${v > 1 ? 's' : ''}</option>`).join('')}</select>`)}
              ${row('Opponent delay', 'Pause before the opponent replies', `<input type="range" min="100" max="1500" step="50" value="${s.opponentDelay}" data-range="opponentDelay"><span class="mono" id="val-opponentDelay">${s.opponentDelay}ms</span>`)}
              ${row('Auto-continue', 'Accept the suggested grade automatically after each line', sw('autoContinue'))}
            </div>
            <div class="card"><h3 style="margin-bottom:8px">Data</h3>
              <p class="muted small" style="margin-bottom:12px">${plural(Lines.all().length, 'line')} · ${Object.values(Store.state.history).reduce((a, x) => a + x.reps, 0)} reps · backup is a single JSON file.</p>
              <div class="btn-row">
                <button class="btn" id="data-export">⬇ Export backup</button>
                <label class="btn">⬆ Restore backup<input type="file" id="data-import" accept=".json" style="display:none"></label>
                <button class="btn" id="data-pgn">Export all as PGN</button>
              </div>
              <div class="btn-row" style="margin-top:12px">
                <button class="btn danger" id="data-reset-progress">Reset all progress</button>
                <button class="btn danger" id="data-wipe">Delete everything</button>
              </div>
            </div>
            <div class="card"><h3 style="margin-bottom:8px">About</h3><p class="muted small">Openings Local v1.0 · Opening database from the lichess chess-openings project (CC0) · Piece sets and sounds from lichess (cburnett CC BY-SA 3.0; merida, alpha, staunty under their respective free licences) · chess.js (BSD). No network access is used.</p></div>
          </div>
        </div>
      </div>`;
    const preview = makeBoard($('#settings-board'));
    preview.setPosition(new Chess('r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'), false);
    const apply = () => { Store.save(); applySettingsToDom(); preview.setPieceSet(s.pieceSet); preview.setTheme(s.boardTheme); preview.setCoords(s.showCoords); };
    $$('[data-set]').forEach(b => b.onclick = () => { s.pieceSet = b.dataset.set; $$('[data-set]').forEach(x => x.classList.toggle('active', x === b)); apply(); Sound.play('move'); });
    $$('[data-theme]').forEach(b => b.onclick = () => { s.boardTheme = b.dataset.theme; $$('[data-theme]').forEach(x => x.classList.toggle('active', x === b)); apply(); });
    $$('[data-switch]').forEach(b => b.onclick = () => { s[b.dataset.switch] = !s[b.dataset.switch]; b.classList.toggle('on', s[b.dataset.switch]); apply(); if (b.dataset.switch === 'sound' && s.sound) Sound.play('confirm'); });
    $$('[data-select]').forEach(el => el.onchange = () => { const k = el.dataset.select; s[k] = isNaN(+el.value) ? el.value : +el.value; apply(); });
    $$('[data-number]').forEach(el => el.onchange = () => { s[el.dataset.number] = clamp(+el.value || 0, +el.min, +el.max); el.value = s[el.dataset.number]; apply(); updateNav(); });
    $$('[data-range]').forEach(el => el.oninput = () => {
      const k = el.dataset.range; let v = +el.value;
      if (k === 'volume') { s.volume = v / 100; $('#val-volume').textContent = v + '%'; }
      else { s[k] = v; $('#val-' + k).textContent = v + (k === 'uiScale' ? '%' : k === 'opponentDelay' ? 'ms' : 'px'); }
      apply();
    });
    $$('[data-range="volume"]').forEach(el => el.onchange = () => Sound.play('move'));
    $('#data-export').onclick = () => { download(`openings-local-backup-${dayKey()}.json`, Store.exportJson(), 'application/json'); toast('Backup exported', 'ok'); };
    $('#data-import').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = async () => { if (!await confirmDlg('Restore backup', 'This replaces your current repertoire, progress and settings with the backup. Continue?', 'Restore')) return; try { const n = Store.importJson(r.result); toast(`Restored ${plural(n, 'line')}`, 'ok'); applySettingsToDom(); route(); } catch (err) { toast('Restore failed: ' + err.message, 'err'); } }; r.readAsText(f); };
    $('#data-pgn').onclick = () => { const ls = Lines.all(); if (!ls.length) return toast('No lines to export', 'err'); download('openings-local-repertoire.pgn', PGN.exportLines(ls)); toast('PGN exported', 'ok'); };
    $('#data-reset-progress').onclick = async () => { if (!await confirmDlg('Reset progress', 'Keep all lines but forget every rep, grade and streak?', 'Reset progress')) return; for (const l of Lines.all()) { l.srs = SRS.create(); l.stats = { attempts: 0, mistakes: 0, lastMistakes: 0, lastHints: 0 }; } Store.state.history = {}; Store.state.log = []; Store.state.meta.bestStreak = 0; Store.save(true); toast('Progress reset'); updateNav(); };
    $('#data-wipe').onclick = async () => { if (!await confirmDlg('Delete everything', 'Remove all lines, progress and settings? This cannot be undone.', 'Delete everything')) return; Store.reset(); applySettingsToDom(); toast('All data deleted'); go('#/dashboard'); };
  };

  /* ======================= boot ======================= */
  applySettingsToDom();
  Sound.preload();
  $$('.nav a').forEach(a => a.addEventListener('click', e => { if (a.dataset.view === 'train' && Trainer.session && !Trainer.session.done) { e.preventDefault(); go('#/train/session'); } }));
  if (!location.hash) location.hash = '#/dashboard';
  route();
  window.addEventListener('beforeunload', () => Store.save(true));
})();
