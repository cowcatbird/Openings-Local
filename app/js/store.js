/* Persistent state (localStorage). Everything the app knows lives in one JSON blob. */
window.Store = (() => {
  const KEY = 'openingsLocal.v2';
  const OLD_KEY = 'openingsLocal.v1';

  const defaultSettings = {
    appearance: 'dark',      // dark | light
    pieceSet: 'cburnett',    // cburnett | merida | alpha | staunty
    boardTheme: 'brown',
    sound: true,
    volume: 0.7,
    animation: 'normal',     // off | fast | normal | slow
    uiScale: 100,            // percent
    boardMax: 0,             // 0 = fill the screen, otherwise a pixel cap
    showCoords: true,
    showLegal: true,
    evalBar: true,
    showMaterial: true,
    opponentDelay: 500,      // ms before the opponent replies
    effects: true,           // stars & confetti
    autoNext: false,         // continue to the next line automatically
  };

  function blank() {
    return {
      version: 2,
      settings: { ...defaultSettings },
      progress: {},  // courseId -> { depth, lines: { lineId -> lp }, drillBest, timeBest, puzzles, last }
      custom: {},    // courseId -> user-made course
      history: {},   // 'YYYY-MM-DD' -> { lines, clean, mistakes, learned }
      meta: { created: Date.now(), bestStreak: 0 },
    };
  }

  function migrateV1(old) {
    const s = blank();
    if (old.settings) {
      for (const k of ['appearance', 'pieceSet', 'sound', 'volume', 'animation', 'uiScale', 'showCoords', 'showLegal', 'opponentDelay']) {
        if (k in old.settings) s.settings[k] = old.settings[k];
      }
    }
    const lines = Object.values(old.lines || {});
    for (const color of ['w', 'b']) {
      const mine = lines.filter(l => l.color === color && Array.isArray(l.moves) && l.moves.length);
      if (!mine.length) continue;
      const id = 'my-' + color + '-' + Date.now().toString(36);
      s.custom[id] = {
        id, name: color === 'w' ? 'My White repertoire' : 'My Black repertoire', side: color,
        desc: 'Lines carried over from your previous repertoire.', created: Date.now(), updated: Date.now(),
        lines: mine.map((l, i) => ({ id: 'm' + i + '-' + (l.id || i), m: l.moves.join(' '), n: {}, k: {}, name: l.name || '' })),
      };
    }
    for (const [d, h] of Object.entries(old.history || {})) s.history[d] = { lines: h.reps || 0, clean: h.clean || 0, mistakes: h.mistakes || 0, learned: h.learned || 0 };
    s.meta.bestStreak = (old.meta && old.meta.bestStreak) || 0;
    return s;
  }

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        const old = localStorage.getItem(OLD_KEY);
        if (old) { const s = migrateV1(JSON.parse(old)); localStorage.setItem(KEY, JSON.stringify(s)); return s; }
        return blank();
      }
      const s = JSON.parse(raw);
      const b = blank();
      s.settings = { ...b.settings, ...(s.settings || {}) };
      s.progress = s.progress || {};
      s.custom = s.custom || {};
      s.history = s.history || {};
      s.meta = { ...b.meta, ...(s.meta || {}) };
      return s;
    } catch (e) {
      console.warn('Could not read saved state, starting fresh', e);
      return blank();
    }
  }

  let saveTimer = null;
  function write() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.error('save failed', e); }
  }
  function save(immediate) {
    if (immediate) { clearTimeout(saveTimer); saveTimer = null; write(); return; }
    if (saveTimer) return;
    saveTimer = setTimeout(() => { saveTimer = null; write(); }, 150);
  }
  window.addEventListener('beforeunload', () => { if (saveTimer) save(true); });

  function exportJson() { return JSON.stringify(state, null, 2); }

  function importJson(text) {
    const s = JSON.parse(text);
    if (!s || typeof s !== 'object') throw new Error('Not an Openings Local backup file');
    const b = blank();
    state = s.version === 2 ? { ...b, ...s, settings: { ...b.settings, ...(s.settings || {}) } } : migrateV1(s);
    save(true);
    return state;
  }

  function reset() { state = blank(); save(true); }

  function todayKey(d = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  return {
    get state() { return state; },
    get settings() { return state.settings; },
    defaultSettings,
    save, exportJson, importJson, reset, todayKey,
  };
})();
