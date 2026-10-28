// Course definitions for tools/build-courses.js.
//
// seed    moves played before branching starts (both sides, forced).
// prefer  { pathBeforeStudentMove: 'SAN' | ['SAN', 'note'] } fixes the student's choice at a branch.
// system  ordered list of set-up moves the student prefers whenever they are sound (London, KID...).
// notes   { pathIncludingStudentMove: 'note' } hand-written coaching notes.
// Paths are space-separated SAN from the initial position; check marks are optional.
// Everything else (opponent replies, traps, the rest of the student's moves) comes from the
// lichess game book and engine scores at build time.

const j = (...parts) => parts.filter(Boolean).join(' ');

module.exports = [
  /* ===================================== WHITE ===================================== */
  (() => {
    const S = 'e4 e5 Nf3 Nc6 Bc4';
    return {
      id: 'italian-game', name: 'The Italian Game', side: 'w', group: '1.e4', tags: ['Classical', 'Popular'],
      desc: 'A classic that still wins games: c3 and d4 for the centre, Ng5 against the Two Knights, and a punishment for every Black sideline.',
      seed: S, maxPly: 22,
      prefer: {
        [j(S, 'Bc5')]: ['c3', 'Prepare d4. With c3 in place we can build a big pawn centre.'],
        [j(S, 'Bc5 c3 Nf6')]: ['d4', 'Strike in the centre now that c3 supports it.'],
        [j(S, 'Bc5 c3 Nf6 d4 exd4')]: ['cxd4', 'Recapture and keep two pawns side by side in the centre.'],
        [j(S, 'Nf6')]: ['Ng5', 'Against the Two Knights we go straight for f7. Bishop and knight both hit it now.'],
        [j(S, 'Nf6 Ng5 d5')]: ['exd5', 'Take the pawn. Black must decide how to recapture.'],
        [j(S, 'Nf6 Ng5 d5 exd5 Na5')]: ['Bb5+', 'Check first so the bishop keeps its diagonal safe.'],
        [j(S, 'Nf6 Ng5 d5 exd5 Nxd5')]: ['d4', 'The Lolli Attack: open the centre while the black king is still at home.'],
      },
      notes: {
        'e4': 'The king\'s pawn grabs the centre and opens lines for the queen and the light-squared bishop.',
        'e4 e5 Nf3': 'Develop with a threat: the knight attacks the e5 pawn.',
        [S]: 'The Italian bishop aims straight at f7, the weakest square in Black\'s camp.',
      },
    };
  })(),

  (() => {
    const S = 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5';
    return {
      id: 'fried-liver-attack', name: 'Fried Liver Attack', side: 'w', group: '1.e4', tags: ['Gambit', 'Aggressive', 'Traps'],
      desc: 'Sac the knight, grab the king. Every common Black defence to Ng5 and how to punish the natural-looking mistakes.',
      seed: S, maxPly: 24, minShare: 0.05,
      prefer: {
        [j(S, 'd5')]: ['exd5', 'We have to capture: we don\'t want to waste time in our attack.'],
        [j(S, 'd5 exd5 Nxd5')]: ['Nxf7', 'The Fried Liver! Black should never have allowed this sacrifice: the king is dragged into the open.'],
        [j(S, 'd5 exd5 Nxd5 Nxf7 Kxf7')]: ['Qf3+', 'Check, and the queen also attacks the pinned knight on d5. Black has only one way to hold both.'],
        [j(S, 'd5 exd5 Nxd5 Nxf7 Kxf7 Qf3+ Ke6')]: ['Nc3', 'Pile up on the pinned knight. Black is struggling to keep d5.'],
        [j(S, 'd5 exd5 Na5')]: ['Bb5+', 'Check first: the bishop escapes with tempo.'],
        [j(S, 'Bc5')]: ['Bxf7+', 'The Traxler! The safest way to meet it is to take on f7 with check right away.'],
      },
      notes: {
        'e4': 'My favourite opening! We want the initiative and we want to complicate the game.',
        'e4 e5 Nf3': 'We target the pawn on e5 as we develop.',
        'e4 e5 Nf3 Nc6 Bc4': 'Setting up the famous Italian Game, played by many world champions.',
        [S]: 'And boom: knight to g5 attacks f7 twice. Many players think this is a joke, but it is a very serious line.',
      },
    };
  })(),

  (() => {
    const S = 'e4 e5 Nf3 Nc6 Bb5';
    return {
      id: 'ruy-lopez', name: 'Ruy Lopez', side: 'w', group: '1.e4', tags: ['Classical', 'Positional'],
      desc: 'The Spanish: pressure on the knight that defends e5, castle quickly, and build a big centre with c3 and d4.',
      seed: S, maxPly: 22,
      prefer: {
        [j(S, 'a6')]: ['Ba4', 'Keep the pin. Taking on c6 is fine too, but we want long-term pressure.'],
        [j(S, 'a6 Ba4 Nf6')]: ['O-O', 'Castle. The e4 pawn is not really hanging: we can win it back with Re1.'],
        [j(S, 'a6 Ba4 Nf6 O-O Be7')]: ['Re1', 'Defend e4 and prepare c3 and d4.'],
        [j(S, 'a6 Ba4 Nf6 O-O Be7 Re1 b5')]: ['Bb3', 'The bishop retreats but keeps pointing at f7.'],
        [j(S, 'Nf6')]: ['O-O', 'Against the Berlin we simply castle.'],
        [j(S, 'Nf6 O-O Nxe4')]: ['Re1', 'Hit the knight at once. Black must give the pawn back.'],
      },
      notes: {
        'e4': 'Start with the king\'s pawn: centre control and quick development.',
        'e4 e5 Nf3': 'Attack e5 and develop at the same time.',
        [S]: 'The Ruy Lopez. The bishop hits the only defender of e5.',
      },
    };
  })(),

  (() => {
    const S = 'e4 e5 Nf3 Nc6 d4';
    return {
      id: 'scotch-game', name: 'Scotch Game', side: 'w', group: '1.e4', tags: ['Open', 'Active'],
      desc: 'Blow the centre open on move three. Clear plans, quick development and fewer quiet manoeuvres than the Ruy.',
      seed: S, maxPly: 20,
      prefer: { [j(S, 'exd4')]: ['Nxd4', 'Recapture with the knight, which lands on a great central square.'] },
      notes: {
        'e4': 'King\'s pawn first.',
        'e4 e5 Nf3': 'Develop and attack e5.',
        [S]: 'The Scotch: we open the centre before Black is ready.',
      },
    };
  })(),

  (() => {
    const S = 'e4 e5 Nc3';
    return {
      id: 'vienna-gambit', name: 'Vienna Gambit', side: 'w', group: '1.e4', tags: ['Gambit', 'Aggressive'],
      desc: 'Win a tempo, sac a pawn to open lines, and go straight after the king. Includes Black\'s Copycat and Falkbeer tries.',
      seed: S, maxPly: 20,
      prefer: {
        [j(S, 'Nf6')]: ['f4', 'The Vienna Gambit! We offer the f-pawn to open the f-file and kick the knight.'],
        [j(S, 'Nf6 f4 d5')]: ['fxe5', 'Take, and the pawn on e5 will chase the knight away.'],
        [j(S, 'Nf6 f4 exf4')]: ['e5', 'Kick the knight right away: it has no good squares.'],
      },
      notes: {
        'e4': 'Grab the centre.',
        [S]: 'The Vienna: the knight protects e4 and keeps the f-pawn free to advance.',
      },
    };
  })(),

  (() => {
    const S = 'e4 e5 f4';
    return {
      id: 'kings-gambit', name: 'King\'s Gambit', side: 'w', group: '1.e4', tags: ['Gambit', 'Romantic', 'Aggressive'],
      desc: 'The most romantic opening of all. Give the f-pawn, take the centre and attack down the f-file.',
      seed: S, maxPly: 20,
      prefer: { [j(S, 'exf4')]: ['Nf3', 'Develop and stop ...Qh4+.'] },
      notes: {
        'e4': 'King\'s pawn: the start of every romantic attack.',
        [S]: 'The King\'s Gambit! We offer a pawn to deflect e5 and open the f-file.',
      },
    };
  })(),

  (() => {
    const S = 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4';
    return {
      id: 'evans-gambit', name: 'Evans Gambit', side: 'w', group: '1.e4', tags: ['Gambit', 'Aggressive'],
      desc: 'Kasparov\'s surprise weapon in the Italian. A pawn for rapid development, a big centre and attacking chances.',
      seed: S, maxPly: 22,
      prefer: {
        [j(S, 'Bxb4')]: ['c3', 'Kick the bishop with tempo and prepare d4.'],
        [j(S, 'Bxb4 c3 Ba5')]: ['d4', 'Build the centre. Our pieces will come out fast.'],
        [j(S, 'Bxb4 c3 Bc5')]: ['d4', 'Strike in the centre with tempo on the bishop.'],
        [j(S, 'Bxb4 c3 Be7')]: ['d4', 'Take the centre.'],
      },
      notes: {
        'e4': 'Start with the king\'s pawn.',
        'e4 e5 Nf3': 'Develop with a threat on e5.',
        'e4 e5 Nf3 Nc6 Bc4': 'Aim at f7.',
        [S]: 'The Evans Gambit! The b-pawn deflects the bishop so we can play c3 and d4 with tempo.',
      },
    };
  })(),

  (() => {
    const S = 'e4 e5 d4 exd4 c3';
    return {
      id: 'danish-gambit', name: 'Danish Gambit', side: 'w', group: '1.e4', tags: ['Gambit', 'Aggressive', 'Traps'],
      desc: 'Two pawns for two monster bishops. Black has to know exactly what to do or get swept off the board.',
      seed: S, maxPly: 20,
      prefer: {
        [j(S, 'dxc3')]: ['Bc4', 'Offer a second pawn! Development matters more than material here.'],
        [j(S, 'dxc3 Bc4 cxb2')]: ['Bxb2', 'Both bishops now rake the board toward Black\'s king.'],
      },
      notes: {
        'e4': 'King\'s pawn.',
        'e4 e5 d4': 'Challenge e5 immediately.',
        [S]: 'The Danish Gambit: give pawns, get lines.',
      },
    };
  })(),

  (() => {
    const S = 'e4 e5 Nf3 Nc6 Nc3 Nf6 Nxe5';
    return {
      id: 'halloween-gambit', name: 'Halloween Gambit', side: 'w', group: '1.e4', tags: ['Gambit', 'Fun', 'Traps'],
      desc: 'A whole knight for a huge pawn centre. Scary for unprepared opponents and great fun in blitz.',
      seed: S, maxPly: 20, minShare: 0.05,
      prefer: {
        [j(S, 'Nxe5')]: ['d4', 'Chase the knight with pawns. We will gain tons of time.'],
        [j(S, 'Nxe5 d4 Ng6')]: ['e5', 'Kick the other knight too.'],
        [j(S, 'Nxe5 d4 Nc6')]: ['d5', 'Keep pushing: the knight is in the way again.'],
      },
      notes: {
        'e4': 'Start with the king\'s pawn.',
        'e4 e5 Nf3': 'Develop and attack e5.',
        'e4 e5 Nf3 Nc6 Nc3': 'Four Knights set-up... but we have a trick in mind.',
        [S]: 'The Halloween Gambit! We give a whole knight to drive Black\'s knights back with our pawns.',
      },
    };
  })(),

  (() => {
    const S = 'e4 c5 d4 cxd4 c3';
    return {
      id: 'smith-morra-gambit', name: 'Smith-Morra Gambit', side: 'w', group: '1.e4', tags: ['Gambit', 'Anti-Sicilian'],
      desc: 'Skip mountains of Open Sicilian theory. One pawn buys fast development and open files against the Sicilian.',
      seed: S, maxPly: 20,
      prefer: {
        [j(S, 'dxc3')]: ['Nxc3', 'Recapture with development. We are a pawn down but miles ahead in development.'],
        [j(S, 'dxc3 Nxc3 Nc6')]: ['Nf3', 'Develop. Bc4, O-O, Qe2 and Rd1 is our set-up.'],
        [j(S, 'dxc3 Nxc3 d6')]: ['Nf3', 'Develop the kingside.'],
        [j(S, 'dxc3 Nxc3 e6')]: ['Nf3', 'Develop and keep an eye on d4 and e5.'],
        [j(S, 'Nf6')]: ['e5', 'Kick the knight.'],
      },
      notes: {
        'e4': 'King\'s pawn.',
        'e4 c5 d4': 'The Morra starts: challenge c5 right away.',
        [S]: 'Offer the pawn. If Black takes, we recapture with the knight and develop at lightning speed.',
      },
    };
  })(),

  (() => {
    const S = 'e4 c5 c3';
    return {
      id: 'alapin-sicilian', name: 'Alapin Sicilian', side: 'w', group: '1.e4', tags: ['Anti-Sicilian', 'Solid'],
      desc: 'A sound, low-theory answer to the Sicilian: c3 and d4 build the classical centre Black wants to avoid.',
      seed: S, maxPly: 20,
      prefer: {
        [j(S, 'd5')]: ['exd5', 'Take, and if the queen recaptures we will gain time with d4 and Nf3.'],
        [j(S, 'Nf6')]: ['e5', 'Kick the knight to d5.'],
      },
      notes: { 'e4': 'King\'s pawn.', [S]: 'The Alapin. c3 prepares d4 so we keep a full pawn centre.' },
    };
  })(),

  (() => {
    const S = 'e4 c6 d4 d5 e5';
    return {
      id: 'caro-kann-advance', name: 'Caro-Kann: Advance', side: 'w', group: '1.e4', tags: ['Space', 'vs Caro-Kann'],
      desc: 'Grab space with e5 and cramp the Caro-Kann. Simple plans with Nf3, Be2 and a kingside push.',
      seed: S, maxPly: 20,
      prefer: { [j(S, 'Bf5')]: ['Nf3', 'The calm Short system: develop, castle, then expand.'] },
      notes: { 'e4': 'King\'s pawn.', 'e4 c6 d4': 'Build a two-pawn centre.', [S]: 'The Advance Variation: push past and gain space.' },
    };
  })(),

  (() => {
    const S = 'e4 e6 d4 d5 e5';
    return {
      id: 'french-advance', name: 'French: Advance', side: 'w', group: '1.e4', tags: ['Space', 'vs French'],
      desc: 'Lock the centre with e5, support it with c3 and Nf3, and cramp Black\'s bad light-squared bishop.',
      seed: S, maxPly: 20,
      prefer: {
        [j(S, 'c5')]: ['c3', 'Support d4 with a pawn so the chain holds.'],
        [j(S, 'c5 c3 Nc6')]: ['Nf3', 'Another defender for d4.'],
      },
      notes: { 'e4': 'King\'s pawn.', 'e4 e6 d4': 'Take the full centre.', [S]: 'The Advance: our e5 pawn takes f6 away from Black\'s knight.' },
    };
  })(),

  (() => {
    const S = 'd4';
    return {
      id: 'london-system', name: 'London System', side: 'w', group: '1.d4', tags: ['System', 'Solid', 'Beginner-friendly'],
      desc: 'One of the easiest openings to learn: the same solid set-up against almost anything, with real attacking potential.',
      seed: S, maxPly: 18,
      system: ['Bf4', 'e3', 'Nf3', 'c3', 'Nbd2', 'Bd3', 'h3', 'O-O', 'Qc2', 'Ne5'],
      prefer: {
        'd4 d5': ['Bf4', 'The London bishop comes out before e3 locks it in.'],
        'd4 Nf6': ['Bf4', 'Same plan against the knight: bishop out first.'],
      },
      notes: { [S]: 'Queen\'s pawn. The London is a system: Bf4, e3, Nf3, c3, Nbd2 and Bd3 against almost everything.' },
    };
  })(),

  (() => {
    const S = 'd4 d5 c4';
    return {
      id: 'queens-gambit', name: 'Queen\'s Gambit', side: 'w', group: '1.d4', tags: ['Classical', 'Positional'],
      desc: 'Pressure Black\'s centre from move two. Covers the Declined, the Slav, the Accepted and the tricky Albin.',
      seed: S, maxPly: 20,
      prefer: {
        [j(S, 'e6')]: ['Nc3', 'Add pressure on d5.'],
        [j(S, 'e6 Nc3 Nf6')]: ['Bg5', 'Pin the knight that defends d5.'],
        [j(S, 'e5')]: ['dxe5', 'Take the Albin pawn.'],
      },
      notes: { 'd4': 'Queen\'s pawn.', [S]: 'The Queen\'s Gambit. It is not a real gambit: if Black takes, we win the pawn back.' },
    };
  })(),

  (() => {
    const S = 'd4 d5 e4';
    return {
      id: 'blackmar-diemer-gambit', name: 'Blackmar-Diemer Gambit', side: 'w', group: '1.d4', tags: ['Gambit', 'Aggressive', 'Traps'],
      desc: 'A club-player favourite: sac the e-pawn, open the f-file and hunt the king. Includes the main Black defences.',
      seed: S, maxPly: 20,
      prefer: {
        [j(S, 'dxe4')]: ['Nc3', 'Develop and attack e4.'],
        [j(S, 'dxe4 Nc3 Nf6')]: ['f3', 'The real gambit: offer the f-pawn to open lines.'],
        [j(S, 'dxe4 Nc3 Nf6 f3 exf3')]: ['Nxf3', 'Recapture with the knight. The f-file is open for our rook.'],
      },
      notes: { 'd4': 'Queen\'s pawn.', [S]: 'The Blackmar-Diemer Gambit: offer the e-pawn for quick development.' },
    };
  })(),

  (() => {
    const S = 'g4';
    return {
      id: 'grob-gambit', name: 'Grob Gambit', side: 'w', group: 'Flank', tags: ['Gambit', 'Offbeat', 'Traps'],
      desc: 'g4, Bg2 and c4: lure Black into grabbing the g-pawn, then hit b7 and d5. With answers to every decline and counter-attack.',
      seed: S, maxPly: 20, minShare: 0.05, trapShare: 0.02,
      system: ['Bg2', 'c4', 'h3', 'd3', 'Nc3', 'e4'],
      prefer: {
        'g4 d5': ['Bg2', 'The bishop lands on the long diagonal, eyeing d5 and b7. Taking on g4 now walks into our plan.'],
        'g4 d5 Bg2 Bxg4': ['c4', 'This is the Grob Gambit. We gave up the g-pawn; now we hit d5 so b7 becomes a target.'],
        'g4 d5 Bg2 Bxg4 c4 c6': ['cxd5', 'Open the c-file and the diagonal.'],
        'g4 d5 Bg2 Bxg4 c4 c6 cxd5 cxd5': ['Qb3', 'The queen joins in: b7 and d5 are both under fire.'],
        'g4 d5 Bg2 c6': ['c4', 'Black declines the pawn. We still hit d5 from the side.'],
        'g4 e5': ['Bg2', 'Develop, eyeing b7 and keeping our plan.'],
      },
      extra: [
        'g4 d5 Bg2 Bxg4 c4 c6 cxd5 Qxd5?? Bxd5 cxd5 Qb3',
        'g4 d5 Bg2 Bxg4 c4 Nf6 cxd5 Qxd5?? Bxd5 Nxd5 Qb3',
      ],
      notes: {
        'g4 d5 Bg2 Bxg4 c4 c6 cxd5 Qxd5 Bxd5': 'Black recaptured with the queen?? It stands on our long diagonal: the bishop simply takes the queen!',
        'g4 d5 Bg2 Bxg4 c4 c6 cxd5 Qxd5 Bxd5 cxd5 Qb3': 'We are a queen for a bishop up. The queen hits b7 and d5 at once.',
        'g4 d5 Bg2 Bxg4 c4 Nf6 cxd5 Qxd5 Bxd5': 'The queen walked onto the long diagonal. Take it!',
        [S]: 'The Grob! An offbeat flank opening that grabs space and opens the long diagonal for our bishop. Most opponents have never prepared for it.',
      },
    };
  })(),

  (() => {
    const S = 'c4';
    return {
      id: 'english-opening', name: 'English Opening', side: 'w', group: 'Flank', tags: ['Positional', 'Flexible'],
      desc: 'Control d5 from the side, fianchetto the king\'s bishop and outmanoeuvre opponents in a slower game.',
      seed: S, maxPly: 18,
      system: ['Nc3', 'g3', 'Bg2', 'Nf3', 'O-O', 'd3'],
      notes: { [S]: 'The English: the c-pawn controls d5 without committing the centre.' },
    };
  })(),

  (() => {
    const S = 'Nf3';
    return {
      id: 'kings-indian-attack', name: 'King\'s Indian Attack', side: 'w', group: 'Flank', tags: ['System', 'Attacking'],
      desc: 'Nf3, g3, Bg2, O-O, d3, Nbd2 and e4: one set-up against everything, then a kingside pawn storm.',
      seed: S, maxPly: 18,
      system: ['g3', 'Bg2', 'O-O', 'd3', 'Nbd2', 'e4', 'Re1'],
      notes: { [S]: 'The King\'s Indian Attack starts with a flexible knight move.' },
    };
  })(),

  /* ===================================== BLACK ===================================== */
  (() => {
    const S = 'e4 c6';
    return {
      id: 'caro-kann', name: 'The Caro-Kann', side: 'b', group: 'vs 1.e4', tags: ['Solid', 'Popular'],
      desc: 'Simple and rock-solid: it feels like a brick wall to your opponents, while you keep chances to win.',
      seed: S, maxPly: 20,
      prefer: {
        'e4 c6 d4': ['d5', 'Challenge e4. The c6 pawn supports d5.'],
        'e4 c6 d4 d5 Nc3': ['dxe4', 'Take and develop the bishop next.'],
        'e4 c6 d4 d5 Nc3 dxe4 Nxe4': ['Bf5', 'The Classical: the bishop gets out before ...e6.'],
        'e4 c6 d4 d5 e5': ['Bf5', 'Develop the bishop outside the pawn chain.'],
        'e4 c6 d4 d5 exd5': ['cxd5', 'Recapture toward the centre.'],
        'e4 c6 d4 d5 Nd2': ['dxe4', 'Same idea as against Nc3.'],
        'e4 c6 Nc3': ['d5', 'Strike the centre.'],
        'e4 c6 Nf3': ['d5', 'Strike the centre.'],
        'e4 c6 d3': ['d5', 'Take the centre.'],
        'e4 c6 c4': ['d5', 'Hit the centre.'],
      },
      notes: { [S]: 'The Caro-Kann: prepare ...d5 with a solid pawn on c6.' },
    };
  })(),

  (() => {
    const S = 'e4 e6';
    return {
      id: 'french-defense', name: 'French Defense', side: 'b', group: 'vs 1.e4', tags: ['Solid', 'Counter-attack'],
      desc: 'A solid pawn chain and a clear plan: strike at White\'s centre with ...c5 and ...f6.',
      seed: S, maxPly: 20,
      prefer: {
        'e4 e6 d4': ['d5', 'Challenge e4 right away.'],
        'e4 e6 d4 d5 e5': ['c5', 'Hit the base of the pawn chain.'],
        'e4 e6 d4 d5 Nc3': ['Nf6', 'The Classical: attack e4 again.'],
        'e4 e6 d4 d5 exd5': ['exd5', 'Recapture: a symmetrical but fully equal position.'],
        'e4 e6 d4 d5 Nd2': ['Nf6', 'Attack e4.'],
        'e4 e6 Nf3': ['d5', 'Take the centre.'],
        'e4 e6 d3': ['d5', 'Take the centre.'],
        'e4 e6 Nc3': ['d5', 'Hit e4.'],
      },
      notes: { [S]: 'The French: we prepare ...d5 and build a solid pawn chain.' },
    };
  })(),

  (() => {
    const S = 'e4 d5';
    return {
      id: 'scandinavian-defense', name: 'Scandinavian Defense', side: 'b', group: 'vs 1.e4', tags: ['Direct', 'Low theory'],
      desc: 'Hit e4 on move one and dictate the game. The queen comes out early, so we learn exactly where it belongs.',
      seed: S, maxPly: 20,
      prefer: {
        'e4 d5 exd5': ['Qxd5', 'Recapture with the queen. Simple and direct.'],
        'e4 d5 exd5 Qxd5 Nc3': ['Qa5', 'The queen steps aside to a safe active square.'],
      },
      notes: { [S]: 'The Scandinavian: challenge e4 immediately.' },
    };
  })(),

  (() => {
    const S = 'e4 c5';
    return {
      id: 'sicilian-kan', name: 'Sicilian Kan', side: 'b', group: 'vs 1.e4', tags: ['Sicilian', 'Counter-attack'],
      desc: 'A flexible Sicilian with ...e6 and ...a6. Unbalanced, winnable positions with a fraction of the Najdorf theory.',
      seed: S, maxPly: 20,
      prefer: {
        'e4 c5 Nf3': ['e6', 'Flexible: control d5 and keep options for the f8 bishop.'],
        'e4 c5 Nf3 e6 d4': ['cxd4', 'Trade a wing pawn for a centre pawn.'],
        'e4 c5 Nf3 e6 d4 cxd4 Nxd4': ['a6', 'The Kan: take b5 away and prepare ...Qc7 and ...b5.'],
        'e4 c5 d4': ['cxd4', 'Take the pawn.'],
        'e4 c5 Nc3': ['Nc6', 'Develop, keeping an eye on d4.'],
      },
      notes: { [S]: 'The Sicilian: fight for d4 from the side and unbalance the game.' },
    };
  })(),

  (() => {
    const S = 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6';
    return {
      id: 'sicilian-dragon', name: 'Sicilian Dragon', side: 'b', group: 'vs 1.e4', tags: ['Sicilian', 'Sharp'],
      desc: 'Breathe fire down the long diagonal. Fianchetto, castle and counter-attack on the queenside.',
      seed: S, maxPly: 22,
      system: ['Bg7', 'O-O', 'Nc6', 'd5', 'Be6', 'Rc8'],
      notes: { [S]: 'The Dragon: the g7 bishop will breathe fire along the long diagonal.' },
    };
  })(),

  (() => {
    const S = 'e4 e5 Nf3 Nf6';
    return {
      id: 'petrov-defense', name: 'Petrov Defense', side: 'b', group: 'vs 1.e4', tags: ['Solid', 'Symmetrical'],
      desc: 'The most solid answer to 1.e4 e5 2.Nf3: counter-attack e4 and avoid the Ruy Lopez and Italian entirely.',
      seed: S, maxPly: 20,
      prefer: {
        [j(S, 'Nxe5')]: ['d6', 'Kick the knight before taking on e4. Taking right away runs into Qe2!'],
        [j(S, 'Nxe5 d6 Nf3')]: ['Nxe4', 'Now we win the pawn back safely.'],
        [j(S, 'd4')]: ['Nxe4', 'Take the centre pawn.'],
      },
      notes: { 'e4 e5': 'Meet e4 with e5.', [S]: 'The Petrov: counter-attack e4 instead of defending e5.' },
    };
  })(),

  (() => {
    const S = 'e4 e5 Nf3 Nf6 Nxe5 Nc6';
    return {
      id: 'stafford-gambit', name: 'Stafford Gambit', side: 'b', group: 'vs 1.e4', tags: ['Gambit', 'Traps', 'Fun'],
      desc: 'The trap-filled Petrov sideline made famous online. A pawn for wild piece play and lots of ways for White to go wrong.',
      seed: S, maxPly: 20, minShare: 0.05, trapShare: 0.02, minGames: 6, minProb: 0.002,
      prefer: {
        [j(S, 'Nxc6')]: ['dxc6', 'Recapture toward the centre. The open lines are our compensation.'],
        [j(S, 'Nxc6 dxc6 d3')]: ['Bc5', 'Aim at f2. Watch out for Bg5??, it walks into a big trick.'],
        [j(S, 'Nxc6 dxc6 Nc3')]: ['Bc5', 'Aim at f2.'],
        [j(S, 'Nxc6 dxc6 e5')]: ['Ne4', 'Jump into the centre.'],
      },
      extra: [
        'e4 e5 Nf3 Nf6 Nxe5 Nc6 Nxc6 dxc6 d3 Bc5 Bg5?? Nxe4 Bxd8?? Bxf2+ Ke2 Bg4#',
        'e4 e5 Nf3 Nf6 Nxe5 Nc6 Nxc6 dxc6 d3 Bc5 Bg5?? Nxe4 dxe4 Qxg5',
        'e4 e5 Nf3 Nf6 Nxe5 Nc6 Nxc6 dxc6 e5 Ne4 d3 Bc5 dxe4?? Bxf2+ Ke2 Bg4+ Kxf2 Qxd1',
      ],
      notes: {
        'e4 e5': 'Meet e4 with e5.', 'e4 e5 Nf3 Nf6': 'Petrov move order...', [S]: 'The Stafford Gambit! We give the e-pawn for quick, tricky development.',
        [j(S, 'Nxc6 dxc6 d3 Bc5 Bg5 Nxe4')]: '"Oh no, my queen!" Leave the queen hanging: the knight unleashes a deadly attack on f2.',
        [j(S, 'Nxc6 dxc6 d3 Bc5 Bg5 Nxe4 Bxd8 Bxf2+')]: 'White took the queen. Now check from f2...',
        [j(S, 'Nxc6 dxc6 d3 Bc5 Bg5 Nxe4 Bxd8 Bxf2+ Ke2 Bg4#')]: '...and Bg4 is checkmate! The king has nowhere to go.',
        [j(S, 'Nxc6 dxc6 d3 Bc5 Bg5 Nxe4 dxe4 Qxg5')]: 'White saw the mate and took the knight instead. Now we grab the bishop and come out a piece up.',
        [j(S, 'Nxc6 dxc6 e5 Ne4 d3 Bc5 dxe4 Bxf2+')]: 'White took the knight?? Check on f2 opens the d-file.',
        [j(S, 'Nxc6 dxc6 e5 Ne4 d3 Bc5 dxe4 Bxf2+ Ke2 Bg4+')]: 'Another check, pinning the queen behind the king.',
        [j(S, 'Nxc6 dxc6 e5 Ne4 d3 Bc5 dxe4 Bxf2+ Ke2 Bg4+ Kxf2 Qxd1')]: 'And the white queen falls. A classic Stafford trap!',
      },
    };
  })(),

  (() => {
    const S = 'e4 e5 Nf3 Nc6 Bc4 Nf6';
    return {
      id: 'two-knights-traxler', name: 'Two Knights & Traxler', side: 'b', group: 'vs 1.e4', tags: ['Counter-attack', 'Sharp', 'Traps'],
      desc: 'Meet the Italian with ...Nf6 and answer Ng5 with the wild Traxler: ...Bc5 and a counter-attack on f2.',
      seed: S, maxPly: 22,
      prefer: {
        [j(S, 'Ng5')]: ['Bc5', 'The Traxler! Ignore the threat on f7 and counter-attack f2.'],
        [j(S, 'Ng5 Bc5 Nxf7')]: ['Bxf2+', 'Take with check. White\'s king is in more danger than ours.'],
        [j(S, 'Ng5 Bc5 Bxf7+')]: ['Ke7', 'The king steps up: the bishop on f7 is a target.'],
        [j(S, 'd4')]: ['exd4', 'Take the centre pawn.'],
      },
      notes: { 'e4 e5': 'Meet e4 with e5.', 'e4 e5 Nf3 Nc6': 'Defend e5 with development.', [S]: 'The Two Knights: counter-attack e4 instead of copying with ...Bc5.' },
    };
  })(),

  (() => {
    const S = 'e4 e5 Nf3 Nc6 Bb5 f5';
    return {
      id: 'schliemann-gambit', name: 'Schliemann Gambit', side: 'b', group: 'vs 1.e4', tags: ['Gambit', 'Sharp'],
      desc: 'Answer the Ruy Lopez with ...f5 and turn the tables: an aggressive counter-gambit that avoids Spanish theory.',
      seed: S, maxPly: 20,
      notes: { 'e4 e5': 'Meet e4 with e5.', 'e4 e5 Nf3 Nc6': 'Defend e5.', [S]: 'The Schliemann: hit e4 with the f-pawn and play for the initiative.' },
    };
  })(),

  (() => {
    const S = 'd4 e5';
    return {
      id: 'englund-gambit', name: 'Englund Gambit', side: 'b', group: 'vs 1.d4', tags: ['Gambit', 'Traps', 'Offbeat'],
      desc: 'A cheeky reply to 1.d4 full of traps. Learn the famous queen raid on b2 and when to bail out.',
      seed: S, maxPly: 18, minShare: 0.05, trapShare: 0.02,
      prefer: {
        'd4 e5 dxe5': ['Nc6', 'Develop and attack the e5 pawn.'],
        'd4 e5 dxe5 Nc6 Nf3': ['Qe7', 'The Englund queen: pressure e5 and prepare ...Qb4+.'],
        'd4 e5 dxe5 Nc6 Nf3 Qe7 Bf4': ['Qb4+', 'Check, forking the king and the b2 pawn.'],
        'd4 e5 dxe5 Nc6 Nf3 Qe7 Bf4 Qb4+ Bd2': ['Qxb2', 'Grab the pawn. Now Bc3?? would walk into ...Bb4!'],
      },
      extra: ['d4 e5 dxe5 Nc6 Nf3 Qe7 Bf4 Qb4+ Bd2 Qxb2 Bc3?? Bb4 Qd2 Bxc3 Qxc3 Qc1#'],
      notes: {
        [S]: 'The Englund Gambit: a pawn for development, with traps everywhere.',
        'd4 e5 dxe5 Nc6 Nf3 Qe7 Bf4 Qb4+ Bd2 Qxb2 Bc3 Bb4': 'Bc3?? walks into it: pin the bishop! White cannot keep both the bishop and the rook.',
        'd4 e5 dxe5 Nc6 Nf3 Qe7 Bf4 Qb4+ Bd2 Qxb2 Bc3 Bb4 Qd2 Bxc3': 'Take the bishop. If the queen recaptures...',
        'd4 e5 dxe5 Nc6 Nf3 Qe7 Bf4 Qb4+ Bd2 Qxb2 Bc3 Bb4 Qd2 Bxc3 Qxc3 Qc1#': '...Qc1 is checkmate! The famous Englund trap.',
      },
    };
  })(),

  (() => {
    const S = 'd4 Nf6';
    return {
      id: 'kings-indian-defense', name: 'King\'s Indian Defense', side: 'b', group: 'vs 1.d4', tags: ['Dynamic', 'Counter-attack'],
      desc: 'More than an opening: let White build a centre, then hit back with ...e5 and a kingside attack.',
      seed: S, maxPly: 20,
      system: ['g6', 'Bg7', 'd6', 'O-O', 'e5', 'Nbd7', 'Nc6'],
      prefer: { 'd4 Nf6 c4': ['g6', 'Fianchetto: the King\'s Indian set-up.'] },
      notes: { [S]: 'Knight first keeps every option open and stops e4.' },
    };
  })(),

  (() => {
    const S = 'd4 d5';
    return {
      id: 'queens-gambit-declined', name: 'Queen\'s Gambit Declined', side: 'b', group: 'vs 1.d4', tags: ['Solid', 'Classical'],
      desc: 'The classical way to meet 1.d4: hold d5 with ...e6, develop smoothly and equalise with clear ideas.',
      seed: S, maxPly: 20,
      prefer: {
        'd4 d5 c4': ['e6', 'Decline the gambit and keep a strong pawn on d5.'],
        'd4 d5 c4 e6 Nc3': ['Nf6', 'Develop and defend d5.'],
        'd4 d5 c4 e6 Nf3': ['Nf6', 'Develop.'],
        'd4 d5 c4 e6 cxd5': ['exd5', 'Recapture with the pawn.'],
        'd4 d5 Nf3': ['Nf6', 'Develop.'],
        'd4 d5 Bf4': ['Nf6', 'Develop against the London.'],
      },
      notes: { [S]: 'Take the centre with d5.' },
    };
  })(),

  (() => {
    const S = 'd4 d5 c4 dxc4';
    return {
      id: 'queens-gambit-accepted', name: 'Queen\'s Gambit Accepted', side: 'b', group: 'vs 1.d4', tags: ['Solid', 'Low theory'],
      desc: 'Take the pawn, give it back at the right moment and equalise fast with clear ideas instead of a mountain of theory.',
      seed: S, maxPly: 20,
      prefer: { [j(S, 'e4')]: ['e5', 'Hit back in the centre immediately.'] },
      notes: { 'd4 d5': 'Take the centre.', [S]: 'Accept! We won\'t hold on to the pawn; we use the time to hit the centre.' },
    };
  })(),

  (() => {
    const S = 'd4 d5 c4 c6';
    return {
      id: 'slav-defense', name: 'Slav Defense', side: 'b', group: 'vs 1.d4', tags: ['Solid'],
      desc: 'Support d5 with ...c6 and keep the light-squared bishop free. Rock-solid and popular at every level.',
      seed: S, maxPly: 20,
      prefer: {
        [j(S, 'Nf3')]: ['Nf6', 'Develop.'],
        [j(S, 'Nc3')]: ['Nf6', 'Develop.'],
        [j(S, 'cxd5')]: ['cxd5', 'Recapture, keeping the symmetrical pawn structure.'],
      },
      notes: { 'd4 d5': 'Take the centre.', [S]: 'The Slav: ...c6 holds d5 without blocking the c8 bishop.' },
    };
  })(),

  (() => {
    const S = 'd4 f5';
    return {
      id: 'dutch-defense', name: 'Dutch Defense', side: 'b', group: 'vs 1.d4', tags: ['Aggressive', 'Kingside'],
      desc: 'Grab e4 with the f-pawn and aim for a kingside attack. Leningrad set-up with ...g6, ...Bg7 and ...d6.',
      seed: S, maxPly: 20,
      system: ['Nf6', 'g6', 'Bg7', 'O-O', 'd6'],
      prefer: { 'd4 f5 e4': ['fxe4', 'Take the Staunton Gambit pawn.'] },
      notes: { [S]: 'The Dutch: fight for e4 from the side and prepare a kingside attack.' },
    };
  })(),

  (() => {
    const S = 'd4 d5 c4 e5';
    return {
      id: 'albin-countergambit', name: 'Albin Countergambit', side: 'b', group: 'vs 1.d4', tags: ['Gambit', 'Traps'],
      desc: 'Answer the Queen\'s Gambit with a gambit of your own. The d4 wedge cramps White and sets the Lasker Trap.',
      seed: S, maxPly: 20,
      prefer: {
        [j(S, 'dxe5')]: ['d4', 'The Albin pawn on d4 is a thorn in White\'s side.'],
        [j(S, 'dxe5 d4 Nf3')]: ['Nc6', 'Develop and attack e5.'],
      },
      notes: { 'd4 d5': 'Take the centre.', [S]: 'The Albin Countergambit: counter-attack instead of defending.' },
    };
  })(),

  (() => {
    const S = 'd4 Nf6 c4 e5';
    return {
      id: 'budapest-gambit', name: 'Budapest Gambit', side: 'b', group: 'vs 1.d4', tags: ['Gambit', 'Traps'],
      desc: 'Strike at d4 with ...e5 on move two. Active pieces, quick pressure on e5 and some nasty traps.',
      seed: S, maxPly: 20,
      prefer: {
        [j(S, 'dxe5')]: ['Ng4', 'Attack e5 right away.'],
        [j(S, 'dxe5 Ng4 Nf3')]: ['Nc6', 'Pile up on e5.'],
        [j(S, 'dxe5 Ng4 Bf4')]: ['Nc6', 'More pressure on e5.'],
        [j(S, 'dxe5 Ng4 e4')]: ['Nxe5', 'Win the pawn back.'],
      },
      notes: { 'd4 Nf6': 'Knight first.', [S]: 'The Budapest Gambit: hit d4 and win the pawn back with active pieces.' },
    };
  })(),

  (() => {
    const S = 'd4 Nf6 c4 c5 d5 b5';
    return {
      id: 'benko-gambit', name: 'Benko Gambit', side: 'b', group: 'vs 1.d4', tags: ['Gambit', 'Positional'],
      desc: 'Give a queenside pawn for open a- and b-files and long-term pressure. A positional gambit that wins endgames.',
      seed: S, maxPly: 20,
      prefer: {
        [j(S, 'cxb5')]: ['a6', 'Offer a second pawn to open the a-file too.'],
        [j(S, 'cxb5 a6 bxa6')]: ['Bxa6', 'Recapture with the bishop: our pieces fly onto the open files.'],
      },
      notes: { 'd4 Nf6': 'Knight first.', 'd4 Nf6 c4 c5': 'Challenge d4.', [S]: 'The Benko Gambit: open files for our rooks.' },
    };
  })(),
];
