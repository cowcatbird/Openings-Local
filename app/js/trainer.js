/* Course player: Learn, Practice, Drill, Time trial and Puzzles on one board (ChessReps-style). */
window.Trainer = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PIECE = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const MODES = {
    learn: { label: 'Learn', sub: 'discover new lines', icon: 'learn', color: 'var(--learn)' },
    practice: { label: 'Practice', sub: 'perfect your lines', icon: 'practice', color: 'var(--practice)' },
    drill: { label: 'Drill', sub: 'lines in a row', icon: 'drill', color: 'var(--drill)' },
    time: { label: 'Time', sub: '60-second trial', icon: 'time', color: 'var(--time)' },
    puzzles: { label: 'Puzzles', sub: 'punish mistakes', icon: 'puzzles', color: 'var(--puzzle)' },
    lines: { label: 'Lines', sub: 'browse all lines', icon: 'lines', color: 'var(--lines)' },
  };
  const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const stripSan = s => s.replace(/[+#?!]+$/, '');
  // 'Italian Game: Two Knights Defense, Knight Attack, Normal Variation' -> 'Knight Attack, Normal Variation'
  const shortName = (n) => { const r = n.includes(':') ? n.slice(n.indexOf(':') + 1).trim() : n; const p = r.split(',').map(x => x.trim()); return p.length > 2 ? p.slice(-2).join(', ') : r; };

  function instruction(san, chessBefore) {
    if (san.startsWith('O-O-O')) return 'Castle queenside.';
    if (san.startsWith('O-O')) return 'Castle kingside.';
    const m = chessBefore.move(san, { sloppy: true });
    if (!m) return `Play ${san}.`;
    chessBefore.undo();
    const piece = PIECE[m.piece];
    const P = piece[0].toUpperCase() + piece.slice(1);
    if (m.promotion) return `Promote the pawn on ${m.to} to a ${PIECE[m.promotion]}.`;
    if (m.captured) return `${P} takes ${PIECE[m.captured]} on ${m.to}.`;
    return `Play ${piece} to ${m.to}.`;
  }

  /* ================================================================ mount */
  function mount(main, course, opts = {}) {
    const S = Store.settings;
    const side = course.side, opp = side === 'w' ? 'b' : 'w';
    const oppName = opp === 'w' ? 'White' : 'Black';
    const hasEvals = course.lines.some(l => l.evals && l.evals.some(v => v != null));
    const T = {
      mode: null, line: null, puzzle: null, start: 0, ply: 0, chess: new Chess(),
      status: 'idle', mistakes: 0, hints: 0, hintLevel: 0, showModes: true, wrongMove: null,
      history: [], histPos: -1, timers: new Set(), drill: null, time: null, lastEval: 20, drawer: null, pop: null,
    };

    main.innerHTML = `
      <div class="play" id="play">
        <div class="board-area">
          <div class="evalbar ${side === 'b' ? 'flip' : ''} ${S.evalBar && hasEvals ? '' : 'hidden'}" id="evalbar"><div class="fill"></div><div class="mid"></div><span class="lbl lo"></span><span class="lbl hi"></span></div>
          <div class="board-col">
            <div class="material" id="mat-top"></div>
            <div class="board-holder"><div id="board"></div></div>
            <div class="material" id="mat-bot"></div>
          </div>
        </div>
        <aside class="side" id="side">
          <div class="side-head"><span id="mode-ico"></span><span id="mode-name"></span><span class="course">${esc(course.name)}</span><span class="num" id="line-num"></span></div>
          <div class="side-body" id="side-body">
            <div id="hud"></div>
            <div class="coach" id="coach">
              <div class="avatar"><img src="pieces/cburnett/wP.svg" alt=""><svg class="crown" viewBox="0 0 24 24"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/></svg></div>
              <div class="bubble" id="bubble"></div>
            </div>
            <div class="modes" id="modes"></div>
          </div>
          <div class="side-foot">
            <button class="foot-btn" id="f-settings" title="Course settings">${Icon('settings')}</button>
            <button class="foot-btn" id="f-mode" title="Modes (Esc)">${Icon('mode')}<span>Mode</span></button>
            <button class="foot-btn" id="f-act" title="Hint (H)"></button>
            <button class="foot-btn" id="f-lines" title="All lines">${Icon('list')}<span>Lines</span></button>
            <span class="spacer"></span>
            <button class="foot-btn nav-btn" id="f-prev" title="Previous line (←)">${Icon('left')}</button>
            <button class="foot-btn nav-btn" id="f-next" title="Next line (→)">${Icon('right')}</button>
          </div>
        </aside>
      </div>`;

    const play = $('#play', main);
    const boardEl = $('#board', main);
    const board = new Board(boardEl, {
      pieceSet: S.pieceSet, coords: S.showCoords, orientation: side, showLegal: S.showLegal,
      onMove: (from, to) => userMove(from, to),
      legalMoves: (sq) => T.chess.moves({ square: sq, verbose: true }).map(m => ({ to: m.to, capture: !!m.captured })),
      onBoardClick: () => { if (T.status === 'wrong' && T.mode !== 'time') { undoWrong(); return false; } return false; },
    });
    const progressBar = document.getElementById('line-progress');

    /* ---------------- layout ---------------- */
    function layout() {
      const W = Math.min(window.innerWidth, document.documentElement.clientWidth);
      const H = Math.min(window.innerHeight, document.documentElement.clientHeight || window.innerHeight);
      const narrow = W <= 860;
      const topH = 60;
      let bs;
      if (narrow) bs = Math.min(W - 20, (H - topH) * 0.72);
      else {
        const h = H - topH - 36 - 56;
        const w = W - (W <= 1080 ? 360 : 410) - 22 - 30 - 8 - 44;
        bs = Math.min(h, w);
      }
      if (S.boardMax > 0) bs = Math.min(bs, S.boardMax);
      bs = Math.max(240, Math.floor(bs / 8) * 8);
      play.style.setProperty('--bs', bs + 'px');
    }
    layout();
    window.addEventListener('resize', layout);

    /* ---------------- helpers ---------------- */
    const later = (fn, ms) => { const id = setTimeout(() => { T.timers.delete(id); fn(); }, ms); T.timers.add(id); return id; };
    const clearTimers = () => { T.timers.forEach(clearTimeout); T.timers.clear(); };
    const isStudent = (ply) => Courses.isStudentPly(side, ply);
    const lineNo = (line) => line ? course.lines.indexOf(line) + 1 : '';

    function setProgress() {
      if (!progressBar) return;
      const on = !!T.line && T.mode !== 'lines';
      progressBar.parentElement.classList.toggle('on', on);
      if (!on) return;
      const len = T.line.moves.length - T.start;
      progressBar.style.width = (Math.max(0, T.ply - T.start) / Math.max(1, len) * 100) + '%';
      progressBar.style.background = MODES[T.mode] ? MODES[T.mode].color : 'var(--learn)';
    }

    function setEval() {
      const bar = $('#evalbar', main);
      if (!bar) return;
      let v = null;
      if (T.line && T.ply > 0 && T.status !== 'wrong') v = T.line.evals[T.ply - 1];
      if (v == null) v = T.ply === 0 ? 20 : T.lastEval;
      T.lastEval = v;
      const mate = Math.abs(v) >= 19000;
      const wc = mate ? (v > 0 ? 1 : -1) : 2 / (1 + Math.exp(-0.00368208 * v)) - 1;
      $('.fill', bar).style.height = (50 + 50 * wc) + '%';
      let txt;
      if (mate) { const plies = 30000 - Math.abs(v); txt = Math.abs(v) <= 20000 ? '#' : 'M' + Math.max(1, Math.ceil(plies / 2)); }
      else txt = (Math.abs(v) / 100).toFixed(1);
      $('.lbl.lo', bar).textContent = v >= 0 ? txt : '';
      $('.lbl.hi', bar).textContent = v < 0 ? txt : '';
    }

    function setMaterial() {
      if (!S.showMaterial) { $('#mat-top', main).innerHTML = ''; $('#mat-bot', main).innerHTML = ''; return; }
      const start = { p: 8, n: 2, b: 2, r: 2, q: 1 };
      const have = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
      for (const row of T.chess.board()) for (const p of row) if (p && p.type !== 'k') have[p.color][p.type]++;
      let score = 0;
      for (const t of 'pnbrq') score += (have.w[t] - have.b[t]) * VAL[t];
      const strip = (color) => { // pieces captured BY color
        const o = color === 'w' ? 'b' : 'w';
        let html = '';
        for (const t of 'qrbnp') {
          const n = Math.max(0, start[t] - have[o][t]);
          for (let i = 0; i < n; i++) html += `<img src="pieces/${S.pieceSet}/${o}${t.toUpperCase()}.svg" class="${i === 0 && html ? 'gap' : ''}" alt="">`;
        }
        const adv = color === 'w' ? score : -score;
        return html + (adv > 0 ? `<span>+${adv}</span>` : '');
      };
      $('#mat-top', main).innerHTML = strip(opp);
      $('#mat-bot', main).innerHTML = strip(side);
    }

    function lastMoveMarks(mv) {
      board.setMarks({ last: mv ? [mv.from, mv.to] : [], check: T.chess.in_check() ? kingSquare(T.chess, T.chess.turn()) : null, hint: [], wrong: [] });
    }
    function kingSquare(chess, color) {
      const b = chess.board();
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const p = b[i][j]; if (p && p.type === 'k' && p.color === color) return 'abcdefgh'[j] + (8 - i); }
      return null;
    }

    /* ---------------- side panel ---------------- */
    function setHead() {
      const m = MODES[T.mode] || MODES.learn;
      $('#mode-ico', main).innerHTML = `<span style="color:${m.color}">${Icon(m.icon, 'mode-ico')}</span>`;
      $('#mode-name', main).textContent = m.label;
      $('#line-num', main).textContent = T.line ? '#' + lineNo(T.line) : '';
      const f = Courses.focusOf(course);
      $('.side-head .course', main).textContent = f ? shortName(f) : course.name;
      $('.side-head .course', main).title = f ? 'Focused on ' + f : course.name;
    }

    function bubble(html, actions = []) {
      const b = $('#bubble', main);
      b.innerHTML = html + (actions.length ? `<div class="acts">${actions.map((a, i) => `<button class="btn sm ${a.primary ? 'primary' : ''}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div>` : '');
      b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
      $$('.acts button', b).forEach(btn => btn.onclick = (e) => { e.stopPropagation(); actions[+btn.dataset.i].fn(); });
    }

    function renderModes() {
      const el = $('#modes', main);
      if (!T.showModes) { el.innerHTML = ''; el.classList.add('hidden'); return; }
      el.classList.remove('hidden');
      const st = Courses.stats(course);
      const un = Courses.unlocks(course);
      const p = Courses.peek(course.id) || {};
      const dots = (u) => `<span class="lock">${Icon('lock')}<span class="dots">${Array.from({ length: u.need }, (_, i) => `<i class="${i < u.have ? 'on' : ''}"></i>`).join('')}</span></span>`;
      const right = {
        learn: `<b>${st.learned}/${st.total}</b><small>discovered</small>`,
        practice: un.practice.open ? `<b>${st.perfected}/${st.learned}</b><small>perfected</small>` : `${dots(un.practice)}<small>${un.practice.need - un.practice.have} line away</small>`,
        drill: un.drill.open ? `<b>${p.drillBest || 0}</b><small>best</small>` : dots(un.drill),
        time: un.time.open ? `<b>${p.timeBest || 0}</b><small>best</small>` : dots(un.time),
        puzzles: un.puzzles.none ? '<small>none</small>' : un.puzzles.open ? `<b>${st.puzzlesSolved}/${st.puzzles}</b><small>solved</small>` : dots(un.puzzles),
        lines: `<b>${st.all}</b><small>lines</small>`,
      };
      const tile = (k, big) => {
        const m = MODES[k], u = un[k];
        const locked = !u.open;
        return `<button class="mode ${k} ${big ? 'big' : ''} ${T.mode === k && T.mode !== 'lines' ? 'on' : ''} ${locked ? 'locked' : ''}" data-mode="${k}" title="${locked ? (u.none ? 'This course has no puzzles' : `Unlocks after ${u.need} ${k === 'practice' || k === 'puzzles' ? 'learned' : 'perfected'} line${u.need > 1 ? 's' : ''}`) : m.label}">
          ${Icon(m.icon, 'ico')}<span><span class="t">${m.label}</span>${big ? `<span class="s">${m.sub}</span>` : ''}</span><span class="r">${right[k]}</span></button>`;
      };
      el.innerHTML = tile('learn', true) + tile('practice', true) + tile('drill') + tile('time') + tile('puzzles') + tile('lines');
      $$('.mode', el).forEach(b => b.onclick = () => {
        const k = b.dataset.mode;
        if (b.classList.contains('locked')) { b.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], { duration: 260 }); return; }
        if (k === 'lines') return openLines();
        startMode(k);
      });
    }

    function renderFoot() {
      const act = $('#f-act', main);
      act.classList.remove('solve');
      act.disabled = false;
      if (T.status === 'wrong' && T.mode !== 'time') { act.innerHTML = `${Icon('undo')}<span>Undo</span>`; act.onclick = undoWrong; act.title = 'Undo'; }
      else if (T.status === 'done' || T.status === 'over') { act.innerHTML = `${Icon('restart')}<span>Restart</span>`; act.onclick = restartLine; act.title = 'Restart this line'; act.disabled = T.mode === 'time' || T.mode === 'drill'; }
      else if (T.hintLevel >= 1) { act.innerHTML = `${Icon('solve')}<span>Solve</span>`; act.onclick = hint; act.classList.add('solve'); act.title = 'Play the move'; }
      else { act.innerHTML = `${Icon('hint')}<span>Hint</span>`; act.onclick = hint; act.title = 'Hint (H)'; act.disabled = T.status !== 'student' || T.mode === 'drill' || T.mode === 'time'; }
      $('#f-mode', main).classList.toggle('on', T.showModes);
      $('#f-prev', main).disabled = T.histPos <= 0;
      $('#f-next', main).disabled = T.mode === 'time' || T.mode === 'drill' && T.status !== 'done' && T.status !== 'over';
    }

    function renderHud() {
      const hud = $('#hud', main);
      if (T.mode === 'time' && T.time) {
        const t = Math.max(0, T.time.left);
        hud.innerHTML = `<div class="timer"><span class="t ${t < 10 ? 'low' : ''}" id="tleft">${t < 10 ? t.toFixed(1) : Math.ceil(t)}</span><span class="muted small">seconds<br>×${T.time.speed.toFixed(1)} speed</span><span class="score">${T.time.lines} lines<small>best ${Courses.prog(course.id).timeBest || 0}</small></span></div>`;
      } else if (T.mode === 'drill' && T.drill) {
        hud.innerHTML = `<div class="streakbox">${Icon('drill')}<span class="n">${T.drill.streak}</span><span>in a row<small>best ${Courses.prog(course.id).drillBest || 0}</small></span></div>`;
      } else hud.innerHTML = '';
    }

    function render() { setHead(); renderModes(); renderFoot(); renderHud(); setProgress(); updateStreak(); }

    function updateStreak() {
      const el = document.getElementById('streak');
      if (!el) return;
      const n = Courses.streak();
      el.querySelector('.n').textContent = n;
      el.classList.toggle('lit', Courses.trainedToday());
    }

    /* ---------------- prompts ---------------- */
    function prompt() {
      const line = T.line;
      const san = line.moves[T.ply];
      const instr = instruction(san, new Chess(T.chess.fen()));
      const note = line.notes[T.ply];
      const prevMark = T.ply > 0 ? line.marks[T.ply - 1] : null;
      const firstStudent = T.ply === T.start || (T.ply === T.start + 1 && !isStudent(T.start));
      if (T.mode === 'learn') {
        bubble(`${note ? esc(note) : ''}<span class="instr" ${note ? '' : 'style="margin-top:0"'}>${esc(instr)}</span>`);
      } else if (T.mode === 'puzzles') {
        if (T.ply === T.start) {
          const b = line.moves[T.start - 1];
          bubble(`${oppName} just played <b>${esc(b)}${esc(line.marks[T.start - 1] || '')}</b>. That's a mistake! Find the best way to punish it.`);
        } else bubble(pickOne(['Keep going!', 'Good. What now?', 'Continue the attack.', 'And the follow-up?']));
      } else if (T.mode === 'time') {
        bubble(pickOne(['Go!', 'Quick!', 'Next move?', 'Keep it up!']));
      } else {
        if (prevMark && /\?/.test(prevMark)) bubble(`${oppName} played ${esc(line.moves[T.ply - 1])}${esc(prevMark)}. How do we punish it?`);
        else if (T.ply === 0) bubble('How do we start this opening?');
        else if (firstStudent) bubble('How do we respond?');
        else bubble(pickOne(['How do we continue this opening?', 'What is our move here?', 'How do we continue?', 'Your move.']));
      }
    }

    /* ---------------- line flow ---------------- */
    function startMode(mode, line) {
      clearTimers();
      closeDrawer();
      if (mode !== 'time') stopTimer();
      T.mode = mode;
      if (mode === 'drill') T.drill = { streak: 0 };
      if (mode === 'time') { T.time = { left: 60, lines: 0, speed: 1, running: false, last: 0 }; }
      if (mode === 'puzzles') {
        const z = line && line.puzzle ? line.puzzle : Courses.pickPuzzle(course, T.puzzle && T.puzzle.id);
        if (!z) return noLines('This course has no puzzles yet.');
        return startLine(z.line, z);
      }
      const l = line || Courses.pick(course, mode, T.line && T.line.id);
      if (!l) {
        if (mode === 'learn') return allLearned();
        return noLines('Nothing to practise yet. Learn a line first!');
      }
      startLine(l);
    }

    function noLines(msg) {
      T.status = 'idle'; T.showModes = true;
      bubble(esc(msg));
      render();
    }

    function allLearned() {
      T.status = 'idle'; T.showModes = true; T.line = null;
      const depth = Courses.depthOf(course);
      const ess = Courses.essentials(course).length;
      const acts = [{ label: 'Practice', primary: true, fn: () => startMode('practice') }];
      if (!Courses.focusOf(course) && depth === 'ess' && ess < course.lines.length) acts.push({ label: `Go Full Mastery (${course.lines.length} lines)`, fn: () => { Courses.setDepth(course, 'full'); startMode('learn'); } });
      const focus = Courses.focusOf(course);
      if (focus) acts.push({ label: 'Train everything', fn: () => { Courses.setFocus(course, null); startMode('learn'); } });
      bubble(`You've discovered every line ${focus ? 'in ' + esc(shortName(focus)) : depth === 'ess' ? 'in the Essentials' : 'in this course'}! Now perfect them in Practice.`, acts);
      board.setPosition(T.chess, true);
      render();
    }

    function startLine(line, puzzle, fromHistory) {
      clearTimers();
      T.line = line; T.puzzle = puzzle || null;
      T.start = puzzle ? puzzle.start : 0;
      T.mistakes = 0; T.hints = 0; T.hintLevel = 0; T.wrongMove = null;
      T.status = 'loading';
      T.showModes = false;
      if (!fromHistory) {
        T.history = T.history.slice(0, T.histPos + 1);
        T.history.push({ line, puzzle, mode: T.mode });
        T.histPos = T.history.length - 1;
      }
      board.setBadges([]);
      board.setArrows([]);
      board.clearUserShapes();
      T.chess = new Chess();
      let mv = null;
      for (let i = 0; i < T.start; i++) mv = T.chess.move(line.moves[i], { sloppy: true });
      T.ply = T.start;
      const animateFromCurrent = !puzzle;
      board.setPosition(T.chess, animateFromCurrent);
      lastMoveMarks(mv);
      if (puzzle && mv && line.marks[T.start - 1]) board.addBadge({ sq: mv.to, type: line.marks[T.start - 1] === '??' ? 'blunder' : 'mistake', text: line.marks[T.start - 1] });
      setEval(); setMaterial();
      // keep the mode panel visible until the student starts playing (like ChessReps)
      T.showModes = T.mode === 'learn' && T.ply === 0 && T.history.length <= 1;
      render();
      if (T.mode === 'time' && !T.time.running) startTimer();
      advance(true);
    }

    function advance(first) {
      if (T.ply >= T.line.moves.length) return complete();
      if (isStudent(T.ply)) {
        T.status = 'student';
        board.setInteractive(side);
        prompt();
        renderFoot();
      } else {
        T.status = 'opp';
        board.setInteractive(null);
        if (T.mode !== 'learn' && T.mode !== 'time' && !first) bubble(`Okay, ${oppName}'s turn.`);
        const delay = T.mode === 'time' ? Math.min(250, S.opponentDelay) : first ? Math.max(350, S.opponentDelay) : S.opponentDelay;
        later(playOpponent, delay);
        renderFoot();
      }
    }

    function playOpponent() {
      if (T.status !== 'opp') return;
      const san = T.line.moves[T.ply];
      const mv = T.chess.move(san, { sloppy: true });
      if (!mv) { console.error('bad line', T.line); return complete(); }
      board.setPosition(T.chess, true);
      lastMoveMarks(mv);
      Sound.forMove(mv, T.chess);
      board.setBadges([]);
      const mark = T.line.marks[T.ply];
      if (mark) board.addBadge({ sq: mv.to, type: mark === '??' ? 'blunder' : mark === '?' ? 'mistake' : 'inacc', text: mark });
      T.ply++;
      setEval(); setMaterial(); setProgress();
      advance();
    }

    function userMove(from, to) {
      if (T.status === 'wrong') { undoWrong(true); }
      if (T.status !== 'student') return false;
      const expected = T.line.moves[T.ply];
      const legal = T.chess.moves({ verbose: true }).filter(m => m.from === from && m.to === to);
      if (!legal.length) return false;
      const exp = new Chess(T.chess.fen()).move(expected, { sloppy: true });
      const promo = exp && exp.from === from && exp.to === to ? exp.promotion : (legal.find(m => m.promotion === 'q') ? 'q' : undefined);
      const instr = instruction(expected, new Chess(T.chess.fen()));
      const mv = T.chess.move({ from, to, promotion: promo });
      if (!mv) return false;
      board.setPosition(T.chess, true);
      if (stripSan(mv.san) === stripSan(expected)) correct(mv);
      else wrong(mv, exp, instr);
      return true;
    }

    function correct(mv) {
      Sound.forMove(mv, T.chess);
      lastMoveMarks(mv);
      board.setBadges([{ sq: mv.to, type: 'ok' }]);
      T.ply++; T.hintLevel = 0;
      if (T.mode === 'time' && T.time) { T.time.left = Math.min(60, T.time.left + 1.5); }
      if (T.showModes) { T.showModes = false; renderModes(); }
      setEval(); setMaterial(); setProgress();
      advance();
    }

    function wrong(mv, exp, instr) {
      T.mistakes++;
      T.status = 'wrong';
      T.wrongMove = mv;
      board.setInteractive(side);
      Sound.play('error');
      lastMoveMarks(mv);
      board.setBadges([{ sq: mv.to, type: 'bad' }]);
      setMaterial();
            if (T.mode === 'time') {
        T.time.left -= 5;
        renderHud();
        later(() => { undoWrong(true); bubble('-5 seconds! ' + esc(instr)); board.setArrows(exp ? [{ from: exp.from, to: exp.to }] : []); }, 450);
        return renderFoot();
      }
      if (T.mode === 'drill') {
        later(() => drillOver(exp, instr), 500);
        return renderFoot();
      }
      if (T.mode === 'learn') bubble(`Not quite. This course recommends something else: <b>${esc(instr.charAt(0).toLowerCase() + instr.slice(1))}</b>`, [{ label: 'Try again', primary: true, fn: () => undoWrong() }]);
      else bubble(pickOne(['That\'s not the move we\'re looking for.', 'Not this time.', 'Hmm, that\'s not it.']), [
        { label: 'Try again', primary: true, fn: () => undoWrong() },
        { label: 'Show me', fn: () => { undoWrong(true); showAnswer(); } },
      ]);
      renderFoot();
    }

    function undoWrong(silent) {
      if (T.status !== 'wrong') return;
      T.chess.undo();
      T.wrongMove = null;
      board.setPosition(T.chess, true);
      const h = T.chess.history({ verbose: true });
      lastMoveMarks(h[h.length - 1] || null);
      board.setBadges([]);
      setMaterial();
      T.status = 'student';
      if (!silent) prompt();
      renderFoot();
    }

    function showAnswer() {
      const exp = new Chess(T.chess.fen()).move(T.line.moves[T.ply], { sloppy: true });
      if (!exp) return;
      T.hints++;
      T.hintLevel = 1;
      board.setArrows([{ from: exp.from, to: exp.to }]);
      board.setMarks({ hint: [exp.from] });
      bubble(`The move is <b>${esc(T.line.moves[T.ply])}</b>. ${esc(instruction(T.line.moves[T.ply], new Chess(T.chess.fen())))}`);
      renderFoot();
    }

    function hint() {
      if (T.status !== 'student' || T.mode === 'drill' || T.mode === 'time') return;
      const exp = new Chess(T.chess.fen()).move(T.line.moves[T.ply], { sloppy: true });
      if (!exp) return;
      if (T.hintLevel === 0) {
        T.hintLevel = 1; T.hints++;
        board.setMarks({ hint: [exp.from] });
        Sound.play('select');
        renderFoot();
      } else {
        // Solve: play the move for the student
        T.hints++;
        board.setArrows([]);
        const mv = T.chess.move(T.line.moves[T.ply], { sloppy: true });
        board.setPosition(T.chess, true);
        correct(mv);
      }
    }

    function complete() {
      T.status = 'done';
      board.setInteractive(null);
      board.setArrows([]);
      const rect = boardEl.getBoundingClientRect();
      const mated = T.chess.in_checkmate();
      const last = T.chess.history({ verbose: true }).slice(-1)[0];
      const badges = last ? [{ sq: last.to, type: 'ok' }] : [];
      if (mated) {
        const loser = T.chess.turn();
        badges.push({ sq: kingSquare(T.chess, loser), type: 'mate', text: '#' });
        badges.push({ sq: kingSquare(T.chess, loser === 'w' ? 'b' : 'w'), type: 'win' });
      }
      board.setBadges(badges);
      const res = Courses.record(course, T.line, { mode: T.mode, mistakes: T.mistakes, hints: T.hints, puzzleId: T.puzzle && T.puzzle.id });
      if (res.firstToday) { const el = document.getElementById('streak'); if (el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } }
      const evalW = T.line.evals[T.line.moves.length - 1];
      const ev = evalW == null ? null : side === 'w' ? evalW : -evalW;
      const evalTxt = ev == null ? '' : ev >= 19000 ? '' : ev >= 250 ? ' We\'re winning here.' : ev >= 90 ? ' We\'re clearly better.' : ev >= -60 ? ' A good, playable position.' : ' A sharp position with chances for both sides.';
      const nameTxt = `<span class="line-name">${esc(T.line.name)}</span>`;

      if (T.mode === 'drill') {
        T.drill.streak++;
        const p = Courses.prog(course.id);
        if (T.drill.streak > (p.drillBest || 0)) { p.drillBest = T.drill.streak; Store.save(); }
        Sound.play('confirm');
        Confetti.stars(rect, { count: 22 });
        bubble(pickOne(['Correct!', 'Nailed it!', 'Perfect!', 'Next one!']));
        renderHud();
        later(() => startMode2('drill'), 900);
        return render();
      }
      if (T.mode === 'time') {
        T.time.lines++;
        T.time.speed = 1 + T.time.lines * 0.1;
        Sound.play('confirm');
        renderHud();
        later(() => startMode2('time'), 250);
        return;
      }

      Sound.play(mated || res.clean ? 'victory' : 'confirm');
      Confetti.stars(rect);
      T.showModes = true;
      const st = Courses.stats(course);
      let msg;
      if (T.mode === 'learn') {
        msg = (mated ? pickOne(['And that is checkmate! Pretty cool!', 'Checkmate! What a finish.']) : pickOne(['The end! Nicely played.', 'Line complete!', 'That\'s the line!'])) + evalTxt +
          (res.newlyLearned ? ` You've discovered ${st.learned} of ${st.total} lines.` : '');
      } else if (T.mode === 'puzzles') {
        msg = res.clean ? pickOne(['Puzzle solved!', 'Excellent, that\'s how to punish it!', 'Brilliant!']) : `Solved, with ${T.mistakes + T.hints} slip${T.mistakes + T.hints > 1 ? 's' : ''}. Try it again later.`;
      } else {
        msg = res.clean ? (res.newlyPerfect ? 'Perfect! This line is now perfected.' : pickOne(['Perfect!', 'Flawless!', 'Spot on!'])) : `Done, with ${T.mistakes} mistake${T.mistakes === 1 ? '' : 's'}${T.hints ? ` and ${T.hints} hint${T.hints > 1 ? 's' : ''}` : ''}. We'll come back to this line soon.`;
      }
      const nextLabel = T.mode === 'learn' ? (Courses.pick(course, 'learn') ? 'Next line' : 'Practice') : 'Next line';
      bubble(esc(msg) + nameTxt, [{ label: nextLabel + ' →', primary: true, fn: next }]);
      render();
      // nudge towards a newly unlocked mode
      const un = Courses.unlocks(course);
      const glow = (k) => { const b = $(`.mode.${k}`, main); if (b) b.classList.add('glow'); };
      if (T.mode === 'learn' && un.practice.open && st.learned === 1) glow('practice');
      if (res.newlyPerfect && st.perfected === Courses.NEED.drill) glow('drill');
      if (S.autoNext && (T.mode === 'learn' || T.mode === 'practice' || T.mode === 'puzzles')) later(next, 1600);
    }

    // continue in the same mode without resetting drill/time state
    function startMode2(mode) {
      const l = Courses.pick(course, mode, T.line && T.line.id);
      if (!l) return mode === 'drill' ? drillOver(null, '', true) : timeOver();
      startLine(l);
    }

    function drillOver(exp, instr, ranOut) {
      T.status = 'over';
      board.setInteractive(null);
      if (exp) board.setArrows([{ from: exp.from, to: exp.to }]);
      const p = Courses.prog(course.id);
      const n = T.drill ? T.drill.streak : 0;
      Courses.record(course, T.line, { mode: 'practice', mistakes: 1, hints: 0 });
      Sound.play('error');
      T.showModes = true;
      bubble(`${ranOut ? 'You ran out of lines!' : `Drill over! The right move was <b>${esc(exp ? exp.san : '')}</b> (${esc(instr.charAt(0).toLowerCase() + instr.slice(1, -1))}).`}<br>You recalled <b>${n}</b> line${n === 1 ? '' : 's'} in a row. Best: <b>${p.drillBest || 0}</b>.`,
        [{ label: 'Drill again', primary: true, fn: () => startMode('drill') }, { label: 'Practice', fn: () => startMode('practice') }]);
      render();
    }

    /* ---------------- time trial ---------------- */
    let raf = null;
    function startTimer() {
      T.time.running = true; T.time.last = performance.now();
      const tick = (now) => {
        if (!T.time || !T.time.running) return;
        const dt = (now - T.time.last) / 1000; T.time.last = now;
        T.time.left -= dt * T.time.speed;
        const el = $('#tleft', main);
        if (el) { const t = Math.max(0, T.time.left); el.textContent = t < 10 ? t.toFixed(1) : Math.ceil(t); el.classList.toggle('low', t < 10); }
        if (T.time.left <= 0) return timeOver();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    function stopTimer() { if (raf) cancelAnimationFrame(raf); raf = null; if (T.time) T.time.running = false; }
    function timeOver() {
      stopTimer();
      clearTimers();
      T.status = 'over';
      board.setInteractive(null);
      const p = Courses.prog(course.id);
      const n = T.time ? T.time.lines : 0;
      const best = n > (p.timeBest || 0);
      if (best) { p.timeBest = n; Store.save(); }
      Sound.play(best ? 'victory' : 'notify');
      if (best && n > 0) Confetti.burst({});
      T.showModes = true;
      bubble(`Time's up! You completed <b>${n}</b> line${n === 1 ? '' : 's'}.${best && n ? ' A new record!' : ` Best: <b>${p.timeBest || 0}</b>.`}`,
        [{ label: 'Play again', primary: true, fn: () => startMode('time') }]);
      render();
    }

    /* ---------------- navigation ---------------- */
    function next() {
      if (T.mode === 'drill' || T.mode === 'time') return;
      if (T.mode === 'learn' && !Courses.pick(course, 'learn')) return allLearned();
      startMode(T.mode || 'learn');
    }
    function prevLine() {
      if (T.histPos <= 0) return;
      T.histPos--;
      const h = T.history[T.histPos];
      T.mode = h.mode;
      startLine(h.line, h.puzzle, true);
    }
    function nextLine() {
      if (T.histPos < T.history.length - 1) {
        T.histPos++;
        const h = T.history[T.histPos];
        T.mode = h.mode;
        return startLine(h.line, h.puzzle, true);
      }
      next();
    }
    function restartLine() { if (T.line) startLine(T.line, T.puzzle, true); }

    /* ---------------- lines drawer ---------------- */
    function openLines() {
      closeDrawer();
      const sideEl = $('#side', main);
      const d = document.createElement('div');
      d.className = 'drawer';
      const focus = Courses.focusOf(course);
      const row = (l) => {
        const s = Courses.lpPeek(course, l) || {};
        const cls = !s.learned ? '' : s.lastMistakes > 0 ? 'shaky' : s.perfect ? 'perfect' : 'learned';
        const label = !s.learned ? (l.idx + 1) : s.perfect ? '★' : s.lastMistakes > 0 ? '!' : '✓';
        return `<div class="lrow ${T.line === l ? 'cur' : ''}" data-id="${l.id}"><span class="st ${cls}">${label}</span><div class="txt"><div class="nm" title="${esc(l.name)}">#${l.idx + 1} ${esc(shortName(l.name))}</div><div class="mv">${esc(PGN.format(l.moves))}</div></div><div class="flags">${l.trap ? '<span class="tag gambit" title="Contains a trap to punish">trap</span>' : ''}${l.ess ? '' : '<span class="tag" title="Full Mastery line">+</span>'}</div></div>`;
      };
      const groups = Courses.groups(course);
      d.innerHTML = `<div class="drawer-head">${Icon('lines')}<span class="grow">Lines · ${course.lines.length}</span><button class="icon-btn" id="d-close" title="Close">${Icon('x')}</button></div>
        <div class="drawer-body">
          ${focus ? `<div class="focus-bar">${Icon('practice')}<span class="grow">Focused on <b>${esc(shortName(focus))}</b></span><button class="btn sm" id="d-unfocus">Train everything</button></div>` : `<p class="faint small" style="padding:4px 10px 8px">Pick a variation and press <b>Focus</b> to train only that version of the opening.</p>`}
          ${groups.map(g => `<div class="lgroup ${focus === g.name ? 'on' : ''}"><div class="lgroup-head"><span class="grow" title="${esc(g.name)}">${esc(shortName(g.name))}</span><span class="faint small">${g.lines.length}</span>${focus === g.name ? '<span class="tag mine">focused</span>' : `<button class="btn sm" data-focus="${esc(g.name)}">Focus</button>`}</div>${g.lines.map(row).join('')}</div>`).join('')}
        </div>`;
      sideEl.appendChild(d);
      T.drawer = d;
      $('#d-close', d).onclick = closeDrawer;
      const unf = $('#d-unfocus', d);
      if (unf) unf.onclick = () => { Courses.setFocus(course, null); closeDrawer(); render(); startMode(T.mode === 'learn' || T.mode === 'practice' ? T.mode : 'learn'); };
      $$('[data-focus]', d).forEach(b => b.onclick = (e) => {
        e.stopPropagation();
        Courses.setFocus(course, b.dataset.focus);
        closeDrawer();
        const st = Courses.stats(course);
        startMode(st.learned < st.total ? 'learn' : 'practice');
      });
      $$('.lrow', d).forEach(r => r.onclick = () => {
        const l = course.lines.find(x => x.id === r.dataset.id);
        const s = Courses.lpPeek(course, l);
        closeDrawer();
        T.mode = s && s.learned ? 'practice' : 'learn';
        startLine(l);
      });
      const cur = $('.lrow.cur', d); if (cur) cur.scrollIntoView({ block: 'center' });
    }
    function closeDrawer() { if (T.drawer) { T.drawer.remove(); T.drawer = null; } }

    /* ---------------- settings popover ---------------- */
    function openSettings(e) {
      closePop();
      const btn = $('#f-settings', main);
      const pop = document.createElement('div');
      pop.className = 'popover';
      const depth = Courses.depthOf(course);
      const ess = Courses.essentials(course).length;
      pop.innerHTML = `
        ${ess < course.lines.length ? `<h4>Depth</h4>
        <button class="item" data-a="ess">🌱 Essentials · ${ess} lines ${depth === 'ess' ? `<span class="chk">${Icon('check')}</span>` : ''}</button>
        <button class="item" data-a="full">👑 Full Mastery · ${course.lines.length} lines ${depth !== 'ess' ? `<span class="chk">${Icon('check')}</span>` : ''}</button><div class="sep"></div>` : ''}
        <h4>Board</h4>
        <button class="item" data-a="sound">${S.sound ? '🔊' : '🔈'} Sound ${S.sound ? `<span class="chk">${Icon('check')}</span>` : ''}</button>
        <button class="item" data-a="eval">📊 Evaluation bar ${S.evalBar ? `<span class="chk">${Icon('check')}</span>` : ''}</button>
        <button class="item" data-a="coords">🔤 Coordinates ${S.showCoords ? `<span class="chk">${Icon('check')}</span>` : ''}</button>
        <button class="item" data-a="auto">⏭ Auto-continue ${S.autoNext ? `<span class="chk">${Icon('check')}</span>` : ''}</button>
        <div class="sep"></div>
        <button class="item" data-a="pgn">${Icon('download')} Export course as PGN</button>
        ${course.custom ? `<button class="item" data-a="edit">${Icon('edit')} Edit course</button>` : ''}
        <button class="item danger" data-a="reset">${Icon('trash')} Reset course progress</button>`;
      document.body.appendChild(pop);
      const r = btn.getBoundingClientRect();
      const pr = pop.getBoundingClientRect();
      pop.style.left = Math.max(8, Math.min(r.left, innerWidth - pr.width - 8)) + 'px';
      pop.style.top = Math.max(8, r.top - pr.height - 8) + 'px';
      pop.style.position = 'fixed';
      T.pop = pop;
      $$('.item', pop).forEach(b => b.onclick = () => {
        const a = b.dataset.a;
        closePop();
        if (a === 'ess' || a === 'full') { Courses.setDepth(course, a); render(); if (T.mode === 'learn' && T.status !== 'student') startMode('learn'); }
        if (a === 'sound') { S.sound = !S.sound; Store.save(); }
        if (a === 'eval') { S.evalBar = !S.evalBar; Store.save(); $('#evalbar', main).classList.toggle('hidden', !S.evalBar || !hasEvals); }
        if (a === 'coords') { S.showCoords = !S.showCoords; Store.save(); board.setCoords(S.showCoords); }
        if (a === 'auto') { S.autoNext = !S.autoNext; Store.save(); }
        if (a === 'pgn') App.download(course.id + '.pgn', PGN.courseToPgn({ name: course.name, side: course.side, lines: course.lines.map(l => ({ m: l.moves.join(' '), n: l.notes, k: l.marks })) }));
        if (a === 'edit') location.hash = '#/create/' + encodeURIComponent(course.id);
        if (a === 'reset') App.confirm('Reset progress?', `This clears everything you have learned in <b>${esc(course.name)}</b>.`, 'Reset').then(ok => { if (ok) { Courses.resetProgress(course); Courses.setDepth(course, depth || 'full'); startMode('learn'); } });
      });
      setTimeout(() => document.addEventListener('mousedown', onDocDown), 0);
    }
    function onDocDown(e) { if (T.pop && !T.pop.contains(e.target)) closePop(); }
    function closePop() { if (T.pop) { T.pop.remove(); T.pop = null; document.removeEventListener('mousedown', onDocDown); } }

    /* ---------------- wiring ---------------- */
    $('#f-settings', main).onclick = openSettings;
    $('#f-mode', main).onclick = () => { T.showModes = !T.showModes; renderModes(); renderFoot(); };
    $('#f-lines', main).onclick = () => T.drawer ? closeDrawer() : openLines();
    $('#f-prev', main).onclick = prevLine;
    $('#f-next', main).onclick = nextLine;

    function onKey(e) {
      if (e.target.closest('input, textarea, select') || document.querySelector('.modal-back')) return;
      if (e.key === 'h' || e.key === 'H') { e.preventDefault(); hint(); }
      else if (e.key === 'Escape') { if (T.drawer) closeDrawer(); else { T.showModes = !T.showModes; renderModes(); renderFoot(); } }
      else if (e.key === 'ArrowLeft') prevLine();
      else if (e.key === 'ArrowRight') nextLine();
      else if (e.key === ' ' || e.key === 'Enter') {
        if (T.status === 'done') { e.preventDefault(); next(); }
        else if (T.status === 'wrong' && T.mode !== 'time') { e.preventDefault(); undoWrong(); }
      } else if (e.key === 'Backspace' && T.status === 'wrong') { e.preventDefault(); undoWrong(); }
    }
    document.addEventListener('keydown', onKey);

    /* ---------------- start ---------------- */
    function begin() {
      const st = Courses.stats(course);
      const mode = opts.mode && MODES[opts.mode] && Courses.unlocks(course)[opts.mode].open ? opts.mode : (st.learned < st.total ? 'learn' : 'practice');
      if (opts.lineId) {
        const l = course.lines.find(x => x.id === opts.lineId);
        if (l) { T.mode = (Courses.lpPeek(course, l) || {}).learned ? 'practice' : 'learn'; return startLine(l); }
      }
      startMode(mode);
    }
    board.setPosition(T.chess, false);
    setEval(); setMaterial();
    render();
    bubble('Loading…');
    if (!Courses.depthOf(course)) askDepth(course).then(() => begin());
    else begin();

    return () => {
      clearTimers(); stopTimer(); closePop();
      window.removeEventListener('resize', layout);
      document.removeEventListener('keydown', onKey);
      if (progressBar) progressBar.parentElement.classList.remove('on');
    };
  }

  function askDepth(course) {
    const ess = Courses.essentials(course).length, all = course.lines.length;
    return new Promise(resolve => {
      const back = document.createElement('div'); back.className = 'modal-back';
      back.innerHTML = `<div class="modal"><h2>How deep do you want to go?</h2><div class="sub">${esc(course.name)} · ${all} lines</div>
        <button class="depth-opt on" data-d="ess"><span class="ico">🌱</span><span><b>Essentials</b><span>Most players start here</span></span><span class="n">${ess}<small>lines</small></span></button>
        <button class="depth-opt" data-d="full"><span class="ico">👑</span><span><b>Full Mastery</b><span>Every line in the course</span></span><span class="n">${all}<small>lines</small></span></button>
        <button class="btn primary lg block" id="depth-go" style="margin-top:6px">Start with Essentials ${Icon('arrowRight')}</button>
        <p class="faint small" style="text-align:center;margin-top:12px">You can change this anytime in the course settings.</p></div>`;
      document.body.appendChild(back);
      let choice = 'ess';
      $$('.depth-opt', back).forEach(b => b.onclick = () => {
        choice = b.dataset.d;
        $$('.depth-opt', back).forEach(x => x.classList.toggle('on', x === b));
        $('#depth-go', back).innerHTML = `Start with ${choice === 'ess' ? 'Essentials' : 'Full Mastery'} ${Icon('arrowRight')}`;
      });
      $('#depth-go', back).onclick = () => { Courses.setDepth(course, choice); back.remove(); resolve(choice); };
    });
  }

  return { mount, instruction };
})();
