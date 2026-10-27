/* Tiny confetti burst for completed lines. */
window.Confetti = (() => {
  let canvas, ctx, parts = [], raf = null;
  const COLORS = ['#4ade80', '#60a5fa', '#fbbf24', '#f87171', '#c084fc', '#f472b6', '#ffffff'];

  function ensure() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
  }

  function burst(opts = {}) {
    if (!Store.settings.confetti) return;
    ensure();
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const n = opts.count || 140;
    const cx = opts.x != null ? opts.x : canvas.width * 0.5;
    const cy = opts.y != null ? opts.y : canvas.height * 0.35;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 5 + Math.random() * 11;
      parts.push({
        x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 6,
        w: 6 + Math.random() * 6, h: 4 + Math.random() * 6,
        c: COLORS[(Math.random() * COLORS.length) | 0],
        r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, life: 1, decay: 0.008 + Math.random() * 0.01,
      });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parts = parts.filter(p => p.life > 0);
    for (const p of parts) {
      p.vy += 0.28; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= p.decay;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5));
      ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (parts.length) raf = requestAnimationFrame(tick);
    else { raf = null; ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  return { burst };
})();
