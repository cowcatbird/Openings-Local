// Generates app/js/courses-data.js from tools/courses.js, a lichess move-frequency book
// (tools/build-book.js) and move scores from the chessdb.cn cloud database (cached on disk).
//
// Usage: node tools/build-courses.js [path/to/book.json] [--only=id1,id2] [--offline]
//
// Each course is a tree: one student move per position, branching on the opponent replies that
// real players choose most often, plus popular blunders that the student learns to punish.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'app/js/chess.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'app/js/openings-data.js'), 'utf8').replace('window.OPENINGS_DB', 'this.OPENINGS_DB'), ctx);
ctx.window = ctx;
vm.runInContext(fs.readFileSync(path.join(ROOT, 'app/js/chess-fix.js'), 'utf8'), ctx);
const Chess = ctx.Chess;

const args = process.argv.slice(2);
const bookPath = args.find(a => !a.startsWith('--')) || path.join(__dirname, 'cache', 'book.json');
const only = (args.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const OFFLINE = args.includes('--offline');
const OUT = (args.find(a => a.startsWith('--out=')) || '').slice(6);

const SPECS = require('./courses.js');
const BOOK = JSON.parse(fs.readFileSync(bookPath, 'utf8'));

/* ------------------------------------------------------------ chessdb cache */
const CACHE_FILE = (args.find(a => a.startsWith('--cache=')) || '').slice(8) || path.join(__dirname, 'cache', 'chessdb.json');
fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {};
let dirty = 0, requests = 0;
function saveCache(force) {
  if (dirty && (force || dirty >= 40)) { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache)); dirty = 0; }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'openings-local-course-builder' }, timeout: 30000 }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}
const fenKey = (fen) => fen.split(' ').slice(0, 4).join(' ');
// Returns [{san, uci, score}] with scores from the side to move's point of view, or null.
async function cdb(fen) {
  const key = fenKey(fen);
  if (key in cache) return cache[key];
  if (OFFLINE) return null;
  const url = 'https://www.chessdb.cn/cdb.php?action=queryall&json=1&board=' + encodeURIComponent(fen);
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      await sleep(120);
      requests++;
      const r = await get(url);
      if (r.status !== 200) { await sleep(2000 * (attempt + 1)); continue; }
      const j = JSON.parse(r.body);
      if (j.status === 'ok' && Array.isArray(j.moves)) {
        const moves = j.moves.map(m => ({ san: m.san, uci: m.uci, score: m.score }));
        cache[key] = moves; dirty++; saveCache();
        return moves;
      }
      if (j.status === 'unknown' && attempt < 3) {
        await get('https://www.chessdb.cn/cdb.php?action=queue&board=' + encodeURIComponent(fen));
        await sleep(2500);
        continue;
      }
      if (j.status === 'checkmate' || j.status === 'stalemate') { cache[key] = []; dirty++; return []; }
      cache[key] = null; dirty++; saveCache();
      return null;
    } catch (e) { await sleep(2000 * (attempt + 1)); }
  }
  return null;
}

