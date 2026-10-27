/* Chess board component: animated pieces, drag & click moves, highlights, arrows. */
window.Board = (() => {
  const FILES = 'abcdefgh';
  const SVG_NS = 'http://www.w3.org/2000/svg';

  class Board {
    constructor(el, opts = {}) {
      this.el = el;
      this.el.classList.add('board');
      this.orientation = 'w';
      this.pieceSet = opts.pieceSet || 'cburnett';
      this.interactive = null;            // 'w' | 'b' | 'both' | null
      this.onMove = opts.onMove || (() => false);
      this.legalMoves = opts.legalMoves || (() => []);
      this.onSelect = opts.onSelect || null;
      this.els = new Map();               // square -> piece element
      this.squares = new Map();           // square -> square div
      this.selected = null;
      this.marks = { last: [], check: null, hint: [] };
      this.arrows = [];
      this.dots = [];
      this.drag = null;

      this.squaresEl = document.createElement('div'); this.squaresEl.className = 'squares';
      this.piecesEl = document.createElement('div'); this.piecesEl.className = 'pieces';
      this.svg = document.createElementNS(SVG_NS, 'svg');
      this.svg.setAttribute('viewBox', '0 0 8 8');
      this.svg.classList.add('overlay');
      this.el.append(this.squaresEl, this.piecesEl, this.svg);
      this.buildSquares();
      this.bindPointer();
      this.setTheme(opts.theme || 'brown');
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
        this.squaresEl.appendChild(d);
        this.squares.set(sq, d);
      }
      this.applyMarks();
    }

    /* ----- appearance ----- */
    setTheme(name) {
      [...this.el.classList].filter(c => c.startsWith('theme-')).forEach(c => this.el.classList.remove(c));
      this.el.classList.add('theme-' + name);
    }
    setCoords(on) { this.el.classList.toggle('coords', !!on); }
    setPieceSet(name) {
      this.pieceSet = name;
      for (const el of this.els.values()) el.style.backgroundImage = this.pieceUrl(el.dataset.piece);
    }
    pieceUrl(code) { return `url("pieces/${this.pieceSet}/${code}.svg")`; }

    setOrientation(o, animate) {
      if (o === this.orientation) return;
      this.orientation = o;
      this.buildSquares();
      for (const [sq, el] of this.els) this.place(el, sq, false);
      this.drawOverlay();
      if (animate) { this.el.classList.remove('flipping'); void this.el.offsetWidth; this.el.classList.add('flipping'); }
    }

    setInteractive(color) {
      this.interactive = color;
      this.el.classList.toggle('interactive', !!color);
      if (!color) this.deselect();
    }
    canPick(code) {
      const c = code[0];
      return this.interactive === 'both' || this.interactive === c;
    }

    /* ----- rendering ----- */
    place(el, sq, animate = true) {
      const [x, y] = this.xy(sq);
      if (!animate) el.classList.add('no-anim');
      el.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
      if (!animate) { void el.offsetWidth; el.classList.remove('no-anim'); }
    }

    createPiece(code, sq, pop) {
      const el = document.createElement('div');
      el.className = 'piece ' + code;
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
        if (animate) { el.classList.add('fading'); setTimeout(() => el.remove(), 240); }
        else el.remove();
      }
      this.els = next;
    }

    /* ----- marks & overlay ----- */
    setMarks(m) { this.marks = { ...this.marks, ...m }; this.applyMarks(); }
    applyMarks() {
      for (const [sq, d] of this.squares) {
        d.classList.toggle('last', this.marks.last.includes(sq));
        d.classList.toggle('check', this.marks.check === sq);
        d.classList.toggle('hint', this.marks.hint.includes(sq));
        d.classList.toggle('selected', this.selected === sq);
      }
    }
    flash(sq, cls) {
      const d = this.squares.get(sq); if (!d) return;
      d.classList.remove(cls); void d.offsetWidth; d.classList.add(cls);
      setTimeout(() => d.classList.remove(cls), 800);
    }
    shake() { this.el.classList.remove('shake'); void this.el.offsetWidth; this.el.classList.add('shake'); setTimeout(() => this.el.classList.remove('shake'), 500); }
    glow() { this.el.classList.remove('glow'); void this.el.offsetWidth; this.el.classList.add('glow'); setTimeout(() => this.el.classList.remove('glow'), 800); }

    setArrows(arrows) { this.arrows = arrows || []; this.drawOverlay(); }
    setDots(dots) { this.dots = dots || []; this.drawOverlay(); }
    drawOverlay() {
      const svg = this.svg;
      svg.innerHTML = '';
      for (const d of this.dots) {
        const [x, y] = this.xy(d.to);
        const c = document.createElementNS(SVG_NS, 'circle');
        c.setAttribute('cx', x + 0.5); c.setAttribute('cy', y + 0.5);
        if (d.capture) { c.setAttribute('r', 0.42); c.setAttribute('fill', 'none'); c.setAttribute('stroke', 'rgba(0,0,0,0.22)'); c.setAttribute('stroke-width', 0.1); }
        else { c.setAttribute('r', 0.15); c.setAttribute('fill', 'rgba(0,0,0,0.25)'); }
        svg.appendChild(c);
      }
      for (const a of this.arrows) {
        const [x1, y1] = this.xy(a.from), [x2, y2] = this.xy(a.to);
        const sx = x1 + 0.5, sy = y1 + 0.5, ex = x2 + 0.5, ey = y2 + 0.5;
        const dx = ex - sx, dy = ey - sy, len = Math.hypot(dx, dy);
        if (!len) continue;
        const ux = dx / len, uy = dy / len;
        const start = 0.3, head = 0.45, w = 0.16, hw = 0.36;
        const bx = sx + ux * start, by = sy + uy * start;
        const hx = ex - ux * head, hy = ey - uy * head;
        const px = -uy, py = ux;
        const pts = [
          [bx + px * w, by + py * w], [hx + px * w, hy + py * w], [hx + px * hw, hy + py * hw],
          [ex, ey], [hx - px * hw, hy - py * hw], [hx - px * w, hy - py * w], [bx - px * w, by - py * w],
        ];
        const poly = document.createElementNS(SVG_NS, 'polygon');
        poly.setAttribute('points', pts.map(p => p.map(v => v.toFixed(3)).join(',')).join(' '));
        poly.setAttribute('fill', a.color || 'rgba(21, 120, 230, 0.75)');
        poly.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(poly);
      }
    }

    /* ----- interaction ----- */
    select(sq) {
      this.selected = sq;
      this.applyMarks();
      const targets = this.legalMoves(sq) || [];
      this.setDots(Store.settings.showLegal ? targets : []);
      if (this.onSelect) this.onSelect(sq);
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
      if (!this.interactive || e.button !== 0) return;
      const sq = this.squareAt(e.clientX, e.clientY);
      if (!sq) return;
      e.preventDefault();
      const el = this.els.get(sq);
      const pickable = el && this.canPick(el.dataset.piece);
      if (this.selected && sq !== this.selected) {
        const targets = this.legalMoves(this.selected) || [];
        if (targets.some(t => t.to === sq)) { this.tryMove(this.selected, sq); return; }
      }
      if (!pickable) { this.deselect(); return; }
      this.select(sq);
      this.drag = { sq, el, moved: false, x0: e.clientX, y0: e.clientY };
      el.classList.add('dragging');
      try { this.el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      this.dragTo(e);
    }
    dragTo(e) {
      const rect = this.el.getBoundingClientRect();
      const s = rect.width / 8;
      const x = e.clientX - rect.left - s / 2, y = e.clientY - rect.top - s / 2;
      this.drag.el.style.transform = `translate(${x}px, ${y}px)`;
    }
    onMoveP(e) {
      if (!this.drag) return;
      if (Math.hypot(e.clientX - this.drag.x0, e.clientY - this.drag.y0) > 4) this.drag.moved = true;
      this.dragTo(e);
    }
    onUp(e, cancel) {
      if (!this.drag) return;
      const d = this.drag; this.drag = null;
      d.el.classList.remove('dragging');
      const target = cancel ? null : this.squareAt(e.clientX, e.clientY);
      if (target && target !== d.sq && d.moved) {
        this.tryMove(d.sq, target);
      } else {
        this.place(d.el, d.sq, true);
        if (d.moved) this.deselect();
      }
    }
    tryMove(from, to) {
      const ok = this.onMove(from, to);
      this.deselect();
      if (!ok) {
        const el = this.els.get(from);
        if (el) this.place(el, from, true);
      }
      return ok;
    }
  }

  return Board;
})();
