/* ============================================================
   KRYPTØN — ai.js
   Evaluation + alpha-beta search with five difficulty tiers.
   ============================================================ */
(function (global) {
  'use strict';

  var Chess = global.Chess;
  var W = Chess.W, B = Chess.B;

  var INF = 1000000;
  var MATE = 100000;

  var VALUE = Chess.VALUE;          /* p100 n320 b330 r500 q900 */
  var PHASE = Chess.PHASE;          /* n1 b1 r2 q4 */
  var fileOf = Chess.fileOf, rankOf = Chess.rankOf, onBoard = Chess.onBoard;
  var square = Chess.square, typeOf = Chess.typeOf, other = Chess.other;

  /* ---------------- piece-square tables ----------------
     Rows are listed from rank 8 down to rank 1 so that the
     table index matches the board index directly.          */

  var PST_MG = {
    p: [
      0, 0, 0, 0, 0, 0, 0, 0,
      50, 50, 50, 50, 50, 50, 50, 50,
      10, 10, 20, 30, 30, 20, 10, 10,
      5, 5, 10, 25, 25, 10, 5, 5,
      0, 0, 0, 20, 20, 0, 0, 0,
      5, -5, -10, 0, 0, -10, -5, 5,
      5, 10, 10, -20, -20, 10, 10, 5,
      0, 0, 0, 0, 0, 0, 0, 0
    ],
    n: [
      -50, -40, -30, -30, -30, -30, -40, -50,
      -40, -20, 0, 0, 0, 0, -20, -40,
      -30, 0, 10, 15, 15, 10, 0, -30,
      -30, 5, 15, 20, 20, 15, 5, -30,
      -30, 0, 15, 20, 20, 15, 0, -30,
      -30, 5, 10, 15, 15, 10, 5, -30,
      -40, -20, 0, 5, 5, 0, -20, -40,
      -50, -40, -30, -30, -30, -30, -40, -50
    ],
    b: [
      -20, -10, -10, -10, -10, -10, -10, -20,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -10, 0, 5, 10, 10, 5, 0, -10,
      -10, 5, 5, 10, 10, 5, 5, -10,
      -10, 0, 10, 10, 10, 10, 0, -10,
      -10, 10, 10, 10, 10, 10, 10, -10,
      -10, 5, 0, 0, 0, 0, 5, -10,
      -20, -10, -10, -10, -10, -10, -10, -20
    ],
    r: [
      0, 0, 0, 0, 0, 0, 0, 0,
      5, 10, 10, 10, 10, 10, 10, 5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      0, 0, 0, 5, 5, 0, 0, 0
    ],
    q: [
      -20, -10, -10, -5, -5, -10, -10, -20,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -10, 0, 5, 5, 5, 5, 0, -10,
      -5, 0, 5, 5, 5, 5, 0, -5,
      0, 0, 5, 5, 5, 5, 0, -5,
      -10, 5, 5, 5, 5, 5, 0, -10,
      -10, 0, 5, 0, 0, 0, 0, -10,
      -20, -10, -10, -5, -5, -10, -10, -20
    ],
    k: [
      -60, -50, -50, -60, -60, -50, -50, -60,
      -40, -30, -30, -45, -45, -30, -30, -40,
      -30, -20, -20, -35, -35, -20, -20, -30,
      -20, -10, -10, -25, -25, -10, -10, -20,
      -10, 0, 0, -15, -15, 0, 0, -10,
      0, 5, 5, -5, -5, 5, 5, 0,
      10, 15, 20, 5, 5, 20, 15, 10,
      0, 0, 0, 0, 0, 0, 0, 0
    ]
  };

  var PST_EG = {
    p: [
      0, 0, 0, 0, 0, 0, 0, 0,
      80, 80, 80, 80, 80, 80, 80, 80,
      50, 50, 50, 50, 50, 50, 50, 50,
      30, 30, 30, 30, 30, 30, 30, 30,
      25, 25, 25, 25, 25, 25, 25, 25,
      15, 10, 5, 0, 0, 5, 10, 15,
      5, 0, 0, 0, 0, 0, 0, 5,
      0, 0, 0, 0, 0, 0, 0, 0
    ],
    n: [
      -50, -40, -30, -30, -30, -30, -40, -50,
      -40, -20, 0, 0, 0, 0, -20, -40,
      -30, 0, 10, 15, 15, 10, 0, -30,
      -30, 5, 15, 20, 20, 15, 5, -30,
      -30, 0, 15, 20, 20, 15, 0, -30,
      -30, 5, 10, 15, 15, 10, 5, -30,
      -40, -20, 0, 5, 5, 0, -20, -40,
      -50, -40, -30, -30, -30, -30, -40, -50
    ],
    b: [
      -20, -10, -10, -10, -10, -10, -10, -20,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -10, 0, 5, 10, 10, 5, 0, -10,
      -10, 5, 5, 10, 10, 5, 5, -10,
      -10, 0, 10, 10, 10, 10, 0, -10,
      -10, 10, 10, 10, 10, 10, 10, -10,
      -10, 5, 0, 0, 0, 0, 5, -10,
      -20, -10, -10, -10, -10, -10, -10, -20
    ],
    r: [
      0, 0, 0, 0, 0, 0, 0, 0,
      5, 10, 10, 10, 10, 10, 10, 5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      0, 0, 0, 5, 5, 0, 0, 0
    ],
    q: [
      -20, -10, -10, -5, -5, -10, -10, -20,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -10, 0, 5, 5, 5, 5, 0, -10,
      -5, 0, 5, 5, 5, 5, 0, -5,
      0, 0, 5, 5, 5, 5, 0, -5,
      -10, 5, 5, 5, 5, 5, 0, -10,
      -10, 0, 5, 0, 0, 0, 0, -10,
      -20, -10, -10, -5, -5, -10, -10, -20
    ],
    k: [
      -50, -40, -30, -20, -20, -30, -40, -50,
      -30, -20, -10, 0, 0, -10, -20, -30,
      -30, -10, 20, 30, 30, 20, -10, -30,
      -30, -10, 30, 40, 40, 30, -10, -30,
      -30, -10, 30, 40, 40, 30, -10, -30,
      -30, -10, 20, 30, 30, 20, -10, -30,
      -30, -30, 0, 0, 0, 0, -30, -30,
      -50, -30, -30, -30, -30, -30, -30, -50
    ]
  };

  /* black tables are the white tables rotated 180 degrees */
  var PST_MG_B = {}, PST_EG_B = {};
  (function () {
    ['p', 'n', 'b', 'r', 'q', 'k'].forEach(function (t) {
      var a = new Array(64), c = new Array(64);
      for (var i = 0; i < 64; i++) { a[i] = PST_MG[t][63 - i]; c[i] = PST_EG[t][63 - i]; }
      PST_MG_B[t] = a; PST_EG_B[t] = c;
    });
  })();

  var PASSED_MG = [0, 6, 13, 28, 50, 80, 125, 0];
  var PASSED_EG = [0, 12, 24, 46, 80, 125, 185, 0];

  /* ---------------- evaluation ---------------- */

  function countAttacks(pos, sq, t) {
    var b = pos.board;
    var f = fileOf(sq), r = rankOf(sq);
    var white = b[sq] === b[sq].toUpperCase();
    var cnt = 0, i, df, dr, x, y, p;

    if (t === 'n') {
      for (i = 0; i < 8; i++) {
        var nf = f + Chess.KNIGHT_DELTAS[i][0], nr = r + Chess.KNIGHT_DELTAS[i][1];
        if (!onBoard(nf, nr)) continue;
        var np = b[square(nf, nr)];
        if (!np) cnt++;
        else if ((np === np.toUpperCase()) !== white) cnt++;
      }
      return cnt;
    }
    var dirs = t === 'b' ? Chess.BISHOP_DIRS : (t === 'r' ? Chess.ROOK_DIRS : Chess.QUEEN_DIRS);
    for (i = 0; i < dirs.length; i++) {
      df = dirs[i][0]; dr = dirs[i][1];
      x = f + df; y = r + dr;
      while (onBoard(x, y)) {
        p = b[square(x, y)];
        if (!p) cnt++;
        else { if ((p === p.toUpperCase()) !== white) cnt++; break; }
        x += df; y += dr;
      }
    }
    return cnt;
  }

  /* score in centipawns, always from White's point of view */
  function evaluate(pos) {
    var b = pos.board;
    var mg = 0, eg = 0, phase = 0, i, s, p, t, white, sign, f, r, color;
    var pawnFiles = { w: new Array(8).fill(0), b: new Array(8).fill(0) };
    var bishops = { w: 0, b: 0 };
    var list = [];

    for (s = 0; s < 64; s++) {
      p = b[s];
      if (!p) continue;
      t = typeOf(p);
      white = p === p.toUpperCase();
      sign = white ? 1 : -1;
      color = white ? 'w' : 'b';
      mg += sign * (VALUE[t] + (white ? PST_MG[t][s] : PST_MG_B[t][s]));
      eg += sign * (VALUE[t] + (white ? PST_EG[t][s] : PST_EG_B[t][s]));
      phase += PHASE[t];
      if (t === 'p') pawnFiles[color][fileOf(s)]++;
      if (t === 'b') bishops[color]++;
      list.push({ t: t, s: s, white: white });

      /* middlegame-only terms (they fade out as `mgW` shrinks) */
      if (t === 'n' || t === 'b') {
        /* leaving the back rank is worth something early on */
        if (white ? (s === 57 || s === 58 || s === 61 || s === 62)
                  : (s === 1 || s === 2 || s === 5 || s === 6)) mg -= sign * 13;
      }
    }

    var mgW = Math.min(1, phase / 16);
    var egW = 1 - mgW;
    var score = mg * mgW + eg * egW;

    /* bishop pair */
    if (bishops.w >= 2) score += 30 * mgW + 45 * egW;
    if (bishops.b >= 2) score -= 30 * mgW + 45 * egW;

    /* pawn structure + passed pawns */
    for (i = 0; i < list.length; i++) {
      if (list[i].t !== 'p') continue;
      s = list[i].s; white = list[i].white; sign = white ? 1 : -1;
      color = white ? 'w' : 'b';
      f = fileOf(s); r = rankOf(s);

      if (pawnFiles[color][f] > 1) score -= sign * (11 * mgW + 24 * egW);

      var left = f > 0 ? pawnFiles[color][f - 1] : 0;
      var right = f < 7 ? pawnFiles[color][f + 1] : 0;
      if (left === 0 && right === 0) score -= sign * (9 * mgW + 14 * egW);

      var passed = true;
      for (var j = 0; j < list.length; j++) {
        if (list[j].t !== 'p' || list[j].white === white) continue;
        var of_ = fileOf(list[j].s), or_ = rankOf(list[j].s);
        if (Math.abs(of_ - f) <= 1) {
          var ahead = white ? or_ < r : or_ > r;
          if (ahead) { passed = false; break; }
        }
      }
      if (passed) {
        var adv = white ? 6 - r : r - 1;
        if (adv < 0) adv = 0; if (adv > 6) adv = 6;
        score += sign * (PASSED_MG[adv] * mgW + PASSED_EG[adv] * egW);
      }
    }

    /* rooks on open / semi-open files */
    for (i = 0; i < list.length; i++) {
      if (list[i].t !== 'r') continue;
      white = list[i].white; sign = white ? 1 : -1;
      f = fileOf(list[i].s);
      var mine = pawnFiles[white ? 'w' : 'b'][f];
      var theirs = pawnFiles[white ? 'b' : 'w'][f];
      if (mine === 0 && theirs === 0) score += sign * (18 * mgW + 12 * egW);
      else if (mine === 0) score += sign * (9 * mgW + 6 * egW);
    }

    /* mobility */
    for (i = 0; i < list.length; i++) {
      t = list[i].t;
      if (t === 'p' || t === 'k') continue;
      sign = list[i].white ? 1 : -1;
      var mob = countAttacks(pos, list[i].s, t);
      if (t === 'n') score += sign * (mob - 4) * 4 * mgW;
      else if (t === 'b') score += sign * (mob - 6) * 3 * mgW;
      else if (t === 'r') score += sign * (mob - 7) * 2 * mgW;
      else if (t === 'q') score += sign * (mob - 14) * 1 * mgW;
    }

    /* king shelter */
    for (i = 0; i < list.length; i++) {
      if (list[i].t !== 'k') continue;
      s = list[i].s; white = list[i].white; sign = white ? 1 : -1;
      var dir = white ? -1 : 1;
      var shield = 0, df2, dr2, nf2, nr2;
      for (df2 = -1; df2 <= 1; df2++) {
        nf2 = fileOf(s) + df2;
        if (!onBoard(nf2, rankOf(s))) continue;
        for (dr2 = 1; dr2 <= 2; dr2++) {
          nr2 = rankOf(s) + dir * dr2;
          if (!onBoard(nf2, nr2)) continue;
          var kp = b[square(nf2, nr2)];
          if (kp && typeOf(kp) === 'p' && (kp === kp.toUpperCase()) === white) shield += (dr2 === 1 ? 9 : 5);
        }
      }
      score += sign * shield * mgW;
    }

    /* king safety — worth a lot in the middlegame, nothing once the board empties */
    if (mgW > 0.05) {
      for (i = 0; i < list.length; i++) {
        if (list[i].t !== 'k') continue;
        s = list[i].s; white = list[i].white; sign = white ? 1 : -1;
        var kf2 = fileOf(s), kr2 = rankOf(s);
        var castled2 = white ? (s === 62 || s === 58) : (s === 6 || s === 2);
        var advanced = white ? (7 - kr2) : kr2;      /* ranks walked away from home */
        if (castled2) {
          score += sign * 28 * mgW;
        } else if (advanced === 0) {
          /* still on the back rank but not tucked away — passive and it blocks the rook */
          if (kf2 !== 4) score -= sign * 9 * mgW;
          if (kf2 === 3 || kf2 === 4) score -= sign * 13 * mgW;
        } else {
          score -= sign * (13 * advanced) * mgW;
          if (kf2 >= 2 && kf2 <= 5) score -= sign * 10 * mgW;   /* open central files */
        }
      }
    }

    /* tempo */
    score += (pos.turn === W) ? 12 : -12;
    return score;
  }

  /* ---------------- zobrist hashing ---------------- */

  var ZOB_A = {}, ZOB_B = {};
  (function () {
    var seed = 0x1a2b3c4d;
    function rnd() {
      seed ^= seed << 13; seed >>>= 0;
      seed ^= seed >>> 17;
      seed ^= seed << 5; seed >>>= 0;
      return seed >>> 0;
    }
    var colors = ['W', 'B'], types = 'pnbrqk';
    for (var c = 0; c < 2; c++) {
      var tbl = c === 0 ? ZOB_A : ZOB_B;
      for (var i = 0; i < colors.length; i++) {
        for (var t = 0; t < types.length; t++) {
          for (var s = 0; s < 64; s++) tbl[colors[i] + types[t] + s] = rnd();
        }
      }
      tbl.side = rnd();
      for (var k = 0; k < 4; k++) tbl['c' + 'KQkq'[k]] = rnd();
      for (var e = 0; e < 64; e++) tbl['e' + e] = rnd();
    }
  })();

  function hashPosition(pos) {
    var b = pos.board, h1 = 0, h2 = 0, i, s, p, key;
    for (s = 0; s < 64; s++) {
      p = b[s];
      if (!p) continue;
      key = (p === p.toUpperCase() ? 'W' : 'B') + typeOf(p) + s;
      h1 ^= ZOB_A[key]; h2 ^= ZOB_B[key];
    }
    if (pos.turn === W) { h1 ^= ZOB_A.side; h2 ^= ZOB_B.side; }
    for (i = 0; i < pos.castling.length; i++) {
      key = 'c' + pos.castling[i];
      h1 ^= ZOB_A[key]; h2 ^= ZOB_B[key];
    }
    if (pos.ep >= 0) {
      key = 'e' + pos.ep;
      h1 ^= ZOB_A[key]; h2 ^= ZOB_B[key];
    }
    return h1.toString(36) + ':' + h2.toString(36);
  }

  /* ---------------- search ---------------- */

  function orderMoves(moves, ttMove, killers, ply, history) {
    var scored = [], i, m, s;
    for (i = 0; i < moves.length; i++) {
      m = moves[i];
      s = 0;
      if (ttMove && m.from === ttMove.from && m.to === ttMove.to && (m.promo || '') === (ttMove.promo || '')) {
        s = 5000000;
      } else if (m.captured) {
        var victim = VALUE[typeOf(m.captured)];
        var attacker = VALUE[typeOf(m.piece)];
        s = 1000000 + victim * 10 - attacker;
        if (m.promo) s += 50000 + VALUE[m.promo];
      } else if (m.promo) {
        s = 900000 + VALUE[m.promo];
      } else {
        var k = killers[ply];
        if (k && k[0] && k[0].from === m.from && k[0].to === m.to) s = 800000;
        else if (k && k[1] && k[1].from === m.from && k[1].to === m.to) s = 790000;
        else s = history.get(m.from * 64 + m.to) || 0;
      }
      scored.push({ m: m, s: s });
    }
    scored.sort(function (a, b) { return b.s - a.s; });
    return scored;
  }

  function hasNonPawn(pos, color) {
    for (var s = 0; s < 64; s++) {
      var p = pos.board[s];
      if (!p) continue;
      if ((p === p.toUpperCase()) !== (color === W)) continue;
      var t = typeOf(p);
      if (t !== 'p' && t !== 'k') return true;
    }
    return false;
  }

  function negamax(pos, depth, alpha, beta, ply, ctx) {
    ctx.nodes++;
    if ((ctx.nodes & 1023) === 0 && Date.now() - ctx.start > ctx.timeLimit) { ctx.aborted = true; return 0; }

    var key = hashPosition(pos);
    var entry = ctx.useTT ? ctx.tt.get(key) : null;
    var ttMove = null;
    if (entry) {
      ttMove = entry.move;
      if (entry.depth >= depth && Math.abs(entry.score) < MATE - 1000) {
        if (entry.flag === 0) return entry.score;
        if (entry.flag === 1 && entry.score >= beta) return entry.score;
        if (entry.flag === 2 && entry.score <= alpha) return entry.score;
      }
    }

    /* draws */
    if (pos.halfmove >= 100) return 0;
    if (ctx.path.indexOf(key) >= 0) return 0;
    ctx.path.push(key);

    var alphaOrig = alpha;
    var ksq = Chess.kingSquare(pos, pos.turn);
    var inCheck = ksq >= 0 && Chess.isAttacked(pos, ksq, other(pos.turn));

    if (inCheck) depth++;                       /* check extension */
    if (depth <= 0) {
      var q = quiescence(pos, alpha, beta, ply, ctx);
      ctx.path.pop();
      return q;
    }

    /* null-move pruning */
    if (ctx.cfg.nullMove && depth >= 3 && !inCheck && beta < INF &&
        hasNonPawn(pos, pos.turn) && (pos.turn === W ? 1 : -1) * evaluate(pos) >= beta) {
      var savedTurn = pos.turn, savedEp = pos.ep;
      pos.turn = other(pos.turn); pos.ep = -1;
      var R = 2 + (depth > 6 ? 1 : 0);
      var nullScore = -negamax(pos, depth - 1 - R, -beta, -beta + 1, ply + 1, ctx);
      pos.turn = savedTurn; pos.ep = savedEp;
      if (ctx.aborted) { ctx.path.pop(); return 0; }
      if (nullScore >= beta) { ctx.path.pop(); return nullScore; }
    }

    var moves = orderMoves(Chess.genPseudo(pos), ttMove, ctx.killers, ply, ctx.history);
    var legal = 0, best = -INF, bestMove = null;
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i].m;
      if (!Chess.makeLegal(pos, m)) continue;
      legal++;
      var score = -negamax(pos, depth - 1, -beta, -alpha, ply + 1, ctx);
      Chess.unmakeMove(pos);
      if (ctx.aborted) { ctx.path.pop(); return 0; }
      if (score > best) { best = score; bestMove = m; }
      if (score > alpha) {
        alpha = score;
        if (alpha >= beta) {
          if (!m.captured && !m.promo) {
            var k = ctx.killers[ply] || [null, null];
            ctx.killers[ply] = [m, k[0]];
            var hk = m.from * 64 + m.to;
            ctx.history.set(hk, (ctx.history.get(hk) || 0) + depth * depth);
          }
          break;
        }
      }
    }

    ctx.path.pop();

    if (legal === 0) return inCheck ? (-MATE + ply) : 0;

    var flag = alpha <= alphaOrig ? 2 : (alpha >= beta ? 1 : 0);
    if (!ctx.useTT) return best;
    if (ctx.tt.size > 300000) ctx.tt.clear();
    ctx.tt.set(key, { depth: depth, score: best, flag: flag, move: bestMove });
    return best;
  }

  function quiescence(pos, alpha, beta, ply, ctx) {
    ctx.nodes++;
    if ((ctx.nodes & 1023) === 0 && Date.now() - ctx.start > ctx.timeLimit) { ctx.aborted = true; return 0; }
    if (ply > 40) return evaluate(pos) * (pos.turn === W ? 1 : -1);

    var sign = pos.turn === W ? 1 : -1;
    var stand = sign * evaluate(pos);
    /* fail-soft: return the real score, never `beta` (a mate-window beta would
       otherwise turn into a phantom mate score) */
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;

    var all = Chess.genPseudo(pos);
    var caps = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].captured || all[i].promo) caps.push(all[i]);
    }
    caps = orderMoves(caps, null, ctx.killers, ply, ctx.history);

    for (var j = 0; j < caps.length; j++) {
      var m = caps[j].m;
      if (!Chess.makeLegal(pos, m)) continue;
      var score = -quiescence(pos, -beta, -alpha, ply + 1, ctx);
      Chess.unmakeMove(pos);
      if (ctx.aborted) return 0;
      if (score > stand) stand = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) return beta;
    }
    return stand;
  }

  /*
   * Root search.
   *
   * Every root move is given a full window unless the level plays
   * "perfectly" (margin === 0), where PVS is safe because only the single
   * best move is ever used.  This matters: with a null-window search the
   * losers return an upper bound equal to alpha, so every mediocre move
   * would look exactly as good as the best one and tie-breaking would
   * degrade into random play.
   *
   * The loop is async and yields between root moves, so even a deep
   * search never blocks the page for more than a fraction of a second.
   */
  async function rootSearch(pos, depth, ctx, budgetStart, onYield) {
    var all = Chess.genPseudo(pos);
    var key = hashPosition(pos);
    var entry = ctx.useTT ? ctx.tt.get(key) : null;
    var ordered = orderMoves(all, entry ? entry.move : null, ctx.killers, 0, ctx.history);
    var results = [];
    var alpha = -INF, best = null;
    var perfect = (ctx.cfg.margin === 0);
    var lastYield = Date.now();

    for (var i = 0; i < ordered.length; i++) {
      var m = ordered[i].m;
      var now = Date.now();
      if (budgetStart && now - budgetStart > ctx.cfg.time) {
        return { aborted: true, results: results };
      }
      ctx.start = now;
      var remaining = ctx.cfg.time - (budgetStart ? now - budgetStart : 0);
      ctx.timeLimit = Math.min(ctx.cfg.slice, remaining);
      ctx.aborted = false;

      if (!Chess.makeLegal(pos, m)) continue;
      var score, exact = true;
      if (best !== null && perfect) {
        /* scouts with a null window; only re-searches when the move beats alpha,
           so a fail-low score is an upper bound and is marked inexact */
        score = -negamax(pos, depth - 1, -INF, -alpha, 1, ctx);
        if (!ctx.aborted && score > alpha) score = -negamax(pos, depth - 1, -INF, INF, 1, ctx);
        else exact = false;
      } else {
        score = -negamax(pos, depth - 1, -INF, INF, 1, ctx);
      }
      Chess.unmakeMove(pos);
      if (ctx.aborted) return { aborted: true, results: results };

      results.push({ m: m, score: score, exact: exact });
      if (!best || score > best.score) best = { m: m, score: score };
      if (score > alpha) alpha = score;
      if (best.score >= MATE - 1000) break;   /* mate found — nothing can beat it */

      /* hand the thread back so the UI keeps painting */
      if (Date.now() - lastYield > 18) {
        await sleep(0);
        lastYield = Date.now();
        if (onYield) onYield(results);
      }
    }

    if (!best) return { aborted: false, move: null, score: 0, results: results, nodes: ctx.nodes };
    if (ctx.useTT) ctx.tt.set(key, { depth: depth, score: best.score, flag: 0, move: best.m });
    return { aborted: false, move: best.m, score: best.score, results: results, nodes: ctx.nodes };
  }

  /* ---------------- difficulty tiers ---------------- */

  var LEVELS = [
    {
      id: 'novice', name: 'NOX', title: 'The Shadow Strategist', elo: 450,
      depth: 1, time: 250, slice: 250,
      blunder: 0.50, margin: 200, qsearch: false, nullMove: false,
      tagline: 'The Shadow Strategist',
      blurb: 'Strikes from the dark and barely thinks ahead — it will hand you pieces for free. The place to learn how the pieces move.'
    },
    {
      id: 'casual', name: 'DEEPNIGHT', title: 'The Calculating Master', elo: 850,
      depth: 2, time: 500, slice: 250,
      blunder: 0.22, margin: 90, qsearch: false, nullMove: false,
      tagline: 'The Calculating Master',
      blurb: 'Counts one move ahead and sees the obvious threat, but the deeper ideas slip past it. Beatable with care.'
    },
    {
      id: 'club', name: 'AXIOM', title: 'The Logical Genius', elo: 1200,
      depth: 3, time: 950, slice: 300,
      blunder: 0.04, margin: 20, qsearch: true, nullMove: false,
      tagline: 'The Logical Genius',
      blurb: 'Cold and consistent: punishes loose pieces and collects free material. A fair fight for a beginner.'
    },
    {
      id: 'expert', name: 'CAISSA', title: 'The Spirit of Chess', elo: 1550,
      depth: 5, time: 1800, slice: 350,
      blunder: 0, margin: 8, qsearch: true, nullMove: true,
      tagline: 'The Spirit of Chess',
      blurb: 'Searches five moves deep and plays the position, not the tricks. Mistakes get punished immediately.'
    },
    {
      id: 'master', name: 'NEMESIS', title: 'The Ultimate Challenger', elo: 1900,
      depth: 7, time: 2600, slice: 420,
      blunder: 0, margin: 0, qsearch: true, nullMove: true,
      tagline: 'The Ultimate Challenger',
      blurb: 'The final boss: deepest search, endgame knowledge, no mercy. Bring your best game.'
    }
  ];

  function getLevel(id) {
    var key = String(id || '').toLowerCase();
    for (var i = 0; i < LEVELS.length; i++) {
      if (LEVELS[i].id === key) return LEVELS[i];
    }
    /* accept the bot's own name too: ?level=NEMESIS */
    for (var j = 0; j < LEVELS.length; j++) {
      if (LEVELS[j].name.toLowerCase() === key) return LEVELS[j];
    }
    return LEVELS[2];
  }

  function sleep(ms) {
    return new Promise(function (res) { setTimeout(res, ms); });
  }

  /*
   * Picks a move for the side to move.
   * opts: { levelId, onProgress }
   */
  async function findBestMove(pos, levelId, opts) {
    opts = opts || {};
    var cfg = getLevel(levelId);
    var p = pos.clone();
    var legal = Chess.legalMoves(p);
    if (!legal.length) return null;

    /* scripted "human" mistakes */
    if (!opts.noBlunder && Math.random() < cfg.blunder) {
      var captures = legal.filter(function (m) { return !!m.captured; });
      var pool = (captures.length && Math.random() < 0.7) ? captures : legal;
      var pick = pool[Math.floor(Math.random() * pool.length)];
      return { move: pick, score: 0, depth: 1, nodes: 0, blunder: true, level: cfg };
    }

    var ctx = {
      cfg: cfg, tt: new Map(), killers: [], history: new Map(),
      nodes: 0, start: Date.now(), timeLimit: cfg.time, aborted: false, path: [],
      useTT: opts.useTT !== false
    };

    /* Iterative deepening. The root yields between moves, so the page stays
       responsive; a depth that runs out of time is simply discarded and the
       previous (complete) depth is used. */
    var budgetStart = Date.now();
    var best = null, lastDepth = 0;

    for (var depth = 1; depth <= cfg.depth; depth++) {
      if (Date.now() - budgetStart > cfg.time) break;
      var res = await rootSearch(p, depth, ctx, budgetStart, function (partial) {
        if (opts.onProgress && partial.length) {
          var top = partial[0];
          for (var k = 1; k < partial.length; k++) if (partial[k].score > top.score) top = partial[k];
          opts.onProgress({ depth: depth, score: top.score, nodes: ctx.nodes });
        }
      });
      if (res.aborted) break;
      if (res.move) { best = res; lastDepth = depth; }
      if (opts.onProgress) {
        opts.onProgress({ depth: lastDepth, score: best ? best.score : 0, nodes: ctx.nodes });
      }
      await sleep(0);
    }

    if (!best) {
      var fallback = legal[0];
      return { move: fallback, score: 0, depth: 1, nodes: ctx.nodes, level: cfg };
    }

    /* Pick among moves within `margin` of the best one. Only exactly scored
       moves qualify — a null-window fail-low reports the same number as alpha
       and would otherwise be mistaken for an equally good move. */
    var margin = opts.exact ? 0 : cfg.margin;
    var pool = best.results.filter(function (r) {
      return r.exact !== false && r.score >= best.score - margin;
    });
    if (!pool.length) pool = [{ m: best.move, score: best.score }];
    var chosen = pool[Math.floor(Math.random() * pool.length)];

    return {
      move: chosen.m,
      score: chosen.score,
      depth: lastDepth,
      nodes: ctx.nodes,
      level: cfg,
      results: best.results
    };
  }

  /* a quick, fast evaluation used for the eval bar */
  function quickEval(pos) {
    return evaluate(pos);
  }

  global.ChessAI = {
    LEVELS: LEVELS,
    getLevel: getLevel,
    findBestMove: findBestMove,
    evaluate: evaluate,
    quickEval: quickEval
  };
})(typeof window !== 'undefined' ? window : globalThis);
