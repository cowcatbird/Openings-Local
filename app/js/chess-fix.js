/* chess.js 0.12 "sloppy" parsing can misread pawn captures such as "bxa6" as bishop moves.
   Always try strict SAN first and fall back to sloppy parsing only when that fails. */
(() => {
  const Base = window.Chess;
  window.Chess = function (fen) {
    const c = fen === undefined ? new Base() : new Base(fen);
    const move = c.move;
    c.move = (mv, opts) => {
      if (typeof mv === 'string' && opts && opts.sloppy) return move(mv) || move(mv, opts);
      return move(mv, opts);
    };
    return c;
  };
})();
