/* Sound effects (lichess "standard"/"lisp" sets, bundled locally). */
window.Sound = (() => {
  const files = {
    move: 'Move', capture: 'Capture', check: 'Check', error: 'Error', confirm: 'Confirmation',
    notify: 'GenericNotify', victory: 'Victory', select: 'Select',
  };
  const cache = {};
  function get(name) {
    if (!cache[name]) { cache[name] = new Audio('sounds/' + files[name] + '.mp3'); cache[name].preload = 'auto'; }
    return cache[name];
  }
  function play(name) {
    const s = Store.settings;
    if (!s.sound || !files[name]) return;
    try {
      const a = get(name).cloneNode();
      a.volume = Math.max(0, Math.min(1, s.volume));
      a.play().catch(() => {});
    } catch (e) { /* ignore */ }
  }
  function preload() { Object.keys(files).forEach(get); }
  // Pick the right sound for a chess.js move object
  function forMove(mv, chess) {
    if (chess && chess.in_check()) return play('check');
    if (mv && /[xe]/.test(mv.flags || '') && mv.captured) return play('capture');
    play('move');
  }
  return { play, preload, forMove };
})();
