/* ============================================================
   Arena Chess — engine.js
   Rules layer: board representation, move generation, make/unmake,
   SAN notation, FEN, terminal-state detection.
   Board index: 0 = a8 ... 63 = h1  (rank 0 == rank 8)
   ============================================================ */
(function (global) {
  'use strict';

  var W = 'w';
  var B = 'b';

  var START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  var FILES = 'abcdefgh';

  var KNIGHT_DELTAS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  var BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  var ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  var QUEEN_DIRS = BISHOP_DIRS.concat(ROOK_DIRS);
  var KING_DIRS = QUEEN_DIRS;

  var VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  var PHASE = { p: 0, n: 1, b: 1, r: 2, q: 4, k: 0 };

  /* ---------------- helpers ---------------- */

  function square(file, rank) { return rank * 8 + file; }
  function fileOf(sq) { return sq & 7; }
  function rankOf(sq) { return sq >> 3; }
  function onBoard(f, r) { return f >= 0 && f < 8 && r >= 0 && r < 8; }
  function other(color) { return color === W ? B : W; }
  function typeOf(piece) { return piece.toLowerCase(); }
  function isWhitePiece(piece) { return piece === piece.toUpperCase(); }
  function squareName(sq) { return FILES[fileOf(sq)] + (8 - rankOf(sq)); }

  /* ---------------- position ---------------- */

  function Position(fen) {
    this.board = new Array(64).fill(null);
    this.turn = W;
    this.castling = '';
    this.ep = -1;
    this.halfmove = 0;
    this.fullmove = 1;
    this.stack = [];
    this.setFen(fen || START_FEN);
  }

  Position.prototype.setFen = function (fen) {
    var parts = String(fen).trim().split(/\s+/);
    var rows = parts[0].split('/');
    this.board.fill(null);
    for (var r = 0; r < 8; r++) {
      var f = 0;
      var row = rows[r] || '8';
      for (var i = 0; i < row.length; i++) {
        var ch = row[i];
        if (ch >= '1' && ch <= '8') { f += parseInt(ch, 10); }
        else { this.board[r * 8 + f] = ch; f++; }
      }
    }
    this.turn = parts[1] === 'b' ? B : W;
    this.castling = (parts[2] && parts[2] !== '-') ? parts[2] : '';
    this.ep = -1;
    if (parts[3] && parts[3] !== '-') {
      var pf = parts[3].charCodeAt(0) - 97;
      var pr = 8 - parseInt(parts[3][1], 10);
      if (onBoard(pf, pr)) this.ep = square(pf, pr);
    }
    this.halfmove = parts[4] ? parseInt(parts[4], 10) : 0;
    this.fullmove = parts[5] ? parseInt(parts[5], 10) : 1;
    this.stack = [];
    return this;
  };

  Position.prototype.fen = function () {
    var out = '';
    for (var r = 0; r < 8; r++) {
      var empty = 0;
      for (var f = 0; f < 8; f++) {
        var p = this.board[r * 8 + f];
        if (!p) { empty++; }
        else {
          if (empty) { out += empty; empty = 0; }
          out += p;
        }
      }
      if (empty) out += empty;
      if (r < 7) out += '/';
    }
    out += ' ' + this.turn + ' ' + (this.castling || '-') + ' ';
    out += this.ep >= 0 ? FILES[fileOf(this.ep)] + (8 - rankOf(this.ep)) : '-';
    out += ' ' + this.halfmove + ' ' + this.fullmove;
    return out;
  };

  Position.prototype.clone = function () {
    var p = new Position();
    p.board = this.board.slice();
    p.turn = this.turn;
    p.castling = this.castling;
    p.ep = this.ep;
    p.halfmove = this.halfmove;
    p.fullmove = this.fullmove;
    p.stack = [];
    return p;
  };

  /* ---------------- attack detection ---------------- */

  function isAttacked(pos, sq, byWhite) {
    var b = pos.board;
    var f = fileOf(sq), r = rankOf(sq);
    /* normalize the colour flag (callers pass 'w'/'b' strings or booleans) */
    var bw = (byWhite === B || byWhite === false) ? false : true;

    /* pawns */
    var pawn = bw ? 'P' : 'p';
    var pr = bw ? r + 1 : r - 1;
    if (pr >= 0 && pr < 8) {
      if (f > 0 && b[square(f - 1, pr)] === pawn) return true;
      if (f < 7 && b[square(f + 1, pr)] === pawn) return true;
    }

    /* knights */
    var knight = bw ? 'N' : 'n';
    for (var i = 0; i < 8; i++) {
      var nf = f + KNIGHT_DELTAS[i][0], nr = r + KNIGHT_DELTAS[i][1];
      if (onBoard(nf, nr) && b[square(nf, nr)] === knight) return true;
    }

    /* king */
    var king = bw ? 'K' : 'k';
    for (var j = 0; j < 8; j++) {
      var kf = f + KING_DIRS[j][0], kr = r + KING_DIRS[j][1];
      if (onBoard(kf, kr) && b[square(kf, kr)] === king) return true;
    }

    /* sliders */
    var i2, k2, nfc, nrc, p;
    for (i2 = 0; i2 < 4; i2++) {
      nfc = f + BISHOP_DIRS[i2][0]; nrc = r + BISHOP_DIRS[i2][1];
      while (onBoard(nfc, nrc)) {
        p = b[square(nfc, nrc)];
        if (p) {
          if (isWhitePiece(p) === bw && (typeOf(p) === 'b' || typeOf(p) === 'q')) return true;
          break;
        }
        nfc += BISHOP_DIRS[i2][0]; nrc += BISHOP_DIRS[i2][1];
      }
    }
    for (k2 = 0; k2 < 4; k2++) {
      nfc = f + ROOK_DIRS[k2][0]; nrc = r + ROOK_DIRS[k2][1];
      while (onBoard(nfc, nrc)) {
        p = b[square(nfc, nrc)];
        if (p) {
          if (isWhitePiece(p) === bw && (typeOf(p) === 'r' || typeOf(p) === 'q')) return true;
          break;
        }
        nfc += ROOK_DIRS[k2][0]; nrc += ROOK_DIRS[k2][1];
      }
    }
    return false;
  }

  function kingSquare(pos, color) {
    var k = color === W ? 'K' : 'k';
    for (var s = 0; s < 64; s++) if (pos.board[s] === k) return s;
    return -1;
  }

  /* ---------------- move generation ---------------- */

  function genPseudo(pos) {
    var moves = [];
    var b = pos.board;
    var white = pos.turn === W;

    for (var s = 0; s < 64; s++) {
      var p = b[s];
      if (!p) continue;
      var pw = isWhitePiece(p);
      if (pw !== white) continue;
      var t = typeOf(p);
      var f = fileOf(s), r = rankOf(s);

      if (t === 'p') {
        var dir = pw ? -1 : 1;
        var startRank = pw ? 6 : 1;
        var promoRank = pw ? 0 : 7;
        var nr = r + dir;
        if (nr >= 0 && nr < 8) {
          var ts = square(f, nr);
          if (!b[ts]) {
            if (nr === promoRank) {
              moves.push({ from: s, to: ts, piece: p, promo: 'q' });
              moves.push({ from: s, to: ts, piece: p, promo: 'r' });
              moves.push({ from: s, to: ts, piece: p, promo: 'b' });
              moves.push({ from: s, to: ts, piece: p, promo: 'n' });
            } else {
              moves.push({ from: s, to: ts, piece: p });
              var nr2 = r + 2 * dir;
              if (r === startRank && nr2 >= 0 && nr2 < 8) {
                var t2 = square(f, nr2);
                if (!b[t2]) moves.push({ from: s, to: t2, piece: p, dbl: true });
              }
            }
          }
        }
        for (var d = -1; d <= 1; d += 2) {
          var cf = f + d, cr = r + dir;
          if (!onBoard(cf, cr)) continue;
          var cs = square(cf, cr);
          var cp = b[cs];
          if (cp) {
            if (isWhitePiece(cp) === pw) continue;
            if (cr === promoRank) {
              moves.push({ from: s, to: cs, piece: p, promo: 'q', captured: cp });
              moves.push({ from: s, to: cs, piece: p, promo: 'r', captured: cp });
              moves.push({ from: s, to: cs, piece: p, promo: 'b', captured: cp });
              moves.push({ from: s, to: cs, piece: p, promo: 'n', captured: cp });
            } else {
              moves.push({ from: s, to: cs, piece: p, captured: cp });
            }
          } else if (cs === pos.ep) {
            var capSq = cs + (pw ? 8 : -8);
            var capP = b[capSq];
            if (capP && typeOf(capP) === 'p' && isWhitePiece(capP) !== pw) {
              moves.push({ from: s, to: cs, piece: p, ep: true, captured: capP });
            }
          }
        }
      } else if (t === 'n' || t === 'k') {
        var dirs = t === 'n' ? KNIGHT_DELTAS : KING_DIRS;
        for (var i = 0; i < dirs.length; i++) {
          var nf = f + dirs[i][0], nrr = r + dirs[i][1];
          if (!onBoard(nf, nrr)) continue;
          var ns = square(nf, nrr), np = b[ns];
          if (np && isWhitePiece(np) === pw) continue;
          moves.push({ from: s, to: ns, piece: p, captured: np || null });
        }
      } else {
        var sdirs = t === 'b' ? BISHOP_DIRS : (t === 'r' ? ROOK_DIRS : QUEEN_DIRS);
        for (var k = 0; k < sdirs.length; k++) {
          var df = sdirs[k][0], dr = sdirs[k][1];
          var x = f + df, y = r + dr;
          while (onBoard(x, y)) {
            var bs = square(x, y), bp = b[bs];
            if (!bp) {
              moves.push({ from: s, to: bs, piece: p });
            } else {
              if (isWhitePiece(bp) !== pw) moves.push({ from: s, to: bs, piece: p, captured: bp });
              break;
            }
            x += df; y += dr;
          }
        }
      }
    }

    /* castling */
    if (white) {
      if (pos.castling.indexOf('K') >= 0 && b[60] === 'K' && b[63] === 'R' && !b[61] && !b[62] &&
          !isAttacked(pos, 60, B) && !isAttacked(pos, 61, B) && !isAttacked(pos, 62, B)) {
        moves.push({ from: 60, to: 62, piece: 'K', castle: 'K' });
      }
      if (pos.castling.indexOf('Q') >= 0 && b[60] === 'K' && b[56] === 'R' && !b[57] && !b[58] && !b[59] &&
          !isAttacked(pos, 60, B) && !isAttacked(pos, 59, B) && !isAttacked(pos, 58, B)) {
        moves.push({ from: 60, to: 58, piece: 'K', castle: 'Q' });
      }
    } else {
      if (pos.castling.indexOf('k') >= 0 && b[4] === 'k' && b[7] === 'r' && !b[5] && !b[6] &&
          !isAttacked(pos, 4, W) && !isAttacked(pos, 5, W) && !isAttacked(pos, 6, W)) {
        moves.push({ from: 4, to: 6, piece: 'k', castle: 'k' });
      }
      if (pos.castling.indexOf('q') >= 0 && b[4] === 'k' && b[0] === 'r' && !b[1] && !b[2] && !b[3] &&
          !isAttacked(pos, 4, W) && !isAttacked(pos, 3, W) && !isAttacked(pos, 2, W)) {
        moves.push({ from: 4, to: 2, piece: 'k', castle: 'q' });
      }
    }
    return moves;
  }

  /* ---------------- make / unmake ---------------- */

  function updateCastlingRights(pos, m, capturedSq) {
    if (m.piece === 'K') pos.castling = pos.castling.replace(/[KQ]/g, '');
    if (m.piece === 'k') pos.castling = pos.castling.replace(/[kq]/g, '');
    if (m.from === 63 || capturedSq === 63) pos.castling = pos.castling.replace('K', '');
    if (m.from === 56 || capturedSq === 56) pos.castling = pos.castling.replace('Q', '');
    if (m.from === 7 || capturedSq === 7) pos.castling = pos.castling.replace('k', '');
    if (m.from === 0 || capturedSq === 0) pos.castling = pos.castling.replace('q', '');
  }

  function makeMove(pos, m) {
    var b = pos.board;
    var piece = b[m.from];
    var pw = isWhitePiece(piece);
    var rec = {
      m: m, piece: piece, captured: null, capturedSq: -1,
      rookFrom: -1, rookTo: -1,
      castling: pos.castling, ep: pos.ep, halfmove: pos.halfmove, fullmove: pos.fullmove
    };

    if (m.ep) {
      var capSq = m.to + (pw ? 8 : -8);
      rec.captured = b[capSq]; rec.capturedSq = capSq; b[capSq] = null;
    } else if (b[m.to]) {
      rec.captured = b[m.to]; rec.capturedSq = m.to;
    }

    b[m.from] = null;
    b[m.to] = m.promo ? (pw ? m.promo.toUpperCase() : m.promo) : piece;

    if (m.castle) {
      var map = { K: [63, 61], Q: [56, 59], k: [7, 5], q: [0, 3] };
      var rf = map[m.castle][0], rt = map[m.castle][1];
      rec.rookFrom = rf; rec.rookTo = rt;
      b[rt] = b[rf]; b[rf] = null;
    }

    updateCastlingRights(pos, m, rec.capturedSq);
    pos.ep = m.dbl ? (pw ? m.to + 8 : m.to - 8) : -1;
    pos.halfmove = (typeOf(piece) === 'p' || rec.captured) ? 0 : pos.halfmove + 1;
    if (pos.turn === B) pos.fullmove++;
    pos.turn = other(pos.turn);
    pos.stack.push(rec);
    return rec;
  }

  function unmakeMove(pos) {
    var rec = pos.stack.pop();
    if (!rec) return;
    var b = pos.board;
    var m = rec.m;
    b[m.from] = rec.piece;
    b[m.to] = null;
    if (rec.rookFrom >= 0) { b[rec.rookFrom] = b[rec.rookTo]; b[rec.rookTo] = null; }
    if (rec.capturedSq >= 0) b[rec.capturedSq] = rec.captured;
    pos.castling = rec.castling;
    pos.ep = rec.ep;
    pos.halfmove = rec.halfmove;
    pos.fullmove = rec.fullmove;
    pos.turn = other(pos.turn);
  }

  /* make a move; returns false (and undoes it) if it leaves our king in check */
  function makeLegal(pos, m) {
    makeMove(pos, m);
    var mover = other(pos.turn);
    var ksq = kingSquare(pos, mover);
    if (ksq < 0 || isAttacked(pos, ksq, pos.turn)) { unmakeMove(pos); return false; }
    return true;
  }

  function legalMoves(pos) {
    var pseudo = genPseudo(pos);
    var out = [];
    for (var i = 0; i < pseudo.length; i++) {
      if (makeLegal(pos, pseudo[i])) {
        out.push(pseudo[i]);
        unmakeMove(pos);
      }
      /* makeLegal already undoes illegal moves — do not unmake twice */
    }
    return out;
  }

  /* ---------------- notation ---------------- */

  function toSAN(pos, m) {
    var piece = m.piece;
    var t = typeOf(piece);
    var san;

    if (m.castle) {
      san = (m.castle === 'K' || m.castle === 'k') ? 'O-O' : 'O-O-O';
    } else {
      var moves = legalMoves(pos);
      if (t === 'p') {
        san = m.captured ? FILES[fileOf(m.from)] + 'x' : '';
        san += squareName(m.to);
      } else {
        var rivals = [];
        for (var i = 0; i < moves.length; i++) {
          if (typeOf(moves[i].piece) === t && moves[i].to === m.to) rivals.push(moves[i]);
        }
        var dis = '';
        if (rivals.length > 1) {
          var sameFile = 0, sameRank = 0, i2;
          for (i2 = 0; i2 < rivals.length; i2++) {
            if (fileOf(rivals[i2].from) === fileOf(m.from)) sameFile++;
            if (rankOf(rivals[i2].from) === rankOf(m.from)) sameRank++;
          }
          if (sameFile === 1) dis = FILES[fileOf(m.from)];
          else if (sameRank === 1) dis = String(8 - rankOf(m.from));
          else dis = FILES[fileOf(m.from)] + String(8 - rankOf(m.from));
        }
        san = t.toUpperCase() + dis + (m.captured ? 'x' : '') + squareName(m.to);
      }
      if (m.promo) san += '=' + m.promo.toUpperCase();
    }

    makeMove(pos, m);
    var replies = legalMoves(pos);
    var checked = isAttacked(pos, kingSquare(pos, pos.turn), other(pos.turn));
    unmakeMove(pos);
    if (checked) san += replies.length === 0 ? '#' : '+';
    return san;
  }

  /* ---------------- terminal states ---------------- */

  function insufficientMaterial(pos) {
    var minors = [];
    for (var s = 0; s < 64; s++) {
      var p = pos.board[s];
      if (!p) continue;
      var t = typeOf(p);
      if (t === 'k') continue;
      minors.push({ t: t, sq: s });
    }
    if (minors.length === 0) return true;
    if (minors.length === 1 && (minors[0].t === 'b' || minors[0].t === 'n')) return true;
    if (minors.length === 2 && minors[0].t === 'b' && minors[1].t === 'b') {
      var c0 = (fileOf(minors[0].sq) + rankOf(minors[0].sq)) % 2;
      var c1 = (fileOf(minors[1].sq) + rankOf(minors[1].sq)) % 2;
      if (c0 === c1) return true;
    }
    return false;
  }

  function status(pos) {
    var moves = legalMoves(pos);
    var ksq = kingSquare(pos, pos.turn);
    var inCheck = ksq >= 0 && isAttacked(pos, ksq, other(pos.turn));
    if (moves.length === 0) {
      if (inCheck) {
        return { over: true, inCheck: true, result: other(pos.turn) === W ? '1-0' : '0-1', reason: 'Checkmate' };
      }
      return { over: true, inCheck: false, result: '1/2-1/2', reason: 'Stalemate' };
    }
    if (insufficientMaterial(pos)) {
      return { over: true, inCheck: inCheck, result: '1/2-1/2', reason: 'Insufficient material' };
    }
    if (pos.halfmove >= 100) {
      return { over: true, inCheck: inCheck, result: '1/2-1/2', reason: 'Fifty-move rule' };
    }
    return { over: false, inCheck: inCheck };
  }

  function positionKey(pos) {
    var s = '';
    for (var i = 0; i < 64; i++) s += pos.board[i] || '.';
    return s + pos.turn + pos.castling + (pos.ep >= 0 ? String(pos.ep) : '-');
  }

  /* ---------------- exports ---------------- */

  global.Chess = {
    W: W, B: B,
    START_FEN: START_FEN,
    FILES: FILES,
    VALUE: VALUE,
    PHASE: PHASE,
    KNIGHT_DELTAS: KNIGHT_DELTAS,
    BISHOP_DIRS: BISHOP_DIRS,
    ROOK_DIRS: ROOK_DIRS,
    QUEEN_DIRS: QUEEN_DIRS,
    Position: Position,
    square: square,
    fileOf: fileOf,
    rankOf: rankOf,
    onBoard: onBoard,
    other: other,
    typeOf: typeOf,
    isWhitePiece: isWhitePiece,
    squareName: squareName,
    isAttacked: isAttacked,
    kingSquare: kingSquare,
    genPseudo: genPseudo,
    legalMoves: legalMoves,
    makeMove: makeMove,
    unmakeMove: unmakeMove,
    makeLegal: makeLegal,
    toSAN: toSAN,
    status: status,
    insufficientMaterial: insufficientMaterial,
    positionKey: positionKey
  };
})(typeof window !== 'undefined' ? window : globalThis);
