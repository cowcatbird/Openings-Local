// Trims the lichess move-frequency book (tools/build-book.js) into app/js/book-data.js,
// the offline games explorer shown on the Analysis board.
// Usage: node tools/build-explorer.js [tools/cache/book.json] [minGames=150] [maxPly=18]
const fs = require('fs');
const path = require('path');
const src = process.argv[2] || path.join(__dirname, 'cache', 'book.json');
const MIN = +(process.argv[3] || 150);
const MAX_PLY = +(process.argv[4] || 18);
const book = JSON.parse(fs.readFileSync(src, 'utf8'));
let nodes = 0;
function trim(n, ply) {
  nodes++;
  const out = [n[0], n[1], n[2], n[3]];
  if (n[4] && ply < MAX_PLY) {
    const kids = {};
    let any = false;
    for (const [k, v] of Object.entries(n[4])) if (v[0] >= MIN) { kids[k] = trim(v, ply + 1); any = true; }
    if (any) out.push(kids);
  }
  return out;
}
const t = trim(book, 0);
const js = '// Move statistics from ' + book[0].toLocaleString('en') + ' rated lichess games (lichess open database, CC0).\n' +
  '// Node: [games, white wins, draws, black wins, {SAN: node}]\n' +
  'window.BOOK_DATA = ' + JSON.stringify(t) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'app', 'js', 'book-data.js'), js);
console.log(`book-data.js: ${nodes} positions, ${(js.length / 1024).toFixed(0)} KB`);
