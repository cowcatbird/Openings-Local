/* Spaced repetition scheduling (SM-2 flavoured). Grades: 0 Again, 1 Hard, 2 Good, 3 Easy. */
window.SRS = (() => {
  const DAY = 86400000;
  const LEVELS = ['New', 'Learning', 'Familiar', 'Solid', 'Strong', 'Mastered'];

  function create() {
    return { due: 0, interval: 0, ease: 2.5, reps: 0, lapses: 0, level: 0, last: null, lastGrade: null };
  }

  function grade(s, g, now = Date.now()) {
    const n = { ...s };
    if (g === 0) {
      n.lapses++;
      n.interval = 0;
      n.level = Math.max(0, n.level - 1);
      n.ease = Math.max(1.3, n.ease - 0.2);
      n.due = now + 10 * 60000;
    } else if (g === 1) {
      const wasNew = n.interval < 1;
      n.interval = wasNew ? 1 : Math.max(n.interval + 1, Math.round(n.interval * 1.2));
      n.ease = Math.max(1.3, n.ease - 0.15);
      n.level = Math.max(1, n.level);
      n.due = now + (wasNew ? 12 * 3600000 : n.interval * DAY);
    } else if (g === 2) {
      n.interval = n.interval < 1 ? 1 : Math.max(n.interval + 1, Math.round(n.interval * n.ease));
      n.level = Math.min(5, n.level + 1);
      n.due = now + n.interval * DAY;
    } else {
      n.interval = n.interval < 1 ? 3 : Math.max(n.interval + 2, Math.round(n.interval * n.ease * 1.3));
      n.ease = Math.min(3.0, n.ease + 0.15);
      n.level = Math.min(5, n.level + 2);
      n.due = now + n.interval * DAY;
    }
    n.reps++;
    n.last = now;
    n.lastGrade = g;
    return n;
  }

  function isNew(s) { return !s || s.reps === 0; }
  function isDue(s, now = Date.now()) { return !isNew(s) && s.due <= now; }

  function fmtDuration(ms) {
    if (ms <= 0) return 'now';
    const m = Math.round(ms / 60000);
    if (m < 60) return m + 'm';
    const h = Math.round(ms / 3600000);
    if (h < 24) return h + 'h';
    const d = Math.round(ms / DAY);
    if (d < 30) return d + 'd';
    const mo = Math.round(d / 30);
    if (mo < 12) return mo + 'mo';
    return (d / 365).toFixed(1) + 'y';
  }

  function preview(s, g, now = Date.now()) { return fmtDuration(grade(s, g, now).due - now); }

  function dueLabel(s, now = Date.now()) {
    if (isNew(s)) return 'New';
    if (s.due <= now) return 'Due now';
    return 'in ' + fmtDuration(s.due - now);
  }

  // Suggest a grade from how the drill went.
  function suggest(mistakes, hints, s) {
    if (mistakes === 0 && hints === 0) return (s && s.level >= 3 && s.interval >= 7) ? 3 : 2;
    if (mistakes <= 1 && hints <= 1) return 1;
    return 0;
  }

  return { create, grade, isNew, isDue, preview, dueLabel, fmtDuration, suggest, LEVELS, DAY };
})();
