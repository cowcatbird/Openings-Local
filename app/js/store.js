/* Persistent state (localStorage). Everything the app knows lives in one JSON blob. */
window.Store = (() => {
  const KEY = 'openingsLocal.v1';

  const defaultSettings = {
    appearance: 'dark',      // dark | light
    pieceSet: 'cburnett',    // cburnett | merida | alpha | staunty
    boardTheme: 'brown',
    sound: true,
    volume: 0.8,
    animation: 'normal',     // off | fast | normal | slow
    uiScale: 100,
    boardSize: 640,
    showCoords: true,
    showLegal: true,
    highlightLast: true,
    opponentDelay: 450,
    newPerDay: 10,
    hintAfterMistakes: 1,
    learnFirst: true,        // guided pass before testing a brand-new line
    confetti: true,
    autoContinue: false,     // apply the suggested grade automatically after a line
  };

  function blank() {
    return {
      version: 1,
      settings: { ...defaultSettings },
      lines: {},     // id -> line
      history: {},   // 'YYYY-MM-DD' -> { reps, clean, mistakes, learned }
      log: [],       // recent rep results
      meta: { created: Date.now(), bestStreak: 0 },
    };
  }

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const s = JSON.parse(raw);
      const b = blank();
      s.settings = { ...b.settings, ...(s.settings || {}) };
      s.lines = s.lines || {};
      s.history = s.history || {};
      s.log = s.log || [];
      s.meta = { ...b.meta, ...(s.meta || {}) };
      return s;
    } catch (e) {
      console.warn('Could not read saved state, starting fresh', e);
      return blank();
    }
  }

  let saveTimer = null;
  function save(immediate) {
    if (immediate) {
      clearTimeout(saveTimer); saveTimer = null;
      localStorage.setItem(KEY, JSON.stringify(state));
      return;
    }
    if (saveTimer) return;
    saveTimer = setTimeout(() => { saveTimer = null; localStorage.setItem(KEY, JSON.stringify(state)); }, 150);
  }

  function exportJson() { return JSON.stringify(state, null, 2); }

  function importJson(text) {
    const s = JSON.parse(text);
    if (!s || typeof s !== 'object' || !s.lines) throw new Error('Not an Openings Local backup file');
    const b = blank();
    state = { ...b, ...s, settings: { ...b.settings, ...(s.settings || {}) } };
    save(true);
    return Object.keys(state.lines).length;
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
