/* Particle effects: gold stars when a line is completed, confetti for big moments. */
window.Confetti = (() => {
  let canvas, ctx, parts = [], raf = null;
  const COLORS = ['#a78bfa', '#60a5fa', '#fbbf24', '#f87171', '#4ade80', '#f472b6', '#ffffff'];

  function ensure() {
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'fx-canvas';
      document.body.appendChild(canvas);
      ctx = canvas.getContext('2d');
    }
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== innerWidth * dpr || canvas.height !== innerHeight * dpr) {
      canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
      canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }
  const enabled = () => !(window.Store && Store.settings && Store.settings.effects === false);

  function burst(opts = {}) {
    if (!enabled()) return;
    ensure();
    const n = opts.count || 140;
    const cx = opts.x != null ? opts.x : innerWidth * 0.5;
    const cy = opts.y != null ? opts.y : innerHeight * 0.35;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 5 + Math.random() * 11;
      parts.push({ kind: 'rect', x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 6, g: 0.28,
        w: 6 + Math.random() * 6, h: 4 + Math.random() * 6, c: COLORS[(Math.random() * COLORS.length) | 0],
        r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, life: 1, decay: 0.008 + Math.random() * 0.01 });
    }
    start();
  }

  // Stars drifting up across a rectangle (the board)
  function stars(rect, opts = {}) {
    if (!enabled()) return;
    ensure();
    const n = opts.count || 46;
    for (let i = 0; i < n; i++) {
      const x = rect.left + Math.random() * rect.width;
      const y = rect.top + rect.height * (0.25 + Math.random() * 0.85);
      parts.push({ kind: 'star', x, y, vx: (Math.random() - 0.5) * 1.2, vy: -(0.6 + Math.random() * 1.8), g: -0.01,
        s: 4 + Math.random() * 7, c: Math.random() < 0.8 ? '#fbbf24' : '#fde68a', r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.06,
        life: 1, decay: 0.006 + Math.random() * 0.008, delay: Math.random() * 18 });
    }
    start();
  }

  function start() { if (!raf) raf = requestAnimationFrame(tick); }

  function drawStar(p) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 ? p.s * 0.45 : p.s;
      const a = p.r + i * Math.PI / 5 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
  }

  function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(p => p.life > 0);
    for (const p of parts) {
      if (p.delay > 0) { p.delay--; continue; }
      p.vy += p.g; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= p.decay;
      ctx.save();
      const fadeIn = p.kind === 'star' ? Math.min(1, (1 - p.life) * 8) : 1;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6)) * fadeIn;
      ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      if (p.kind === 'star') { ctx.shadowColor = 'rgba(251,191,36,0.6)'; ctx.shadowBlur = 8; drawStar(p); }
      else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (parts.length) raf = requestAnimationFrame(tick);
    else { raf = null; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  return { burst, stars };
})();