/* ------------------------------------------------------------ book */
function bookNode(sans) {
  let n = BOOK;
  for (const s of sans) {
    if (!n[4]) return null;
    n = n[4][s] || n[4][s.replace(/[+#]$/, '')];
    if (!n) return null;
  }
  return n;
}
function bookKids(sans, chess) {
  const n = bookNode(sans);
  if (!n || !n[4]) return { total: n ? n[0] : 0, kids: [] };
  const legal = new Map(chess.moves({ verbose: true }).map(m => [m.san.replace(/[+#]$/, ''), m.san]));
  const kids = [];
  for (const [k, v] of Object.entries(n[4])) {
    const san = legal.get(k.replace(/[+#]$/, ''));
    if (san) kids.push({ san, n: v[0], w: v[1], d: v[2], b: v[3] });
  }
  kids.sort((a, b) => b.n - a.n);
  return { total: n[0], kids };
}

/* ------------------------------------------------------------ opening names */
const NAME_BY_EPD = new Map();
for (const [eco, name, moves] of ctx.OPENINGS_DB) {
  const c = new Chess();
  for (const s of moves.split(' ')) c.move(s);
  const k = fenKey(c.fen());
  const prev = NAME_BY_EPD.get(k);
  if (!prev || name.length < prev.name.length) NAME_BY_EPD.set(k, { eco, name });
}

/* ------------------------------------------------------------ board helpers */
const FILES = 'abcdefgh';
const PIECE = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 50 };
const sq = (f, r) => (f >= 0 && f < 8 && r >= 0 && r < 8) ? FILES[f] + (r + 1) : null;
const fr = (s) => [FILES.indexOf(s[0]), +s[1] - 1];
function attacksFrom(chess, s) {
  const p = chess.get(s); if (!p) return [];
  const [f, r] = fr(s); const out = [];
  const ray = (df, dr) => { let x = f + df, y = r + dr; while (sq(x, y)) { const t = sq(x, y); out.push(t); if (chess.get(t)) break; x += df; y += dr; } };
  const step = (df, dr) => { const t = sq(f + df, r + dr); if (t) out.push(t); };
  switch (p.type) {
    case 'p': { const d = p.color === 'w' ? 1 : -1; step(-1, d); step(1, d); break; }
    case 'n': [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]].forEach(([a, b]) => step(a, b)); break;
    case 'b': [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => ray(a, b)); break;
    case 'r': [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => ray(a, b)); break;
    case 'q': [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => ray(a, b)); break;
    case 'k': [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => step(a, b)); break;
  }
  return out;
}
// how many squares the bishops of `color` reach (used to spot pawn moves that free a bishop)
function bishopScope(chess, color) {
  let n = 0;
  for (const s of SQUARES_LAZY()) { const p = chess.get(s); if (p && p.color === color && p.type === 'b') n += attacksFrom(chess, s).length; }
  return n;
}
const SQUARES_LAZY = () => SQUARES;
function allSquares() { const o = []; for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) o.push(sq(f, r)); return o; }
const SQUARES = allSquares();
function attackers(chess, target, color) {
  return SQUARES.filter(s => { const p = chess.get(s); return p && p.color === color && attacksFrom(chess, s).includes(target); });
}
// Pieces pinned / skewered by a slider standing on s: [{front, behind}]
function pinsFrom(chess, s) {
  const p = chess.get(s); if (!p || !'bqr'.includes(p.type)) return [];
  const dirs = { b: [[1, 1], [1, -1], [-1, 1], [-1, -1]], r: [[1, 0], [-1, 0], [0, 1], [0, -1]] };
  const ds = p.type === 'q' ? dirs.b.concat(dirs.r) : dirs[p.type];
  const [f, r] = fr(s); const out = [];
  for (const [df, dr] of ds) {
    let x = f + df, y = r + dr, first = null;
    while (sq(x, y)) {
      const t = sq(x, y), q = chess.get(t);
      if (q) {
        if (q.color === p.color) break;
        if (!first) first = { sq: t, p: q };
        else { if (VAL[q.type] > VAL[first.p.type]) out.push({ front: first, behind: { sq: t, p: q } }); break; }
      }
      x += df; y += dr;
    }
  }
  return out;
}

/* ------------------------------------------------------------ notes */
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const pick = (arr, key) => arr[hash(key) % arr.length];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function autoNote(o) {
  const { before, after, mv, prev, oppMark, best, key, side, opp, newName, mateIn } = o;
  void prev;
  const parts = [];
  const pieceName = PIECE[mv.piece];
  const capName = mv.captured ? PIECE[mv.captured] : null;
  const isMate = mv.san.includes('#');
  const defendedBefore = mv.captured ? attackers(before, mv.to, opp).length > 0 : false;
  const attackedAfter = attacksFrom(after, mv.to)
    .map(t => ({ t, p: after.get(t) }))
    .filter(x => x.p && x.p.color === opp && x.p.type !== 'p' && x.p.type !== 'k');
  const hitsKing = mv.san.includes('+');
  const queenHit = attackedAfter.find(x => x.p.type === 'q');
  const valuable = attackedAfter.filter(x => VAL[x.p.type] > VAL[mv.piece] || attackers(after, x.t, opp).length === 0);

  if (newName && !oppMark) {
    const short = o.family && newName.startsWith(o.family + ':') ? newName.slice(o.family.length + 1).trim() : newName;
    const last = short.split(',').pop().trim();
    parts.push(pick([`${opp === 'w' ? 'White' : 'Black'} goes for the ${last}.`, `This is the ${last}.`, `We are in the ${last}.`], key + 'n'));
  }

  if (oppMark) {
    parts.push(pick(oppMark === '??'
      ? ['Ouch, that is a blunder!', 'A big mistake from our opponent!', 'That move loses material. Let\'s punish it!']
      : ['That is inaccurate, and we can take advantage.', 'Not the best. Time to punish it.', 'A small slip from our opponent.'], key + 'm'));
    if (isMate) parts.push('Checkmate!');
    else if (mateIn) parts.push(`There is a forced checkmate here.`);
    else if (mv.captured && !defendedBefore) parts.push(`The ${capName} on ${mv.to} was left unprotected. Grab it${hitsKing ? ' with check' : ''}!`);
    else if (mv.captured) parts.push(`Take the ${capName}${hitsKing ? ' with check' : ''}: it wins material.`);
    else if (hitsKing && valuable.length) parts.push(`A fork: check, and the ${PIECE[valuable[0].p.type]} on ${valuable[0].t} is attacked too.`);
    else if (attackedAfter.some(x => x.p.type === 'q')) parts.push('Hit the queen with tempo.');
    else if (pinsFrom(after, mv.to).some(x => x.front.p.color === opp)) parts.push('Pin a piece: it can no longer move safely.');
    else parts.push(pick(['This move wins material.', 'This exploits it best.', 'The strongest reply.'], key + 'w'));
    return parts.join(' ');
  }

  if (isMate) { parts.push(pick(['Checkmate!', 'And that is checkmate!', 'Checkmate. What a finish!'], key)); return parts.join(' '); }
  if (mateIn) parts.push('We have a forced mate on the board.');

  if (before.in_check()) {
    if (mv.piece === 'k') parts.push(pick(['Step out of check.', 'Move the king out of check.'], key));
    else if (mv.captured) parts.push(`Capture the checking ${capName}.`);
    else parts.push(pick([`Block the check with the ${pieceName}.`, `Answer the check by blocking with the ${pieceName}.`], key));
    if (queenHit && mv.piece !== 'q') parts.push('It even attacks the queen!');
    return parts.join(' ');
  }
  if (mv.flags.includes('k') || mv.flags.includes('q')) {
    parts.push(pick(['Castle to get the king to safety.', 'Time to castle: king safe, rook into play.', 'Castle and connect the rooks.'], key));
    return parts.join(' ');
  }
  if (mv.captured) {
    if (prev && prev.captured && prev.to === mv.to) parts.push(pick([`Recapture the ${capName}.`, 'Take back.', `Recapture on ${mv.to}.`], key));
    else if (!defendedBefore) parts.push(pick([`Grab the free ${capName}.`, `The ${capName} on ${mv.to} is unprotected, so we take it.`], key));
    else if (mv.captured === mv.piece && mv.piece !== 'p') parts.push(pick([`Trade off the ${capName}s.`, `Exchange ${capName}s.`], key));
    else if (VAL[mv.captured] > VAL[mv.piece]) parts.push(`Win material: our ${pieceName} takes their ${capName}.`);
    else parts.push(pick([`Take the ${capName}.`, `Capture on ${mv.to}.`], key));
    if (hitsKing) parts.push('With check!');
    return parts.join(' ');
  }
  if (hitsKing) {
    if (valuable.length) parts.push(`Check, and it attacks the ${PIECE[valuable[0].p.type]} too!`);
    else parts.push(pick(['Check! It gains a tempo.', 'A useful check.'], key));
    return parts.join(' ');
  }
  const pins = pinsFrom(after, mv.to).filter(x => x.front.p.color === opp);
  const fromBack = (side === 'w' && mv.from[1] === '1') || (side === 'b' && mv.from[1] === '8');

  if (mv.piece === 'n' && fromBack) parts.push(pick(['Develop the knight toward the centre.', 'Bring the knight out. Knights love central squares.', 'Develop the knight.'], key));
  else if (mv.piece === 'b' && fromBack) {
    if (['g2', 'b2', 'g7', 'b7'].includes(mv.to)) parts.push('Fianchetto: the bishop rules the long diagonal.');
    else if (pins.length) parts.push(`Develop the bishop and pin the ${PIECE[pins[0].front.p.type]} to the ${PIECE[pins[0].behind.p.type]}.`);
    else if (attacksFrom(after, mv.to).includes(side === 'w' ? 'f7' : 'f2')) parts.push(`Develop the bishop, aiming at ${side === 'w' ? 'f7' : 'f2'}.`);
    else parts.push(pick(['Develop the bishop to an active square.', 'Get the bishop into the game.'], key));
  } else if (mv.piece === 'p') {
    const centre = ['d4', 'e4', 'd5', 'e5'];
    const hitsPiece = attacksFrom(after, mv.to).map(t => after.get(t)).find(p => p && p.color === opp && p.type !== 'p');
    if (hitsPiece) parts.push(`Kick the ${PIECE[hitsPiece.type]} with a pawn.`);
    else if (centre.includes(mv.to)) parts.push(pick(['Grab the centre.', 'Take space in the centre.', 'Stake a claim in the centre.'], key));
    else if (attacksFrom(after, mv.to).some(t => { const p = after.get(t); return p && p.color === opp && p.type === 'p' && centre.includes(t); })) parts.push(pick(['Challenge the centre.', 'Strike at the centre.'], key));
    else if (['h3', 'a3', 'h6', 'a6'].includes(mv.to)) parts.push(`A useful little move: it keeps enemy pieces off ${mv.to[0] === 'h' ? 'g' : 'b'}${side === 'w' ? '4' : '5'}.`);
    else if (attacksFrom(after, mv.to).some(t => { const p = after.get(t); return p && p.color === side && p.type === 'p' && centre.includes(t); })) {
      const t = attacksFrom(after, mv.to).find(t => { const p = after.get(t); return p && p.color === side && p.type === 'p' && centre.includes(t); });
      parts.push(pick([`Support the pawn on ${t}.`, `Reinforce our pawn on ${t}.`], key));
    } else if (bishopScope(after, side) > bishopScope(before, side)) parts.push(pick(['Open a diagonal for the bishop.', 'This frees our bishop.'], key));
    else if (['c3', 'c6'].includes(mv.to)) parts.push('Support the centre and give the queen a diagonal.');
    else if (['g3', 'b3', 'g6', 'b6'].includes(mv.to)) parts.push('Prepare to fianchetto the bishop.');
    else if (['f4', 'f5'].includes(mv.to)) parts.push('Push the f-pawn for space and kingside play.');
    else parts.push(pick(['A useful pawn move.', 'Gain some space.'], key));
  } else if (mv.piece === 'q') {
    const targets = attacksFrom(after, mv.to).filter(t => { const p = after.get(t); return p && p.color === opp && attackers(after, t, opp).length === 0; });
    if (queenHit) parts.push('Offer to trade queens, or chase theirs away.');
    else if (targets.length >= 2) parts.push(`The queen hits ${targets.slice(0, 2).join(' and ')} at the same time.`);
    else if (targets.length === 1) parts.push(`Bring the queen out, hitting ${targets[0]}.`);
    else parts.push(pick(['Bring the queen into the game.', 'Activate the queen.'], key));
  } else if (mv.piece === 'r') {
    parts.push(pick(['Bring the rook to an open line.', 'Activate the rook.', 'Put the rook on a central file.'], key));
  } else if (mv.piece === 'k') {
    parts.push('Step the king to safety.');
  } else {
    if (pins.length) parts.push(`Pin the ${PIECE[pins[0].front.p.type]} to the ${PIECE[pins[0].behind.p.type]}.`);
    else if (queenHit) parts.push(`Attack the queen with the ${pieceName}.`);
    else if (valuable.length) parts.push(`Attack the ${PIECE[valuable[0].p.type]} on ${valuable[0].t}.`);
    else parts.push(pick([`Improve the ${pieceName}.`, `Reroute the ${pieceName} to a better square.`, 'The most reliable move here.'], key));
  }
  if (queenHit && mv.piece !== 'q' && !parts.join(' ').includes('queen')) parts.push('It even attacks the queen!');
  if (best && best.gambit) parts.push('We offer a pawn: development and open lines are worth more right now.');
  return parts.join(' ');
}

/* ------------------------------------------------------------ tree building */
function normalizePath(str) {
  if (!str) return [];
  const c = new Chess();
  const out = [];
  for (const s of str.trim().split(/\s+/)) {
    const m = c.move(s, { sloppy: true });
    if (!m) throw new Error('illegal move "' + s + '" in path "' + str + '"');
    out.push(m.san);
  }
  return out;
}
const PK = (sans) => sans.join(' ');
const MATE = 20000;
const toWhite = (score, turn) => turn === 'w' ? score : -score;

async function buildCourse(spec) {
  const P = {
    maxPly: spec.maxPly || 22, minPly: spec.minPly || 14, minShare: spec.minShare || 0.045,
    maxBranch: spec.maxBranch || 5, minProb: spec.minProb || 0.0035, trapShare: spec.trapShare || 0.025,
    minGames: spec.minGames || 20, punishMoves: 3,
  };
  const side = spec.side, opp = side === 'w' ? 'b' : 'w';
  const seed = normalizePath(spec.seed);
  const prefer = {}, notes = {};
  for (const [k, v] of Object.entries(spec.prefer || {})) {
    const p = PK(normalizePath(k));
    const [san, note] = Array.isArray(v) ? v : [v, null];
    const c = new Chess(); for (const s of normalizePath(k)) c.move(s);
    const m = c.move(san, { sloppy: true });
    if (!m) throw new Error(`${spec.id}: preferred move ${san} illegal after ${k}`);
    prefer[p] = m.san;
    if (note) notes[p + ' ' + m.san] = note;
  }
  for (const [k, v] of Object.entries(spec.notes || {})) notes[PK(normalizePath(k))] = v;

  const evalBy = {}, markBy = {}, noteBy = {}, nameBy = {};
  let FAMILY = null;
  const lines = [];
  const seen = new Set();

  const name = (c) => { const n = NAME_BY_EPD.get(fenKey(c.fen())); return n ? n.name : null; };
  const evalOf = async (c, key) => {
    if (c.in_checkmate()) { evalBy[key] = c.turn() === 'w' ? -MATE : MATE; return; }
    if (c.in_draw() || c.in_stalemate()) { evalBy[key] = 0; return; }
    const db = await cdb(c.fen());
    if (db && db.length) evalBy[key] = toWhite(db[0].score, c.turn());
  };

  function finish(sans, prob, punished) {
    // lines always end on a student move
    let s = sans.slice();
    while (s.length > seed.length && (s.length % 2 === 1) !== (side === 'w')) s.pop();
    if (s.length <= seed.length && seed.length) s = sans.slice();
    const key = PK(s);
    if (seen.has(key)) return;
    // drop lines that are a strict prefix of an existing line
    for (const l of lines) if (l.key.startsWith(key + ' ')) return;
    for (let i = lines.length - 1; i >= 0; i--) if (key.startsWith(lines[i].key + ' ')) { seen.delete(lines[i].key); lines.splice(i, 1); }
    seen.add(key);
    lines.push({ key, sans: s, prob, punished });
  }

  async function chooseStudent(sans, chess, state) {
    const key = PK(sans);
    if (prefer[key]) return prefer[key];
    const db = await cdb(chess.fen());
    const legal = chess.moves();
    const best = db && db.length ? db[0].score : null;
    const score = (san) => { if (!db) return null; const m = db.find(x => x.san === san || x.san === san.replace(/[+#]$/, '')); return m ? m.score : null; };
    if (db && db.length && (state.punish || best >= MATE)) return legal.find(s => s.replace(/[+#]$/, '') === db[0].san.replace(/[+#]$/, '')) || null;
    if (spec.system && !state.oppBlunder) {
      for (const s of spec.system) {
        const m = legal.find(x => x.replace(/[+#]$/, '') === s);
        if (!m) continue;
        const sc = score(m);
        if (db && (sc === null || sc < best - 60)) continue;
        return m;
      }
    }
    const bk = bookKids(sans, chess);
    if (bk.total >= P.minGames) {
      for (const k of bk.kids) {
        if (k.n / bk.total < 0.08) break;
        const sc = score(k.san);
        if (!db || (sc !== null && sc >= best - 40)) return k.san;
      }
    }
    if (db && db.length) {
      // among the near-best engine moves, prefer what humans actually play
      const near = db.filter(m => m.score >= best - 12).map(m => legal.find(s => s.replace(/[+#]$/, '') === m.san.replace(/[+#]$/, ''))).filter(Boolean);
      const pop = near.map(s => ({ s, n: (bk.kids.find(k => k.san === s) || { n: 0 }).n })).sort((a, b) => b.n - a.n);
      return pop.length ? pop[0].s : null;
    }
    if (bk.kids.length) return bk.kids[0].san;
    return null;
  }

  async function studentNode(sans, chess, prob, state) {
    if (chess.game_over()) return finish(sans, prob, state.punished);
    const san = await chooseStudent(sans, chess, state);
    if (!san) return finish(sans, prob, state.punished);
    const before = new Chess(chess.fen());
    const mv = chess.move(san);
    const next = sans.concat(mv.san);
    const key = PK(next);
    await evalOf(chess, key);
    const nm = name(chess); if (nm) nameBy[key] = nm;
    if (!noteBy[key]) {
      const prevKey = PK(sans);
      const prevMove = state.lastOpp;
      const db = await cdb(chess.fen());
      const gambit = mv.piece === 'p' && db && db.length && /x/.test(db[0].san) && attackers(chess, mv.to, opp).length > 0 &&
        db[0].uci && db[0].uci.slice(2, 4) === mv.to && (db[0].score < 100);
      const studentScore = evalBy[key] !== undefined ? (side === 'w' ? evalBy[key] : -evalBy[key]) : null;
      noteBy[key] = notes[key] || autoNote({
        before, after: chess, mv, prev: prevMove, oppMark: markBy[prevKey] || null, key, side, opp,
        best: { gambit }, newName: state.newName, family: FAMILY, mateIn: studentScore !== null && studentScore >= MATE - 200 && !mv.san.includes('#'),
      });
    }
    await opponentNode(next, chess, prob, { ...state, name: nm || state.name, ply: next.length, left: state.punish ? state.left - 1 : state.left });
    chess.undo();
  }

  async function opponentNode(sans, chess, prob, state) {
    if (chess.game_over()) return finish(sans, prob, state.punished);
    if (sans.length >= P.maxPly + (state.punish ? 6 : 0)) return finish(sans, prob, state.punished);
    if (state.punish && state.left <= 0) return finish(sans, prob, true);
    const db = await cdb(chess.fen());
    const best = db && db.length ? db[0].score : null;
    const find = (san) => db && db.find(x => x.san.replace(/[+#]$/, '') === san.replace(/[+#]$/, ''));
    const loss = (san) => { const m = find(san); return m ? best - m.score : 0; };
    const gain = (san) => { const m = find(san); return m ? -m.score : -Infinity; }; // student's eval after the reply
    const bk = bookKids(sans, chess);
    let replies = [];
    if (state.punish) {
      if (db && db.length) replies = [{ san: db[0].san, share: 1 }];
      else if (bk.kids.length) replies = [{ san: bk.kids[0].san, share: 1 }];
    } else if (bk.total >= P.minGames && bk.kids.length) {
      const tot = bk.kids.reduce((a, k) => a + k.n, 0) || 1;
      for (const k of bk.kids) {
        const share = k.n / tot;
        if (replies.length && (share < P.minShare || prob * share < P.minProb || replies.length >= P.maxBranch)) continue;
        replies.push({ san: k.san, share });
      }
      let traps = 0;
      for (const k of bk.kids) {
        if (traps >= 2) break;
        const share = k.n / tot;
        if (replies.some(r => r.san === k.san) || share < P.trapShare || prob * share < P.minProb / 4) continue;
        if (loss(k.san) >= 200 && gain(k.san) >= 120) { replies.push({ san: k.san, share, trap: true }); traps++; }
      }
    } else if (sans.length < P.minPly && db && db.length) {
      // thin book: follow the engine's main line so the line reaches a playable position
      replies = [{ san: db[0].san, share: 0.5 }];
    }
    if (!replies.length) return finish(sans, prob, state.punished);

    for (const r of replies) {
      const m = chess.move(r.san, { sloppy: true });
      if (!m) continue;
      const next = sans.concat(m.san);
      const key = PK(next);
      const l = loss(m.san), g = gain(m.san);
      const mark = (l >= 300 && g >= 150) ? '??' : (l >= 150 && g >= 50) ? '?' : null;
      if (mark && !state.punish) markBy[key] = mark;
      await evalOf(chess, key);
      const prevName = state.name;
      const nm = name(chess) || prevName;
      if (nm) nameBy[key] = nm;
      const newName = nm && nm !== prevName && nm.length > (prevName || '').length ? nm : null;
      let st = { ...state, lastOpp: m, name: nm, newName, oppBlunder: !!mark };
      if (l >= 200 && g >= 120 && !state.punish) {
        // punish: continue with best play until the gain is banked (or mate is delivered)
        const sdb = await cdb(chess.fen());
        const mating = sdb && sdb.length && sdb[0].score >= MATE;
        st = { ...st, punish: true, punished: true, left: mating ? Math.min(Math.ceil((30000 - sdb[0].score) / 2), 8) : P.punishMoves };
      }
      await studentNode(next, chess, prob * r.share, st);
      chess.undo();
    }
  }

  // play the seed
  { const c0 = new Chess(); for (const s0 of seed) { c0.move(s0); const n0 = NAME_BY_EPD.get(fenKey(c0.fen())); if (n0) FAMILY = n0.name.split(':')[0].trim(); } }
  const chess = new Chess();
  let nm = null;
  for (let i = 0; i < seed.length; i++) {
    const m = chess.move(seed[i]);
    const key = PK(seed.slice(0, i + 1));
    await evalOf(chess, key);
    nm = name(chess) || nm; if (nm) nameBy[key] = nm;
    if (m.color === side) {
      const before = new Chess(); for (const s of seed.slice(0, i)) before.move(s);
      noteBy[key] = notes[key] || autoNote({ before, after: chess, mv: m, prev: null, oppMark: null, key, side, opp, best: {}, newName: null, family: FAMILY });
    }
  }
  const state = { ply: seed.length, name: nm, punish: false, left: 0, lastOpp: null };
  if (chess.turn() === side) await studentNode(seed, chess, 1, state);
  else await opponentNode(seed, chess, 1, state);

  // hand-written lines (classic traps that are rare in the game data); "??" / "?" mark opponent mistakes
  for (const str of spec.extra || []) {
    const c = new Chess();
    const sans = [];
    let lastOpp = null, punished = false;
    for (const raw of str.trim().split(/\s+/)) {
      const mark = (raw.match(/[?!]+$/) || [''])[0];
      const before = new Chess(c.fen());
      const m = c.move(raw.replace(/[?!]+$/, ''), { sloppy: true });
      if (!m) throw new Error(`${spec.id}: illegal extra move ${raw} in "${str}"`);
      sans.push(m.san);
      const key = PK(sans);
      await evalOf(c, key);
      const n0 = name(c); if (n0) nameBy[key] = n0;
      if (m.color === side) {
        const prevKey = PK(sans.slice(0, -1));
        if (!noteBy[key]) noteBy[key] = notes[key] || autoNote({ before, after: c, mv: m, prev: lastOpp, oppMark: markBy[prevKey] || null, key, side, opp, best: {}, newName: null, family: FAMILY, mateIn: false });
      } else {
        lastOpp = m;
        if (mark.includes("?")) { markBy[key] = mark.includes('??') ? '??' : '?'; punished = true; }
      }
    }
    finish(sans, 0.002, punished);
  }
  saveCache(true);

  // ---------- assemble ----------
  const total = lines.reduce((a, l) => a + l.prob, 0) || 1;
  const order = lines.map((l, i) => ({ l, i })).sort((a, b) => b.l.prob - a.l.prob);
  const nEss = Math.max(Math.min(5, lines.length), Math.min(20, Math.round(lines.length * 0.35)));
  const ess = new Set(order.slice(0, nEss).map(x => x.i));
  const out = lines.map((l, i) => {
    const n = {}, k = {}, e = [];
    let lineName = null;
    for (let p = 0; p < l.sans.length; p++) {
      const key = PK(l.sans.slice(0, p + 1));
      if (noteBy[key] && ((p % 2 === 0) === (side === 'w'))) n[p] = noteBy[key];
      if (markBy[key]) k[p] = markBy[key];
      e.push(evalBy[key] !== undefined ? evalBy[key] : null);
      if (nameBy[key]) lineName = nameBy[key];
    }
    return {
      id: (hash(spec.id + ':' + l.key) >>> 0).toString(36),
      m: l.key, n, k, e, name: lineName || spec.name, w: +(l.prob / total).toFixed(5),
      ess: ess.has(i), trap: !!l.punished,
    };
  });
  // cover position: main line after ~10 plies
  const main = out[order[0].i];
  const coverC = new Chess();
  main.m.split(' ').slice(0, Math.min(main.m.split(' ').length, 10)).forEach(s => coverC.move(s));
  return {
    id: spec.id, name: spec.name, side, group: spec.group, tags: spec.tags || [], desc: spec.desc,
    seed: PK(seed), cover: coverC.fen(), lines: out,
  };
}

(async () => {
  const outFile = OUT || path.join(ROOT, 'app/js/courses-data.js');
  let existing = [];
  if (only.length && fs.existsSync(outFile)) {
    const c = {}; vm.createContext(c);
    vm.runInContext(fs.readFileSync(outFile, 'utf8').replace('window.COURSES_DATA', 'this.COURSES_DATA'), c);
    existing = c.COURSES_DATA || [];
  }
  const result = [];
  for (const spec of SPECS) {
    if (only.length && !only.includes(spec.id)) { const e = existing.find(x => x.id === spec.id); if (e) result.push(e); continue; }
    const t0 = Date.now();
    const course = await buildCourse(spec);
    const traps = course.lines.filter(l => l.trap).length;
    const avg = (course.lines.reduce((a, l) => a + l.m.split(' ').length, 0) / course.lines.length).toFixed(1);
    console.log(`${spec.id.padEnd(26)} ${String(course.lines.length).padStart(3)} lines  ${String(traps).padStart(2)} traps  avg ${avg} plies  ${((Date.now() - t0) / 1000).toFixed(0)}s  (${requests} requests)`);
    result.push(course);
  }
  saveCache(true);
  const js = '// Generated by tools/build-courses.js. Do not edit by hand.\n' +
    '// Lines: m = SAN moves, n = notes by ply, k = marks by ply, e = eval (white, centipawns) after each ply.\n' +
    'window.COURSES_DATA = ' + JSON.stringify(result) + ';\n';
  fs.writeFileSync(outFile, js);
  console.log(`wrote ${result.length} courses, ${result.reduce((a, c) => a + c.lines.length, 0)} lines, ${(js.length / 1024).toFixed(0)} KB`);
})();
