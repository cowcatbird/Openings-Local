/* PGN parsing / formatting. Supports multiple games, comments, NAGs and nested variations. */
window.PGN = (() => {
  const RESULTS = new Set(['1-0', '0-1', '1/2-1/2', '*']);

  // Split a PGN file into games: each game = { headers: {}, movetext: '' }
  function splitGames(text) {
    text = text.replace(/\r/g, '');
    const games = [];
    let cur = null;
    let mode = 'headers';
    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      const isHeader = /^\[\s*\w+\s+"/.test(line);
      if (isHeader) {
        if (mode === 'moves') { if (cur) games.push(cur); cur = null; }
        mode = 'headers';
        if (!cur) cur = { headers: {}, movetext: '' };
        const m = line.match(/^\[\s*(\w+)\s+"(.*)"\s*\]/);
        if (m) cur.headers[m[1]] = m[2];
      } else if (line) {
        if (!cur) cur = { headers: {}, movetext: '' };
        mode = 'moves';
        cur.movetext += line + ' ';
      }
    }
    if (cur && (cur.movetext.trim() || Object.keys(cur.headers).length)) games.push(cur);
    return games;
  }

  // Tokenize movetext
  function tokenize(movetext) {
    const tokens = [];
    let i = 0;
    const s = movetext;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '{') { const j = s.indexOf('}', i); i = j < 0 ? s.length : j + 1; continue; }
      if (c === ';') { const j = s.indexOf('\n', i); i = j < 0 ? s.length : j + 1; continue; }
      if (c === '(' || c === ')') { tokens.push(c); i++; continue; }
      let j = i;
      while (j < s.length && !/[\s(){}]/.test(s[j])) j++;
      tokens.push(s.slice(i, j));
      i = j;
    }
    return tokens;
  }

  function cleanSan(tok) {
    let t = tok.replace(/^\d+\.+/, '');       // "12.Nf3" or "12...Nf3"
    t = t.replace(/[!?+#]+$/g, (m) => m.replace(/[!?]/g, '')); // strip annotations, keep +/#
    t = t.replace(/[!?]+$/, '');
    if (/^0-0-0/.test(t)) t = 'O-O-O' + t.slice(5);
    else if (/^0-0/.test(t)) t = 'O-O' + t.slice(3);
    return t;
  }

  function isSanLike(t) {
    return /^(O-O(-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?|[a-h]x?[a-h][1-8](=[QRBN])?)[+#]?$/.test(t);
  }

  // Build a move tree: array of root nodes; node = { san, children: [] } (children[0] is the main line)
  function parseTree(movetext) {
    const tokens = tokenize(movetext);
    const roots = [];
    let pos = 0;
    function parseSeq(container) {
      let current = null, currentContainer = container;
      while (pos < tokens.length) {
        const t = tokens[pos];
        if (t === '(') {
          pos++;
          parseSeq(current ? currentContainer : container);
          continue;
        }
        if (t === ')') { pos++; return; }
        pos++;
        if (RESULTS.has(t) || t.startsWith('$')) continue;
        if (/^\d+\.*$/.test(t)) continue; // bare move number
        const san = cleanSan(t);
        if (!san || !isSanLike(san)) continue;
        const node = { san, children: [] };
        const target = current ? current.children : container;
        target.push(node);
        currentContainer = target;
        current = node;
      }
    }
    parseSeq(roots);
    return roots;
  }

  // All root-to-leaf paths
  function treeLines(roots) {
    const out = [];
    function walk(node, path) {
      const p = path.concat(node.san);
      if (!node.children.length) { out.push(p); return; }
      for (const ch of node.children) walk(ch, p);
    }
    for (const r of roots) walk(r, []);
    return out;
  }

  // Parse a PGN text into [{ headers, lines: [[san,...], ...] }]
  function parse(text) {
    const out = [];
    for (const g of splitGames(text)) {
      // a result token ends a game even when the next game has no headers
      const chunks = g.movetext.split(/(?:^|\s)(?:1-0|0-1|1\/2-1\/2|\*)(?=\s|$)/).filter(c => c.trim());
      if (!chunks.length) continue;
      chunks.forEach((c, i) => out.push({ headers: i === 0 ? g.headers : {}, lines: treeLines(parseTree(c)) }));
    }
    return out;
  }

  // Validate a SAN list with chess.js; returns { moves: validPrefix, error }
  function validate(sans) {
    const c = new Chess();
    const ok = [];
    for (const s of sans) {
      const mv = c.move(s, { sloppy: true });
      if (!mv) return { moves: ok, error: `Illegal move "${s}" after ${ok.length ? format(ok) : 'start'}` };
      ok.push(mv.san);
    }
    return { moves: ok, error: null };
  }

  function format(sans, from = 0) {
    let out = '';
    for (let i = from; i < sans.length; i++) {
      if (i % 2 === 0) out += (i / 2 + 1) + '. ';
      else if (i === from) out += (Math.floor(i / 2) + 1) + '... ';
      out += sans[i] + ' ';
    }
    return out.trim();
  }

  function game(line) {
    const h = [
      ['Event', line.name || 'Line'],
      ['Site', 'Openings Local'],
      ['Date', new Date(line.created || Date.now()).toISOString().slice(0, 10).replace(/-/g, '.')],
      ['White', line.color === 'w' ? 'Me' : 'Opponent'],
      ['Black', line.color === 'b' ? 'Me' : 'Opponent'],
      ['Result', '*'],
    ];
    if (line.eco) h.push(['ECO', line.eco]);
    if (line.name) h.push(['Opening', line.name]);
    return h.map(([k, v]) => `[${k} "${String(v).replace(/"/g, "'")}"]`).join('\n') + '\n\n' + format(line.moves) + ' *\n';
  }

  function exportLines(lines) { return lines.map(game).join('\n'); }

  return { parse, parseTree, treeLines, validate, format, exportLines, cleanSan };
})();
