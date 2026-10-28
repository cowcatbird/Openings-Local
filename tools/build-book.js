// Builds an opening "book" (move-frequency trie) from lichess monthly PGN dumps (.pgn.zst).
// Usage: node tools/build-book.js <out.json> <file1.pgn.zst> [file2 ...]
// Keeps rated games at blitz speed or slower where both players are 1200+.
// Output node: [games, whiteWins, draws, blackWins, {san: child}]
const fs = require('fs');
const zlib = require('zlib');

const MAX_PLY = 24;
const out = process.argv[2];
const files = process.argv.slice(3);
const root = { n: 0, w: 0, d: 0, b: 0, c: null };
let games = 0, kept = 0;

function prune(node, depth, min) {
  if (!node.c) return;
  for (const k in node.c) {
    const ch = node.c[k];
    if (depth >= 8 && ch.n < min) delete node.c[k];
    else prune(ch, depth + 1, min);
  }
}

function addGame(moves, result) {
  let node = root;
  const r = result === '1-0' ? 'w' : result === '0-1' ? 'b' : result === '1/2-1/2' ? 'd' : null;
  node.n++; if (r) node[r]++;
  for (let i = 0; i < moves.length && i < MAX_PLY; i++) {
    if (!node.c) node.c = Object.create(null);
    let ch = node.c[moves[i]];
    if (!ch) ch = node.c[moves[i]] = { n: 0, w: 0, d: 0, b: 0, c: null };
    ch.n++; if (r) ch[r]++;
    node = ch;
  }
}

// lichess dumps are written by pzstd: a skippable frame (magic 0x184D2A5?) holding the
// size of the next zstd frame, then that frame. Decode frame by frame.
function* frames(buf) {
  let p = 0;
  while (p + 8 <= buf.length) {
    const magic = buf.readUInt32LE(p);
    if (((magic & 0xFFFFFFF0) >>> 0) === 0x184D2A50) {
      const sz = buf.readUInt32LE(p + 4);
      const next = sz >= 4 ? buf.readUInt32LE(p + 8) : 0;
      p += 8 + sz;
      if (next) { yield buf.subarray(p, p + next); p += next; }
    } else {
      yield buf.subarray(p);
      return;
    }
  }
}

const RESULT_RE = /^(1-0|0-1|1\/2-1\/2|\*)$/;
const NUM_RE = /^\d+\.+$/;

function processText(text, state) {
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.charCodeAt(0) === 91) { // '['
      const m = /^\[(\w+) "(.*)"\]/.exec(line);
      if (m) state.h[m[1]] = m[2];
      continue;
    }
    if (!line.startsWith('1.')) continue;
    games++;
    const h = state.h;
    state.h = {};
    const we = +h.WhiteElo || 0, be = +h.BlackElo || 0;
    const tc = (h.TimeControl || '-').split('+');
    const base = +tc[0] || 0, inc = +tc[1] || 0;
    if (!(we >= 1200 && be >= 1200 && base + 40 * inc >= 180)) continue;
    if (h.Event && !/Rated/i.test(h.Event)) continue;
    const toks = line.replace(/\{[^}]*\}/g, ' ').split(/\s+/);
    const moves = [];
    for (const t of toks) {
      if (!t || NUM_RE.test(t) || RESULT_RE.test(t)) continue;
      const san = t.replace(/^\d+\.+/, '').replace(/[!?]+$/, '');
      if (!san) continue;
      moves.push(san);
      if (moves.length >= MAX_PLY) break;
    }
    addGame(moves, h.Result);
    kept++;
    if (kept % 600000 === 0) { prune(root, 0, 2); console.log('  kept ' + kept + ' / read ' + games); }
  }
}

function processFile(file) {
  const buf = fs.readFileSync(file);
  const state = { h: {} };
  let carry = '';
  for (const fr of frames(buf)) {
    const text = carry + zlib.zstdDecompressSync(fr).toString('utf8');
    const cut = text.lastIndexOf('\n');
    carry = text.slice(cut + 1);
    processText(text.slice(0, cut + 1), state);
  }
  if (carry) processText(carry + '\n', state);
}

function serialize(node, min) {
  const kids = {};
  let any = false;
  if (node.c) {
    const entries = Object.entries(node.c).filter(([, ch]) => ch.n >= min).sort((a, b) => b[1].n - a[1].n);
    for (const [k, ch] of entries) { kids[k] = serialize(ch, min); any = true; }
  }
  return any ? [node.n, node.w, node.d, node.b, kids] : [node.n, node.w, node.d, node.b];
}

for (const f of files) { console.log('reading', f); processFile(f); console.log('  total kept ' + kept + ' / read ' + games); }
console.log('done: kept ' + kept + ' of ' + games + ' games');
fs.writeFileSync(out, JSON.stringify(serialize(root, 4)));
console.log('wrote', out, (fs.statSync(out).size / 1e6).toFixed(1) + ' MB');
