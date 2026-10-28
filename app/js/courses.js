/* Course model: built-in courses (courses-data.js) + the user's own courses, and progress. */
window.Courses = (() => {
  const NOW = () => Date.now();
  const isStudentPly = (side, ply) => (ply % 2 === 0) === (side === 'w');

  function normalize(c, custom) {
    const lines = (c.lines || []).map((l, i) => ({
      id: l.id, moves: (l.m || '').split(' ').filter(Boolean), notes: l.n || {}, marks: l.k || {}, evals: l.e || [],
      name: l.name || c.name, w: l.w != null ? l.w : 1, ess: l.ess != null ? !!l.ess : true, trap: !!l.trap, src: i,
    })).filter(l => l.moves.length);
    // tree order: the main line first, then each branch with the most popular replies first
    lines.forEach((l, i) => { l.idx = i; });
    // derive trap flag for custom courses from marks
    for (const l of lines) if (!l.trap && Object.values(l.marks).some(m => m === '??' || m === '?')) l.trap = true;
    const course = { id: c.id, name: c.name, side: c.side, group: c.group || (custom ? 'Mine' : ''), tags: c.tags || [], desc: c.desc || '', custom, lines };
    course.cover = c.cover || coverFen(course);
    course.puzzles = buildPuzzles(course);
    return course;
  }

  function coverFen(course) {
    const main = course.lines[0];
    const ch = new Chess();
    if (main) main.moves.slice(0, 10).forEach(s => ch.move(s, { sloppy: true }));
    return ch.fen();
  }

  // Puzzles: positions right after an opponent mistake; the student finds the punishing line.
  function buildPuzzles(course) {
    const out = [], seen = new Set();
    for (const l of course.lines) {
      const plies = Object.keys(l.marks).map(Number).filter(p => /\?/.test(l.marks[p])).sort((a, b) => a - b);
      for (const p of plies) {
        if (isStudentPly(course.side, p)) continue;
        const start = p + 1;
        if (start >= l.moves.length) continue;
        const key = l.moves.slice(0, l.moves.length).join(' ');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ id: l.id + '@' + start, line: l, start });
        break;
      }
    }
    return out;
  }

  const builtIn = (window.COURSES_DATA || []).map(c => normalize(c, false));
  let customCache = null, customStamp = null;

  function customs() {
    const stamp = JSON.stringify(Object.keys(Store.state.custom).map(k => [k, Store.state.custom[k].updated]));
    if (customCache && stamp === customStamp) return customCache;
    customCache = Object.values(Store.state.custom).sort((a, b) => (b.updated || 0) - (a.updated || 0)).map(c => normalize(c, true));
    customStamp = stamp;
    return customCache;
  }
  function all() { return customs().concat(builtIn); }
  function get(id) { return all().find(c => c.id === id) || null; }

  /* ---------- progress ---------- */
  function prog(courseId) {
    const P = Store.state.progress;
    if (!P[courseId]) P[courseId] = { depth: null, lines: {}, drillBest: 0, timeBest: 0, puzzles: {}, last: 0 };
    const p = P[courseId];
    p.lines = p.lines || {}; p.puzzles = p.puzzles || {};
    return p;
  }
  function peek(courseId) { return Store.state.progress[courseId] || null; }
  function lp(course, line) {
    const p = prog(course.id);
    if (!p.lines[line.id]) p.lines[line.id] = { learned: 0, perfect: false, srs: null, plays: 0, mistakes: 0, lastMistakes: 0, lastSeen: 0 };
    return p.lines[line.id];
  }
  function lpPeek(course, line) { const p = peek(course.id); return p && p.lines[line.id] || null; }

  function depthOf(course) {
    const p = peek(course.id);
    if (p && p.depth) return p.depth;
    return course.lines.filter(l => l.ess).length === course.lines.length ? 'full' : null;
  }
  function essentials(course) { return course.lines.filter(l => l.ess); }
  function focusOf(course) { const p = peek(course.id); return (p && p.focus) || null; }
  function setFocus(course, name) { prog(course.id).focus = name || null; Store.save(); }
  function active(course) {
    const d = depthOf(course);
    const f = focusOf(course);
    // a focused variation trains every line of that variation, whatever the depth
    if (f && course.lines.some(l => l.name === f)) return course.lines.filter(l => l.name === f);
    return d === 'ess' ? essentials(course) : course.lines;
  }
  function groups(course) {
    const m = new Map();
    for (const l of course.lines) { if (!m.has(l.name)) m.set(l.name, []); m.get(l.name).push(l); }
    return [...m.entries()].map(([name, lines]) => ({ name, lines }));
  }

  function stats(course) {
    const act = active(course);
    let learned = 0, perfected = 0, due = 0, shaky = 0;
    const now = NOW();
    for (const l of act) {
      const s = lpPeek(course, l);
      if (!s || !s.learned) continue;
      learned++;
      if (s.perfect) perfected++;
      if (s.srs && s.srs.due <= now) due++;
      if (s.lastMistakes > 0) shaky++;
    }
    const p = peek(course.id);
    const puzzlesSolved = p ? course.puzzles.filter(z => p.puzzles[z.id]).length : 0;
    return { total: act.length, all: course.lines.length, learned, perfected, due, shaky, puzzles: course.puzzles.length, puzzlesSolved, started: !!(p && p.last) };
  }

  const NEED = { practice: 1, drill: 3, time: 5, puzzles: 2 };
  function unlocks(course) {
    const s = stats(course);
    return {
      learn: { open: true },
      practice: { open: s.learned >= NEED.practice, have: s.learned, need: NEED.practice },
      drill: { open: s.perfected >= NEED.drill, have: s.perfected, need: NEED.drill },
      time: { open: s.perfected >= NEED.time, have: s.perfected, need: NEED.time },
      puzzles: { open: s.learned >= NEED.puzzles && course.puzzles.length > 0, have: Math.min(s.learned, NEED.puzzles), need: NEED.puzzles, none: course.puzzles.length === 0 },
      lines: { open: true },
    };
  }

  /* ---------- picking lines ---------- */
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function pick(course, mode, exclude) {
    const act = active(course);
    const now = NOW();
    const notEx = (arr) => { const f = arr.filter(l => l.id !== exclude); return f.length ? f : arr; };
    if (mode === 'learn') return act.find(l => !(lpPeek(course, l) || {}).learned) || null;
    const learned = act.filter(l => (lpPeek(course, l) || {}).learned);
    if (mode === 'practice') {
      if (!learned.length) return null;
      const score = (l) => {
        const s = lpPeek(course, l);
        if (s.srs && s.srs.due <= now) return 0 + (s.srs.due / 1e15);
        if (!s.perfect) return 1 + (s.lastSeen / 1e15);
        return 2 + (s.lastSeen / 1e15);
      };
      return notEx(learned.slice().sort((a, b) => score(a) - score(b)))[0];
    }
    if (mode === 'drill' || mode === 'time') {
      const pool = mode === 'drill' ? learned.filter(l => lpPeek(course, l).perfect) : learned;
      return pool.length ? shuffle(notEx(pool).slice())[0] : null;
    }
    return null;
  }
  function pickPuzzle(course, excludeId) {
    const p = prog(course.id);
    const pool = course.puzzles.filter(z => z.id !== excludeId);
    if (!pool.length) return course.puzzles[0] || null;
    const unsolved = pool.filter(z => !p.puzzles[z.id]);
    return shuffle((unsolved.length ? unsolved : pool).slice())[0];
  }

  /* ---------- recording ---------- */
  function today() {
    const h = Store.state.history, k = Store.todayKey();
    if (!h[k]) h[k] = { lines: 0, clean: 0, mistakes: 0, learned: 0 };
    return h[k];
  }
  function streak() {
    const h = Store.state.history;
    let n = 0; const d = new Date();
    if (!(h[Store.todayKey(d)] && h[Store.todayKey(d)].lines > 0)) d.setDate(d.getDate() - 1);
    while (h[Store.todayKey(d)] && h[Store.todayKey(d)].lines > 0) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function trainedToday() { const h = Store.state.history[Store.todayKey()]; return !!(h && h.lines > 0); }

  // result: { mode, mistakes, hints }
  function record(course, line, result) {
    const s = lp(course, line);
    const p = prog(course.id);
    const now = NOW();
    const clean = result.mistakes === 0 && result.hints === 0;
    const firstToday = !trainedToday();
    const t = today();
    t.lines++;
    if (clean) t.clean++;
    t.mistakes += result.mistakes;
    s.plays++; s.mistakes += result.mistakes; s.lastMistakes = result.mistakes; s.lastSeen = now;
    let newlyLearned = false, newlyPerfect = false;
    if (result.mode === 'learn') {
      if (!s.learned) { s.learned = now; newlyLearned = true; t.learned++; }
      if (!s.srs) s.srs = SRS.create();
      s.srs = { ...s.srs, due: now + 5 * 60000 };
    } else if (result.mode === 'puzzles') {
      if (clean) p.puzzles[result.puzzleId] = now;
    } else {
      if (!s.learned) { s.learned = now; newlyLearned = true; t.learned++; }
      const g = clean ? ((s.srs && s.srs.level >= 3) ? 3 : 2) : result.mistakes <= 1 && result.hints <= 1 ? 1 : 0;
      s.srs = SRS.grade(s.srs || SRS.create(), g, now);
      if (clean && !s.perfect) newlyPerfect = true;
      s.perfect = clean;
    }
    p.last = now;
    const st = streak();
    if (st > (Store.state.meta.bestStreak || 0)) Store.state.meta.bestStreak = st;
    Store.save();
    return { clean, newlyLearned, newlyPerfect, firstToday };
  }

  function setDepth(course, depth) { prog(course.id).depth = depth; Store.save(); }
  function resetProgress(course) { delete Store.state.progress[course.id]; Store.save(); }

  /* ---------- custom courses ---------- */
  function saveCustom(c) {
    const now = NOW();
    const id = c.id || ('c-' + now.toString(36) + Math.random().toString(36).slice(2, 6));
    const prev = Store.state.custom[id];
    Store.state.custom[id] = { ...(prev || {}), ...c, id, created: (prev && prev.created) || now, updated: now };
    Store.save(true);
    customCache = null;
    return id;
  }
  function removeCustom(id) { delete Store.state.custom[id]; delete Store.state.progress[id]; Store.save(true); customCache = null; }
  function lineId(moves) {
    let h = 2166136261; const s = moves.join(' ');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 'u' + (h >>> 0).toString(36);
  }

  return {
    all, get, builtIn: () => builtIn, customs, prog, peek, lp, lpPeek, depthOf, active, focusOf, setFocus, groups, essentials, stats, unlocks, NEED,
    pick, pickPuzzle, record, setDepth, resetProgress, saveCustom, removeCustom, lineId, streak, trainedToday, today, isStudentPly,
  };
})();
