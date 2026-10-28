/* PGN parsing / formatting. Multiple games, comments, NAGs and nested variations. */
window.PGN = (() => {
  const RESULTS = new Set(['1-0', '0-1', '1/2-1/2', '*']);
  const NAGS = { 1: '!', 2: '?', 3: '!!', 4: '??', 5: '!?', 6: '?!' };

  // Split a PGN file into games: { headers: {}, movetext: '' }
  function splitGames(text) {
    text = text.replace(/\r/g, '').replace(/^﻿/, '');
    const games = [];
    let cur = null, mode = 'headers';
    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (/^\[\s*\w+\s+".*"\s*\]$/.test(line)) {
        if (mode === 'moves') { if (cur) games.push(cur); cur = null; }
        mode = 'headers';
        if (!cur) cur = { headers: {}, movetext: '' };
        const m = line.match(/^\[\s*(\w+)\s+"(.*)"\s*\]/);
        if (m) cur.headers[m[1]] = m[2];
      } else if (line) {
        if (!cur) cur = { headers: {}, movetext: '' };
        mode = 'moves';
        cur.movetext += rawLine + '\n';
      }
    }
    if (cur && (cur.movetext.trim() || Object.keys(cur.headers).length)) games.push(cur);
    // a result token ends a game even if the next game has no headers
    const out = [];
    for (const g of games) {
      const chunks = splitOnResults(g.movetext);
      chunks.forEach((c, i) => out.push({ headers: i === 0 ? g.headers : {}, movetext: c }));
      if (!chunks.length && Object.keys(g.headers).length) out.push({ headers: g.headers, movetext: '' });
    }
    return out;
  }
  function splitOnResults(movetext) {
    const out = [];
    let depth = 0, inC = false, start = 0;
    const s = movetext;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (inC) { if (c === '}') inC = false; continue; }
      if (c === '{') { inC = true; continue; }
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (depth === 0 && (i === 0 || /\s/.test(s[i - 1]))) {
        const m = /^(1-0|0-1|1\/2-1\/2|\*)(?=\s|$)/.exec(s.slice(i));
        if (m) { out.push(s.slice(start, i)); start = i + m[0].length; i = start - 1; }
      }
    }
    out.push(s.slice(start));
    return out.filter(c => c.replace(/\{[^}]*\}/g, '').trim());
  }

  function tokenize(movetext) {
    const tokens = [];
    let i = 0;
    const s = movetext;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '{') { const j = s.indexOf('}', i); tokens.push({ t: 'c', v: s.slice(i + 1, j < 0 ? s.length : j).replace(/\s+/g, ' ').trim() }); i = j < 0 ? s.length : j + 1; continue; }
      if (c === ';') { const j = s.indexOf('\n', i); tokens.push({ t: 'c', v: s.slice(i + 1, j < 0 ? s.length : j).trim() }); i = j < 0 ? s.length : j + 1; continue; }
      if (c === '(' || c === ')') { tokens.push({ t: c }); i++; continue; }
      let j = i;
      while (j < s.length && !/[\s(){};]/.test(s[j])) j++;
      tokens.push({ t: 'w', v: s.slice(i, j) });
      i = j;
    }
    return tokens;
  }

  function cleanSan(tok) {
    let t = tok.replace(/^\d+\.+/, '');
    const ann = (t.match(/[!?]+$/) || [''])[0];
    t = t.replace(/[!?]+$/, '');
    if (/^0-0-0/.test(t)) t = 'O-O-O' + t.slice(5);
    else if (/^0-0/.test(t)) t = 'O-O' + t.slice(3);
    t = t.replace(/^([KQRBN]?)[-]?/, '$1');
    return { san: t, ann };
  }
  function isSanLike(t) {
    return /^(O-O(-O)?|[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h](x[a-h])?[1-8](=?[QRBN])?|[a-h][1-8]-?x?[a-h][1-8](=?[QRBN])?)[+#]?$/.test(t);
  }

  // Move tree: roots[]; node = { san, ann, comment, children: [] } (children[0] = main line)
  function parseTree(movetext) {
    const tokens = tokenize(movetext);
    const roots = [];
    let pos = 0, intro = '';
    function parseSeq(container, parentForComments) {
      let current = null, currentContainer = container;
      while (pos < tokens.length) {
        const tk = tokens[pos];
        if (tk.t === '(') { pos++; parseSeq(current ? currentContainer : container, current); continue; }
        if (tk.t === ')') { pos++; return; }
        pos++;
        if (tk.t === 'c') {
          if (current) current.comment = (current.comment ? current.comment + ' ' : '') + tk.v;
          else if (parentForComments) parentForComments.varComment = (parentForComments.varComment ? parentForComments.varComment + ' ' : '') + tk.v;
          else if (container === roots) intro = (intro ? intro + ' ' : '') + tk.v;
          continue;
        }
        const t = tk.v;
        if (RESULTS.has(t)) continue;
        if (/^\$\d+$/.test(t)) { if (current && NAGS[t.slice(1)]) current.ann = NAGS[t.slice(1)]; continue; }
        if (/^\d+\.*$/.test(t)) continue;
        const { san, ann } = cleanSan(t);
        if (!san || !isSanLike(san)) continue;
        const node = { san, ann: ann || '', comment: '', children: [] };
        const target = current ? current.children : container;
        target.push(node);
        currentContainer = target;
        current = node;
      }
    }
    parseSeq(roots, null);
    roots.intro = intro;
    return roots;
  }

  // All root-to-leaf paths as arrays of nodes
  function treePaths(roots) {
    const out = [];
    function walk(node, path) {
      const p = path.concat(node);
      if (!node.children.length) { out.push(p); return; }
      for (const ch of node.children) walk(ch, p);
    }
    for (const r of roots) walk(r, []);
    return out;
  }
  function treeLines(roots) { return treePaths(roots).map(p => p.map(n => n.san)); }

  // Parse a PGN text into [{ headers, lines: [[san...]] }]
  function parse(text) {
    return splitGames(text).map(g => ({ headers: g.headers, lines: treeLines(parseTree(g.movetext)) }));
  }

  // Parse PGN as a course for one side: [{ m, n, k, name }] + errors.
  // Comments after an opponent move become the note for the student's reply; comments after a
  // student move explain that move. Annotation symbols on opponent moves become badges.
  function parseCourse(text, side) {
    const lines = [], errors = [], seen = new Set();
    const isStudent = (ply) => (ply % 2 === 0) === (side === 'w');
    let games = 0;
    for (const g of splitGames(text)) {
      games++;
      const roots = parseTree(g.movetext);
      for (const path of treePaths(roots)) {
        const c = new Chess();
        const sans = [], n = {}, k = {};
        let bad = null;
        for (let i = 0; i < path.length; i++) {
          const node = path[i];
          const mv = c.move(node.san, { sloppy: true });
          if (!mv) { bad = `Illegal move "${node.san}" after ${sans.length ? format(sans) : 'the start'}`; break; }
          sans.push(mv.san);
          const note = node.comment;
          if (note) {
            const at = isStudent(i) ? i : i + 1;
            n[at] = n[at] ? n[at] + ' ' + note : note;
          }
          if (node.ann && !isStudent(i) && /\?/.test(node.ann)) k[i] = node.ann.includes('??') ? '??' : node.ann === '?!' ? '?!' : '?';
        }
        if (roots.intro && sans.length) { const first = isStudent(0) ? 0 : 1; n[first] = roots.intro + (n[first] ? ' ' + n[first] : ''); }
        if (bad) errors.push(bad);
        // trim so the line ends on a student move
        while (sans.length && !isStudent(sans.length - 1)) { delete n[sans.length]; delete k[sans.length - 1]; sans.pop(); }
        for (const key of Object.keys(n)) if (+key >= sans.length) delete n[key];
        if (!sans.length) continue;
        const key = sans.join(' ');
        if (seen.has(key)) continue;
        seen.add(key);
        lines.push({ m: key, n, k, name: g.headers.Opening || (g.headers.Event && g.headers.Event !== '?' ? g.headers.Event : '') || '' });
      }
    }
    // drop lines that are a prefix of a longer line
    const keys = lines.map(l => l.m);
    const final = lines.filter(l => !keys.some(o => o !== l.m && o.startsWith(l.m + ' ')));
    return { lines: final, errors, games };
  }

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

  // Merge lines into one PGN tree with variations (used to export a course)
  function courseToPgn(course) {
    const root = { children: [] };
    for (const l of course.lines) {
      let node = root;
      const ms = l.m.split(' ');
      ms.forEach((san, i) => {
        let ch = node.children.find(c => c.san === san);
        if (!ch) { ch = { san, children: [], note: null, mark: null }; node.children.push(ch); }
        if (l.n && l.n[i]) ch.note = l.n[i];
        if (l.k && l.k[i]) ch.mark = l.k[i];
        node = ch;
      });
    }
    const out = [];
    function emit(node, ply, forceNum) {
      // node.children[0] is the main continuation, the rest are variations
      if (!node.children.length) return;
      const [main, ...vars] = node.children;
      const num = (p, force) => p % 2 === 0 ? `${p / 2 + 1}. ` : force ? `${Math.floor(p / 2) + 1}... ` : '';
      const moveTxt = (ch, force) => (ch.note ? `{ ${ch.note.replace(/[{}]/g, '')} } ` : '') + num(ply, force) + ch.san + (ch.mark || '');
      out.push(moveTxt(main, forceNum));
      for (const v of vars) {
        out.push('(');
        out.push(moveTxt(v, true));
        emit(v, ply + 1, false);
        out.push(')');
      }
      emit(main, ply + 1, vars.length > 0);
    }
    emit(root, 0, true);
    const head = [
      ['Event', course.name], ['Site', 'Openings Local'], ['White', course.side === 'w' ? 'Student' : 'Opponent'],
      ['Black', course.side === 'b' ? 'Student' : 'Opponent'], ['Result', '*'],
    ].map(([k, v]) => `[${k} "${String(v).replace(/"/g, "'")}"]`).join('\n');
    return head + '\n\n' + out.join(' ').replace(/\( /g, '(').replace(/ \)/g, ')') + ' *\n';
  }

  return { parse, parseTree, treeLines, parseCourse, validate, format, courseToPgn, cleanSan, splitGames };
})();
