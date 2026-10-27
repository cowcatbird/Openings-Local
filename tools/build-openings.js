// Builds app/js/openings-data.js from the lichess chess-openings TSV files in tools/data.
// Usage: node tools/build-openings.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'app', 'js', 'chess.js'), 'utf8'), ctx);
const Chess = ctx.Chess;

const dataDir = path.join(__dirname, 'data');
const out = [];
const seen = new Set();
let bad = 0;
for (const f of ['a', 'b', 'c', 'd', 'e']) {
  const lines = fs.readFileSync(path.join(dataDir, f + '.tsv'), 'utf8').split(/\r?\n/);
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const [eco, name, pgn] = line.split('\t');
    const sans = pgn.replace(/\d+\.(\.\.)?/g, ' ').trim().split(/\s+/).filter(Boolean);
    const c = new Chess();
    let ok = true;
    for (const s of sans) { if (!c.move(s)) { ok = false; break; } }
    if (!ok) { bad++; console.error('invalid', eco, name, pgn); continue; }
    const key = sans.join(' ');
    if (seen.has(key)) continue; // identical move sequence under another name
    seen.add(key);
    out.push([eco, name, key]);
  }
}
out.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
const families = new Set(out.map(o => o[1].split(':')[0].trim()));
const js = '// Opening database generated from the lichess chess-openings project (CC0).\n' +
  '// Format: [ECO, name, "SAN moves"]\n' +
  'window.OPENINGS_DB = ' + JSON.stringify(out) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'app', 'js', 'openings-data.js'), js);
console.log(`wrote ${out.length} openings (${families.size} families, ${bad} invalid skipped), ${(js.length/1024).toFixed(0)} KB`);
console.log('gambits:', out.filter(o => /gambit/i.test(o[1])).length);
