/* Chess board component: animated pieces, drag & click moves, highlights, badges, arrows. */
window.Board = (() => {
  const FILES = 'abcdefgh';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const BADGE_SVG = {
    ok: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
    bad: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    win: '<svg viewBox="0 0 24 24"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/></svg>',
  };

  class Board {
    constructor(el, opts = {}) {
      this.el = el;
      this.el.classList.add('board');
      this.orientation = opts.orientation || 'w';
      this.pieceSet = opts.pieceSet || 'cburnett';
      this.interactive = null;            // 'w' | 'b' | 'both' | null
      this.onMove = opts.onMove || (() => false);
      this.legalMoves = opts.legalMoves || (() => []);
      this.onBoardClick = opts.onBoardClick || null;
      this.showLegal = opts.showLegal !== false;
      this.els = new Map();               // square -> piece element
      this.squares = new Map();           // square -> square div
      this.selected = null;
      this.marks = { last: [], check: null, hint: [], wrong: [] };
      this.arrows = [];                   // programmatic arrows
      this.userShapes = [];               // right-click arrows / circles
      this.dots = [];
      this.badges = [];
      this.drag = null;
      this.rdrag = null;

      this.squaresEl = document.createElement('div'); this.squaresEl.className = 'squares';
      this.piecesEl = document.createElement('div'); this.piecesEl.className = 'pieces';
      this.svg = document.createElementNS(SVG_NS, 'svg');
      this.svg.setAttribute('viewBox', '0 0 8 8');
      this.svg.classList.add('overlay');
      this.badgesEl = document.createElement('div'); this.badgesEl.className = 'badges';
      this.el.append(this.squaresEl, this.piecesEl, this.svg, this.badgesEl);
      this.buildSquares();
      this.bindPointer();
      this.setCoords(opts.coords !== false);
    }

    /* ----- geometry ----- */
    xy(sq) {
      const f = FILES.indexOf(sq[0]), r = +sq[1] - 1;
      return this.orientation === 'w' ? [f, 7 - r] : [7 - f, r];
    }
    sqFromXY(x, y) {
      const f = this.orientation === 'w' ? x : 7 - x;
      const r = this.orientation === 'w' ? 7 - y : y;
      return FILES[f] + (r + 1);
    }
    squareAt(clientX, clientY) {
      const rect = this.el.getBoundingClientRect();
      const x = Math.floor((clientX - rect.left) / rect.width * 8);
      const y = Math.floor((clientY - rect.top) / rect.height * 8);
      if (x < 0 || x > 7 || y < 0 || y > 7) return null;
      return this.sqFromXY(x, y);
    }

    buildSquares() {
      this.squaresEl.innerHTML = '';
      this.squares.clear();
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const sq = this.sqFromXY(x, y);
        const f = FILES.indexOf(sq[0]), r = +sq[1] - 1;
        const d = document.createElement('div');
        d.className = 'sq ' + ((f + r) % 2 === 1 ? 'light' : 'dark');
        d.dataset.sq = sq;
        if (x === 0) d.dataset.rank = r + 1;
        if (y === 7) d.dataset.file = sq[0];
        const hl = document.createElement('i'); hl.className = 'hl'; d.appendChild(hl);
        this.squaresEl.appendChild(d);
        this.squares.set(sq, d);
      }
      this.applyMarks();
    }

    /* ----- appearance ----- */
    setCoords(on) { this.el.classList.toggle('coords', !!on); }
    setPieceSet(name) {
      this.pieceSet = name;
      for (const el of this.els.values()) el.style.backgroundImage = this.pieceUrl(el.dataset.piece);
    }
    pieceUrl(code) { return `url("pieces/${this.pieceSet}/${code}.svg")`; }

    setOrientation(o) {
      if (o === this.orientation) return;
      this.orientation = o;
      this.buildSquares();
      for (const [sq, el] of this.els) this.place(el, sq, false);
      this.drawOverlay();
      this.drawBadges();
    }

    setInteractive(color) {
      this.interactive = color;
      this.el.classList.toggle('interactive', !!color);
      if (!color) this.deselect();
    }
    canPick(code) { return this.interactive === 'both' || this.interactive === code[0]; }

    /* ----- rendering ----- */
    // Pieces are positioned with the `translate` property so that `scale` (drag lift, pop-in,
    // fade-out) always happens around the piece's own centre.
    place(el, sq, animate = true) {
      const [x, y] = this.xy(sq);
      if (!animate) el.classList.add('no-anim');
      el.style.translate = `${x * 100}% ${y * 100}%`;
      if (!animate) { void el.offsetWidth; el.classList.remove('no-anim'); }
    }

    createPiece(code, sq, pop) {
      const el = document.createElement('div');
      el.className = 'piece';
      el.dataset.piece = code;
      el.style.backgroundImage = this.pieceUrl(code);
      this.piecesEl.appendChild(el);
      this.place(el, sq, false);
      if (pop) { el.classList.add('pop'); el.addEventListener('animationend', () => el.classList.remove('pop'), { once: true }); }
      return el;
    }

    // Diff-render against a chess.js instance (or a FEN)
    setPosition(chess, animate = true) {
      const c = typeof chess === 'string' ? new Chess(chess) : chess;
      const want = new Map();
      const b = c.board();
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
        const p = b[i][j];
        if (p) want.set(FILES[j] + (8 - i), p.color + p.type.toUpperCase());
      }
      const used = new Set();
      const next = new Map();
      for (const [sq, code] of want) {
        const el = this.els.get(sq);
        if (el && el.dataset.piece === code) { next.set(sq, el); used.add(el); }
      }
      const free = [...this.els].filter(([, el]) => !used.has(el));
      for (const [sq, code] of want) {
        if (next.has(sq)) continue;
        let best = null, bestD = Infinity;
        for (const [fsq, el] of free) {
          if (used.has(el) || el.dataset.piece !== code) continue;
          const [x1, y1] = this.xy(sq), [x2, y2] = this.xy(fsq);
          const d = Math.abs(x1 - x2) + Math.abs(y1 - y2);
          if (d < bestD) { bestD = d; best = el; }
        }
        if (best) {
          used.add(best);
          best.classList.remove('dragging');
          this.place(best, sq, animate);
          next.set(sq, best);
        } else {
          next.set(sq, this.createPiece(code, sq, animate && this.els.size > 0));
        }
      }
      for (const [, el] of this.els) {
        if (used.has(el)) continue;
        if (animate) { el.classList.add('fading'); setTimeout(() => el.remove(), 220); }
        else el.remove();
      }
      this.els = next;
    }

    /* ----- marks, badges & overlay ----- */
    setMarks(m) { this.marks = { ...this.marks, ...m }; this.applyMarks(); }
    applyMarks() {
      for (const [sq, d] of this.squares) {
        d.classList.toggle('last', this.marks.last.includes(sq));
        d.classList.toggle('check', this.marks.check === sq);
        d.classList.toggle('hint', this.marks.hint.includes(sq));
        d.classList.toggle('wrongsq', this.marks.wrong.includes(sq));
        d.classList.toggle('selected', this.selected === sq);
      }
    }
    // badges: [{ sq, type: ok|bad|blunder|mistake|inacc|mate|win|book, text }]
    setBadges(list) { this.badges = list || []; this.drawBadges(); }
    addBadge(b) { this.badges = this.badges.filter(x => x.sq !== b.sq).concat(b); this.drawBadges(); }
    drawBadges() {
      this.badgesEl.innerHTML = '';
      for (const b of this.badges) {
        const [x, y] = this.xy(b.sq);
        const w = document.createElement('div');
        w.className = 'badge-sq';
        w.style.left = (x * 12.5) + '%'; w.style.top = (y * 12.5) + '%';
        const inner = document.createElement('div');
        inner.className = 'b ' + b.type;
        inner.innerHTML = BADGE_SVG[b.type] || '';
        if (!BADGE_SVG[b.type]) inner.textContent = b.text || '';
        w.appendChild(inner);
        this.badgesEl.appendChild(w);
      }
    }
    shake() { this.el.classList.remove('shake'); void this.el.offsetWidth; this.el.classList.add('shake'); setTimeout(() => this.el.classList.remove('shake'), 450); }

    setArrows(arrows) { this.arrows = arrows || []; this.drawOverlay(); }
    clearUserShapes() { if (this.userShapes.length) { this.userShapes = []; this.drawOverlay(); } }
    setDots(dots) { this.dots = dots || []; this.drawOverlay(); }
    drawOverlay() {
      const svg = this.svg;
      svg.innerHTML = '';
      for (const d of this.dots) {
        const [x, y] = this.xy(d.to);
        const c = document.createElementNS(SVG_NS, 'circle');
        c.setAttribute('cx', x + 0.5); c.setAttribute('cy', y + 0.5);
        if (d.capture) { c.setAttribute('r', 0.44); c.setAttribute('fill', 'none'); c.setAttribute('stroke', 'rgba(20,85,30,0.5)'); c.setAttribute('stroke-width', 0.09); }
        else { c.setAttribute('r', 0.16); c.setAttribute('fill', 'rgba(20,85,30,0.5)'); }
        svg.appendChild(c);
      }
      const shapes = this.arrows.concat(this.userShapes);
      for (const a of shapes) {
        const color = a.color || 'rgba(21, 120, 27, 0.8)';
        if (!a.to || a.to === a.from) {
          const [x, y] = this.xy(a.from);
          const c = document.createElementNS(SVG_NS, 'circle');
          c.setAttribute('cx', x + 0.5); c.setAttribute('cy', y + 0.5); c.setAttribute('r', 0.45);
          c.setAttribute('fill', 'none'); c.setAttribute('stroke', color); c.setAttribute('stroke-width', 0.075);
          svg.appendChild(c);
          continue;
        }
        const [x1, y1] = this.xy(a.from), [x2, y2] = this.xy(a.to);
        const sx = x1 + 0.5, sy = y1 + 0.5, ex = x2 + 0.5, ey = y2 + 0.5;
        const dx = ex - sx, dy = ey - sy, len = Math.hypot(dx, dy);
        const ux = dx / len, uy = dy / len;
        const head = 0.42, w = 0.075, hw = 0.24;
        const bx = sx, by = sy;
        const tx = ex - ux * 0.1, ty = ey - uy * 0.1;
        const hx = tx - ux * head, hy = ty - uy * head;
        const px = -uy, py = ux;
        const pts = [
          [bx + px * w, by + py * w], [hx + px * w, hy + py * w], [hx + px * hw, hy + py * hw],
          [tx, ty], [hx - px * hw, hy - py * hw], [hx - px * w, hy - py * w], [bx - px * w, by - py * w],
        ];
        const poly = document.createElementNS(SVG_NS, 'polygon');
        poly.setAttribute('points', pts.map(p => p.map(v => v.toFixed(3)).join(',')).join(' '));
        poly.setAttribute('fill', color);
        poly.setAttribute('opacity', '0.85');
        svg.appendChild(poly);
      }
    }

    /* ----- interaction ----- */
    select(sq) {
      this.selected = sq;
      this.applyMarks();
      this.setDots(this.showLegal ? (this.legalMoves(sq) || []) : []);
    }
    deselect() { this.selected = null; this.applyMarks(); this.setDots([]); }

    bindPointer() {
      this.el.addEventListener('pointerdown', (e) => this.onDown(e));
      this.el.addEventListener('pointermove', (e) => this.onMoveP(e));
      this.el.addEventListener('pointerup', (e) => this.onUp(e));
      this.el.addEventListener('pointercancel', (e) => this.onUp(e, true));
      this.el.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    onDown(e) {
      const sq = this.squareAt(e.clientX, e.clientY);
      if (!sq) return;
      if (e.button === 2) { // right button: draw arrows / circles
        e.preventDefault();
        this.rdrag = { from: sq, to: sq };
        try { this.el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        return;
      }
      if (e.button !== 0) return;
      this.clearUserShapes();
      if (this.onBoardClick && this.onBoardClick(sq) === true) return;
      if (!this.interactive) return;
      e.preventDefault();
      const el = this.els.get(sq);
      const pickable = el && this.canPick(el.dataset.piece);
      if (this.selected && sq !== this.selected && !(pickable && el.dataset.piece[0] === (this.els.get(this.selected) || { dataset: { piece: '?' } }).dataset.piece[0])) {
        const targets = this.legalMoves(this.selected) || [];
        if (targets.some(t => t.to === sq)) { this.tryMove(this.selected, sq); return; }
      }
      if (!pickable) { this.deselect(); return; }
      const wasSelected = this.selected === sq;
      this.select(sq);
      const rect = this.el.getBoundingClientRect();
      this.drag = { sq, el, moved: false, x0: e.clientX, y0: e.clientY, wasSelected, size: rect.width / 8, rect };
      try { this.el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
    dragTo(e) {
      const d = this.drag;
      const x = e.clientX - d.rect.left - d.size / 2, y = e.clientY - d.rect.top - d.size / 2;
      d.el.style.translate = `${x}px ${y}px`;
      const over = this.squareAt(e.clientX, e.clientY);
      if (over !== d.over) {
        if (d.over && this.squares.get(d.over)) this.squares.get(d.over).classList.remove('dragover');
        d.over = over;
        if (over && over !== d.sq && this.squares.get(over)) this.squares.get(over).classList.add('dragover');
      }
    }
    onMoveP(e) {
      if (this.rdrag) {
        const sq = this.squareAt(e.clientX, e.clientY);
        if (sq && sq !== this.rdrag.to) this.rdrag.to = sq;
        return;
      }
      if (!this.drag) return;
      if (!this.drag.moved && Math.hypot(e.clientX - this.drag.x0, e.clientY - this.drag.y0) > 3) {
        this.drag.moved = true;
        this.drag.rect = this.el.getBoundingClientRect();
        this.drag.size = this.drag.rect.width / 8;
        this.drag.el.classList.add('dragging');
      }
      if (this.drag.moved) this.dragTo(e);
    }
    onUp(e, cancel) {
      if (this.rdrag) {
        const r = this.rdrag; this.rdrag = null;
        const shape = { from: r.from, to: r.to === r.from ? null : r.to, color: e.shiftKey ? 'rgba(200, 30, 30, 0.8)' : e.altKey ? 'rgba(0, 48, 136, 0.8)' : 'rgba(21, 120, 27, 0.8)' };
        const i = this.userShapes.findIndex(s => s.from === shape.from && (s.to || null) === shape.to);
        if (i >= 0) this.userShapes.splice(i, 1); else this.userShapes.push(shape);
        this.drawOverlay();
        return;
      }
      if (!this.drag) return;
      const d = this.drag; this.drag = null;
      if (d.over && this.squares.get(d.over)) this.squares.get(d.over).classList.remove('dragover');
      d.el.classList.remove('dragging');
      const target = cancel ? null : this.squareAt(e.clientX, e.clientY);
      if (d.moved) {
        if (target && target !== d.sq) { if (!this.tryMove(d.sq, target, true)) this.place(d.el, d.sq, true); }
        else { this.place(d.el, d.sq, true); }
      } else if (d.wasSelected) {
        this.deselect();
      }
    }
    tryMove(from, to, dragged) {
      const el = this.els.get(from);
      if (dragged && el) { el.classList.add('no-anim'); }
      const ok = this.onMove(from, to);
      if (el) { void el.offsetWidth; el.classList.remove('no-anim'); }
      this.deselect();
      if (!ok && el && this.els.get(from) === el) this.place(el, from, true);
      return ok;
    }
  }

  // Static mini board used on course cards
  Board.mini = (fen, orientation = 'w', pieceSet = 'cburnett') => {
    const rows = fen.split(' ')[0].split('/');
    let sqs = '';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) sqs += `<i class="${(x + y) % 2 ? 'd' : 'l'}"></i>`;
    let imgs = '';
    rows.forEach((row, r) => {
      let f = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) { f += +ch; continue; }
        const code = (ch === ch.toUpperCase() ? 'w' : 'b') + ch.toUpperCase();
        const x = orientation === 'w' ? f : 7 - f, y = orientation === 'w' ? r : 7 - r;
        imgs += `<img src="pieces/${pieceSet}/${code}.svg" style="left:${x * 12.5}%;top:${y * 12.5}%" alt="">`;
        f++;
      }
    });
    return `<div class="mini-board"><div class="sqs">${sqs}</div>${imgs}</div>`;
  };

  return Board;
})();
