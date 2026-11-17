/* ============================================================
   KRYPTØN — app.js
   UI layer: board rendering, input handling, game flow.
   ============================================================ */
(function () {
  'use strict';

  var Chess = window.Chess;
  var AI = window.ChessAI;

  /* ---------- dom ---------- */
  function $(id) { return document.getElementById(id); }
  var boardEl = $('board');
  var squaresEl = $('squares');
  var piecesEl = $('pieces');
  var promoLayer = $('promoLayer');
  var modalLayer = $('modalLayer');
  var levelsEl = $('levels');
  var movelistEl = $('movelist');
  var capturesEl = $('captures');
  var statusText = $('statusText');
  var statusBar = document.querySelector('.statusbar');
  var statusDot = $('turnDot');
  var engineInfo = $('engineInfo');
  var evalFill = $('evalFill');
  var evalNum = $('evalNum');
  var matchPill = $('matchPill');
  var eloChip = $('eloChip');
  var levelBlurb = $('levelBlurb');
  var reviewBar = $('reviewBar');
  var reviewNum = $('reviewNum');
  var moveCount = $('moveCount');
  var colorPick = $('colorPick');

  /* ---------- state ---------- */
  var state = {
    positions: [],
    moves: [],
    ply: 0,
    level: 'club',
    colorChoice: 'w',
    playerColor: 'w',
    aiColor: 'b',
    flipped: false,
    selected: null,
    targets: [],
    hint: null,
    lastMove: null,
    thinking: false,
    over: false,
    result: '1/2-1/2',
    generation: 0,
    pendingPromotion: null,
    drag: null
  };

  var pieceMap = new Map();   /* square -> {el, piece} */

  /* ---------- helpers ---------- */
  function other(c) { return c === 'w' ? 'b' : 'w'; }
  function isPlayerTurn() { return !state.over && !state.thinking && currentPos().turn === state.playerColor; }
  function currentPos() { return state.positions[state.ply]; }
  function live() { return state.ply === state.positions.length - 1; }
  function levelCfg() { return AI.getLevel(state.level); }

  function sqToDisplay(sq) {
    var f = Chess.fileOf(sq), r = Chess.rankOf(sq);
    return state.flipped ? { row: 7 - r, col: 7 - f } : { row: r, col: f };
  }
  function displayToSq(row, col) {
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    return state.flipped ? Chess.square(7 - col, 7 - row) : Chess.square(col, row);
  }
  function squareFromEvent(e) {
    var rect = boardEl.getBoundingClientRect();
    if (!rect.width) return null;
    var size = rect.width / 8;
    var col = Math.floor((e.clientX - rect.left) / size);
    var row = Math.floor((e.clientY - rect.top) / size);
    return displayToSq(row, col);
  }

  function repKey(pos) {
    var s = '';
    for (var i = 0; i < 64; i++) s += pos.board[i] || '.';
    return s + pos.turn + pos.castling;
  }
  function repetitionCount(pos) {
    var key = repKey(pos), n = 0;
    for (var i = 0; i < state.positions.length; i++) {
      if (repKey(state.positions[i]) === key) n++;
    }
    return n;
  }

  /* ---------- sound ---------- */
  var Sound = {
    ctx: null,
    on: true,
    ensure: function () {
      if (!this.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { this.ctx = new AC(); } catch (e) { return null; }
      }
      if (this.ctx.state === 'suspended') { try { this.ctx.resume(); } catch (e) {} }
      return this.ctx;
    },
    tone: function (freq, dur, type, gain, delay) {
      if (!this.on) return;
      var ctx = this.ensure();
      if (!ctx) return;
      var t0 = ctx.currentTime + (delay || 0);
      var osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain || 0.07, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.03);
    },
    move: function () { this.tone(230, 0.05, 'triangle', 0.045); this.tone(150, 0.07, 'sine', 0.03, 0.015); },
    capture: function () { this.tone(125, 0.13, 'square', 0.05); this.tone(78, 0.16, 'sine', 0.05, 0.01); },
    check: function () { this.tone(680, 0.09, 'sine', 0.055); this.tone(900, 0.15, 'sine', 0.045, 0.08); },
    select: function () { this.tone(480, 0.035, 'sine', 0.025); },
    win: function () { [523, 659, 784, 1046].forEach(function (f, i) { Sound.tone(f, 0.26, 'triangle', 0.06, i * 0.1); }); },
    lose: function () { [440, 392, 330, 262].forEach(function (f, i) { Sound.tone(f, 0.28, 'sine', 0.055, i * 0.12); }); },
    draw: function () { [440, 523].forEach(function (f, i) { Sound.tone(f, 0.25, 'sine', 0.05, i * 0.14); }); }
  };

  /* ---------- board construction ---------- */
  function buildSquares() {
    squaresEl.innerHTML = '';
    /* create squares in display order so highlights line up when flipped */
    for (var row = 0; row < 8; row++) {
      for (var col = 0; col < 8; col++) {
        var sq = displayToSq(row, col);
        var d = document.createElement('div');
        d.className = 'square ' + (((sq >> 3) + (sq & 7)) % 2 === 0 ? 'light' : 'dark');
        d.dataset.sq = String(sq);
        var f = Chess.fileOf(sq), r = Chess.rankOf(sq);
        if (row === 7) {
          var cf = document.createElement('span');
          cf.className = 'coord file';
          cf.textContent = Chess.FILES[f];
          d.appendChild(cf);
        }
        if (col === 0) {
          var cr = document.createElement('span');
          cr.className = 'coord rank';
          cr.textContent = String(8 - r);
          d.appendChild(cr);
        }
        squaresEl.appendChild(d);
      }
    }
  }

  function squareEl(sq) {
    return squaresEl.querySelector('[data-sq="' + sq + '"]');
  }

  function sizeBoard() {
    var w = boardEl.clientWidth;
    if (w) boardEl.style.setProperty('--sq', (w / 8) + 'px');
  }

  /* ---------- piece rendering ---------- */
  var PIECE_NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

  function pieceSrc(piece) {
    return 'assets/pieces/' + (Chess.isWhitePiece(piece) ? 'w' : 'b') + piece.toUpperCase() + '.svg';
  }

  function createPieceEl(piece) {
    var el = document.createElement('img');
    el.className = 'piece ' + (Chess.isWhitePiece(piece) ? 'white' : 'black');
    el.src = pieceSrc(piece);
    el.alt = (Chess.isWhitePiece(piece) ? 'White ' : 'Black ') + PIECE_NAMES[piece.toLowerCase()];
    el.draggable = false;
    el.dataset.piece = piece;
    return el;
  }

  function placePiece(el, sq) {
    var d = sqToDisplay(sq);
    /* each piece is exactly one square wide, so 100% == one square */
    el.style.transform = 'translate(' + (d.col * 100) + '%, ' + (d.row * 100) + '%)';
  }

  function syncPieces(pos) {
    var sq, rec;
    /* drop anything that no longer matches the position */
    pieceMap.forEach(function (r, s) {
      if (pos.board[s] !== r.piece) {
        if (r.el.parentNode) r.el.parentNode.removeChild(r.el);
        pieceMap.delete(s);
      }
    });
    for (sq = 0; sq < 64; sq++) {
      if (!pos.board[sq] || pieceMap.has(sq)) continue;
      var el = createPieceEl(pos.board[sq]);
      placePiece(el, sq);
      piecesEl.appendChild(el);
      pieceMap.set(sq, { el: el, piece: pos.board[sq] });
    }
  }

  function animateMove(mv) {
    var from = pieceMap.get(mv.from);
    var capSq = mv.to;
    if (mv.ep) capSq = mv.to + (mv.piece === 'P' ? 8 : -8);
    var victim = pieceMap.get(capSq);
    if (victim && victim !== from) {
      pieceMap.delete(capSq);
      victim.el.classList.add('captured');
      (function (v) { setTimeout(function () { if (v.el.parentNode) v.el.parentNode.removeChild(v.el); }, 240); })(victim);
    }
    if (from) {
      if (mv.promo) {
        var white = Chess.isWhitePiece(from.piece);
        from.piece = mv.promo.toUpperCase();
        if (!white) from.piece = mv.promo;
        from.el.src = pieceSrc(from.piece);
        from.el.alt = (white ? 'White ' : 'Black ') + PIECE_NAMES[mv.promo];
        from.el.dataset.piece = from.piece;
      }
      pieceMap.delete(mv.from);
      pieceMap.set(mv.to, from);
      placePiece(from.el, mv.to);
    }
    if (mv.castle) {
      var map = { K: [63, 61], Q: [56, 59], k: [7, 5], q: [0, 3] };
      var rf = map[mv.castle][0], rt = map[mv.castle][1];
      var rook = pieceMap.get(rf);
      if (rook) {
        pieceMap.delete(rf);
        pieceMap.set(rt, rook);
        placePiece(rook.el, rt);
      }
    }
  }

  /* ---------- rendering ---------- */
  function render() {
    var pos = currentPos();
    renderSquares(pos);
    syncPieces(pos);
    renderMoveList();
    renderCaptures();
    renderStatus(pos);
    renderEval(pos);
    renderControls();
  }

  function renderSquares(pos) {
    var kids = squaresEl.children;
    for (var i = 0; i < kids.length; i++) {
      kids[i].className = 'square ' + (((Number(kids[i].dataset.sq) >> 3) + (Number(kids[i].dataset.sq) & 7)) % 2 === 0 ? 'light' : 'dark');
    }
    var i2;
    for (i2 = 0; i2 < kids.length; i2++) kids[i2].classList.remove('last', 'selected', 'hint', 'check', 'move-target', 'cap-target');

    function addCls(sq, cls) {
      var el = squareEl(sq);
      if (el) el.classList.add(cls);
    }
    if (state.lastMove && live()) {
      addCls(state.lastMove.from, 'last');
      addCls(state.lastMove.to, 'last');
    }
    if (state.selected != null) addCls(state.selected, 'selected');
    if (state.hint) {
      addCls(state.hint.from, 'hint');
      addCls(state.hint.to, 'hint');
    }
    for (i2 = 0; i2 < state.targets.length; i2++) {
      var m = state.targets[i2];
      addCls(m.to, m.captured ? 'cap-target' : 'move-target');
    }
    var ksq = Chess.kingSquare(pos, pos.turn);
    var st = Chess.status(pos);
    if (st.inCheck && ksq >= 0) addCls(ksq, 'check');
  }

  function renderMoveList() {
    if (!state.moves.length) {
      movelistEl.innerHTML = '<p class="empty">No moves yet — make the first one.</p>';
      moveCount.textContent = '0';
      return;
    }
    var html = '';
    var rows = [];
    for (var i = 0; i < state.moves.length; i += 2) {
      var w = state.moves[i];
      var b = state.moves[i + 1];
      rows.push('<div class="move-row"><span class="move-num">' + (i / 2 + 1) + '.</span>' +
        '<span class="move-san" data-ply="' + (i + 1) + '">' + w.san + '</span>' +
        (b ? '<span class="move-san" data-ply="' + (i + 2) + '">' + b.san + '</span>' : '<span></span>') +
        '</div>');
    }
    movelistEl.innerHTML = rows.join('');
    moveCount.textContent = String(state.moves.length);
    var els = movelistEl.querySelectorAll('.move-san');
    for (var j = 0; j < els.length; j++) {
      var ply = Number(els[j].dataset.ply);
      if (ply === state.ply) els[j].classList.add('current');
      else if (ply > state.ply) els[j].classList.add('dim');
      els[j].addEventListener('click', (function (p) {
        return function () { gotoPly(p); };
      })(ply));
    }
    movelistEl.scrollTop = movelistEl.scrollHeight;
  }

  function renderCaptures() {
    /* pieces each side has taken off the board */
    var taken = { w: [], b: [] };
    for (var i = 0; i < state.moves.length; i++) {
      var mv = state.moves[i].mv;
      if (!mv.captured) continue;
      taken[Chess.isWhitePiece(mv.piece) ? 'w' : 'b'].push(mv.captured);
    }
    var order = { q: 9, r: 5, b: 3, n: 3, p: 1 };
    var byValue = function (a, b) { return order[b.toLowerCase()] - order[a.toLowerCase()]; };
    taken.w.sort(byValue);
    taken.b.sort(byValue);

    var vals = { p: 1, n: 3, b: 3, r: 5, q: 9 };
    var points = { w: 0, b: 0 };
    taken.w.forEach(function (p) { points.w += vals[p.toLowerCase()]; });
    taken.b.forEach(function (p) { points.b += vals[p.toLowerCase()]; });
    var diff = points.w - points.b;   /* positive = White is ahead */

    function row(label, arr, ahead) {
      var html = '<div class="capture-row"><span class="capture-label">' + label + '</span><span class="capture-pieces">';
      for (var i = 0; i < arr.length; i++) {
        var p = arr[i];
        html += '<img src="assets/pieces/' + (Chess.isWhitePiece(p) ? 'w' : 'b') + p.toUpperCase() + '.svg" alt="' + p + '">';
      }
      if (!arr.length) html += '<span class="capture-empty">—</span>';
      html += '</span>';
      if (ahead) html += '<span class="advantage">+' + ahead + '</span>';
      return html + '</div>';
    }

    capturesEl.innerHTML =
      row('White', taken.w, diff > 0 ? diff : 0) +
      row('Black', taken.b, diff < 0 ? -diff : 0);
  }

  function renderStatus(pos) {
    var cfg = levelCfg();
    if (statusBar) statusBar.classList.toggle('thinking', !!state.thinking);
    if (state.over) {
      statusText.textContent = state.resultText;
      statusDot.className = 'turn-dot';
      return;
    }
    var st = Chess.status(pos);
    if (state.thinking) {
      statusText.textContent = cfg.name + ' is thinking';
      statusDot.className = 'turn-dot thinking';
      return;
    }
    if (!live()) {
      statusText.textContent = 'Reviewing history';
      statusDot.className = 'turn-dot';
      return;
    }
    if (pos.turn === state.playerColor) {
      statusText.textContent = st.inCheck ? 'Your move — you are in check!' : 'Your move (' + (state.playerColor === 'w' ? 'White' : 'Black') + ')';
    } else {
      statusText.textContent = cfg.name + ' to move';
    }
    statusDot.className = 'turn-dot ' + (pos.turn === 'w' ? 'white' : 'black');
  }

  function renderEval(pos) {
    var cp = AI.quickEval(pos);
    var p = 1 / (1 + Math.exp(-0.004 * cp));
    evalFill.style.height = (p * 100).toFixed(1) + '%';
    var pawns = cp / 100;
    evalNum.textContent = (pawns > 0 ? '+' : '') + pawns.toFixed(1);
  }

  function renderControls() {
    $('undoBtn').disabled = state.moves.length === 0 || state.thinking;
    $('hintBtn').disabled = state.over || state.thinking || !isPlayerTurn();
    $('resignBtn').disabled = state.over || state.moves.length === 0;
    $('newGameBtn').textContent = state.moves.length ? 'Restart' : 'New game';
  }

  /* ---------- selection & input ---------- */
  function clearSelection() {
    state.selected = null;
    state.targets = [];
  }

  function selectSquare(sq) {
    var pos = currentPos();
    var moves = Chess.legalMoves(pos).filter(function (m) { return m.from === sq; });
    if (!moves.length) { clearSelection(); return false; }
    state.selected = sq;
    state.targets = moves;
    Sound.select();
    return true;
  }

  function showPromotion(from, to) {
    var rect = boardEl.getBoundingClientRect();
    var size = rect.width / 8;
    var d = sqToDisplay(to);
    var white = Chess.isWhitePiece(currentPos().board[from]);
    state.pendingPromotion = { from: from, to: to };
    promoLayer.innerHTML = '';
    /* stack away from the promotion rank, respecting board flip */
    var dir = (white !== state.flipped) ? 1 : -1;
    ['q', 'r', 'b', 'n'].forEach(function (p, i) {
      var row = d.row + i * dir;
      var btn = document.createElement('button');
      btn.className = 'promo-btn ' + (white ? 'p-white' : 'p-black');
      var img = document.createElement('img');
      img.src = 'assets/pieces/' + (white ? 'w' : 'b') + p.toUpperCase() + '.svg';
      img.alt = p;
      btn.appendChild(img);
      btn.style.left = (d.col * size) + 'px';
      btn.style.top = (row * size) + 'px';
      btn.style.width = size + 'px';
      btn.style.height = size + 'px';
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        closePromotion();
        var mv = Chess.legalMoves(currentPos()).filter(function (m) {
          return m.from === from && m.to === to && m.promo === p;
        })[0];
        if (mv) applyMove(mv);
      });
      promoLayer.appendChild(btn);
    });
    promoLayer.hidden = false;
  }

  function closePromotion() {
    promoLayer.hidden = true;
    promoLayer.innerHTML = '';
    state.pendingPromotion = null;
  }

  boardEl.addEventListener('pointerdown', function (e) {
    if (state.over || state.thinking || !live()) return;
    if (!isPlayerTurn()) return;
    var sq = squareFromEvent(e);
    if (sq == null) return;
    var piece = currentPos().board[sq];
    var mine = piece && Chess.isWhitePiece(piece) === (state.playerColor === 'w');
    if (mine) {
      if (state.selected === sq) { clearSelection(); render(); return; }
      selectSquare(sq);
      render();
      var rec = pieceMap.get(sq);
      state.drag = { from: sq, el: rec ? rec.el : null, x0: e.clientX, y0: e.clientY, moved: false };
      if (state.drag.el) {
        try { boardEl.setPointerCapture(e.pointerId); } catch (err) {}
      }
      e.preventDefault();
    } else if (state.selected != null) {
      var target = state.targets.filter(function (m) { return m.to === sq; })[0];
      if (target) {
        clearSelection();
        if (target.promo) showPromotion(target.from, target.to); else applyMove(target);
      } else {
        clearSelection();
        render();
      }
    } else {
      clearSelection();
      render();
    }
  });

  boardEl.addEventListener('pointermove', function (e) {
    var d = state.drag;
    if (!d || !d.el) return;
    var dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
    if (!d.moved) { d.moved = true; d.el.classList.add('dragging'); }
    var rect = boardEl.getBoundingClientRect();
    var size = rect.width / 8;
    var dcol = sqToDisplay(d.from).col, drow = sqToDisplay(d.from).row;
    var x = (dcol * size) + dx, y = (drow * size) + dy;
    d.el.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
  });

  function endDrag(e) {
    var d = state.drag;
    state.drag = null;
    if (!d) return;
    if (d.el) d.el.classList.remove('dragging');
    if (!d.moved) return;
    var sq = squareFromEvent(e);
    var target = sq == null ? null : state.targets.filter(function (m) { return m.to === sq; })[0];
    if (target) {
      clearSelection();
      if (target.promo) showPromotion(target.from, target.to); else applyMove(target);
    } else {
      if (d.el) placePiece(d.el, d.from);
      render();
    }
  }

  boardEl.addEventListener('pointerup', endDrag);
  boardEl.addEventListener('pointercancel', endDrag);
  promoLayer.addEventListener('pointerdown', function (e) { if (e.target === promoLayer) { closePromotion(); render(); } });

  /* ---------- move application ---------- */
  function applyMove(mv) {
    var pos = currentPos().clone();
    var san = Chess.toSAN(pos, mv);
    Chess.makeMove(pos, mv);
    state.positions.push(pos);
    state.moves.push({ san: san, mv: mv });
    state.ply = state.positions.length - 1;
    state.lastMove = { from: mv.from, to: mv.to };
    state.hint = null;
    /* clear stale read-outs when *we* move, but keep the bot's search summary
       (depth / nodes) visible right after it replies */
    if (Chess.isWhitePiece(mv.piece) === (state.playerColor === 'w')) engineInfo.textContent = '';
    clearSelection();
    animateMove(mv);

    var st = Chess.status(pos);
    if (st.inCheck) Sound.check();
    else if (mv.captured) Sound.capture();
    else Sound.move();

    render();

    if (st.over) { finishGame(st); return; }
    if (repetitionCount(pos) >= 3) {
      finishGame({ over: true, result: '1/2-1/2', reason: 'Threefold repetition' });
      return;
    }
    if (pos.turn === state.aiColor) scheduleAI();
  }

  function scheduleAI() {
    var gen = state.generation;
    state.thinking = true;
    render();
    setTimeout(function () {
      if (gen !== state.generation) return;
      var pos = currentPos();
      AI.findBestMove(pos, state.level, {
        onProgress: function (info) {
          if (gen !== state.generation) return;
          engineInfo.textContent = 'depth ' + info.depth + ' · ' + formatNodes(info.nodes) + ' nodes';
        }
      }).then(function (res) {
        if (gen !== state.generation) return;
        state.thinking = false;
        if (!res) { render(); return; }
        engineInfo.textContent = 'depth ' + res.depth + ' · ' + formatNodes(res.nodes) + ' nodes · ' + res.level.name;
        applyMove(res.move);
      });
    }, 40);
  }

  function formatNodes(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return Math.round(n / 1000) + 'k';
    return String(n);
  }

  /* ---------- game over ---------- */
  function finishGame(st) {
    state.over = true;
    state.thinking = false;
    state.result = st.result;
    var playerWon = (st.result === '1-0' && state.playerColor === 'w') || (st.result === '0-1' && state.playerColor === 'b');
    var draw = st.result === '1/2-1/2';

    if (draw) {
      state.resultText = 'Draw — ' + st.reason.toLowerCase();
      Sound.draw();
    } else if (playerWon) {
      state.resultText = 'You win! ' + st.reason.toLowerCase();
      Sound.win();
      confetti();
    } else {
      state.resultText = levelCfg().name + ' wins — ' + st.reason.toLowerCase();
      Sound.lose();
    }
    render();

    var title = draw ? 'Draw' : (playerWon ? 'Victory!' : 'Defeat');
    var sub = draw
      ? st.reason + ' — the game ends in a draw.'
      : (playerWon ? 'You beat ' + levelCfg().name + ' — ' + levelCfg().title + '.' : levelCfg().name + ' takes this one.');

    var outcomeClass = draw ? 'is-draw' : (playerWon ? 'is-win' : 'is-loss');
    modalLayer.hidden = false;
    modalLayer.innerHTML =
      '<div class="modal-card ' + outcomeClass + '">' +
      '<span class="result-badge">' + st.result + '</span>' +
      '<h3>' + title + '</h3>' +
      '<p>' + sub + '</p>' +
      '<div class="modal-actions">' +
      '<button class="btn btn-primary" id="rematchBtn">Rematch</button>' +
      '<button class="btn" id="reviewBtn">Review</button>' +
      '</div></div>';

    $('rematchBtn').addEventListener('click', function () { closeModal(); newGame(); });
    $('reviewBtn').addEventListener('click', function () { closeModal(); });
  }

  function closeModal() { modalLayer.hidden = true; modalLayer.innerHTML = ''; }

  function confetti() {
    // Obsidian Edition — read straight from the design tokens
    var css = getComputedStyle(document.documentElement);
    function tok(name, fallback) {
      var v = css.getPropertyValue(name).trim();
      return v || fallback;
    }
    var colors = [
      tok('--gold', '#D8B878'), tok('--gold-50', '#EFD9A9'),
      tok('--violet', '#A78BFA'), tok('--crimson', '#D72638'),
      tok('--cloud', '#F4F1EA'), tok('--steel', '#9299A9')
    ];
    for (var i = 0; i < 46; i++) {
      var el = document.createElement('div');
      el.className = 'confetti';
      el.style.left = (Math.random() * 100) + 'vw';
      el.style.background = colors[i % colors.length];
      el.style.animationDuration = (1.9 + Math.random() * 1.5) + 's';
      el.style.animationDelay = (Math.random() * 0.5) + 's';
      document.body.appendChild(el);
      (function (node) { setTimeout(function () { node.remove(); }, 3800); })(el);
    }
  }

  /* ---------- history review ---------- */
  function gotoPly(ply) {
    if (ply < 0 || ply >= state.positions.length) return;
    state.ply = ply;
    state.selected = null;
    state.targets = [];
    render();
    updateReviewBar();
  }

  function updateReviewBar() {
    if (live()) {
      reviewBar.hidden = true;
    } else {
      reviewBar.hidden = false;
      reviewNum.textContent = 'ply ' + state.ply;
    }
  }

  /* ---------- new game / controls ---------- */
  function urlParams() {
    try { return new URLSearchParams(window.location.search); } catch (e) { return null; }
  }
  function startFen() {
    var p = urlParams();
    var fen = p && p.get('fen');
    return fen ? fen : Chess.START_FEN;
  }

  function newGame() {
    state.generation++;
    state.positions = [new Chess.Position(startFen())];
    state.moves = [];
    state.ply = 0;
    state.over = false;
    state.thinking = false;
    state.result = '1/2-1/2';
    state.resultText = '';
    state.lastMove = null;
    state.hint = null;
    state.drag = null;
    clearSelection();
    closePromotion();
    closeModal();

    if (state.colorChoice === 'r') {
      state.playerColor = Math.random() < 0.5 ? 'w' : 'b';
    } else {
      state.playerColor = state.colorChoice;
    }
    state.aiColor = other(state.playerColor);
    /* orient the board to the player */
    state.flipped = (state.playerColor === 'b');
    buildSquares();

    pieceMap.forEach(function (r) { if (r.el.parentNode) r.el.parentNode.removeChild(r.el); });
    pieceMap.clear();
    piecesEl.innerHTML = '';

    render();
    updateReviewBar();
    engineInfo.textContent = '';

    if (currentPos().turn === state.aiColor) scheduleAI();
  }

  function undoMove() {
    if (!state.moves.length || state.thinking) return;
    state.generation++;
    /* Take back a full round: if it's our turn, remove the bot reply + our
       last move (2 plies); if the bot is to move (we just played), remove 1. */
    var toMove = state.positions[state.positions.length - 1].turn;
    var remove = (toMove === state.playerColor) ? 2 : 1;
    remove = Math.min(remove, state.moves.length);
    for (var i = 0; i < remove; i++) {
      state.positions.pop();
      state.moves.pop();
    }
    state.ply = state.positions.length - 1;
    state.over = false;
    state.thinking = false;
    state.result = '1/2-1/2';
    state.resultText = '';
    state.hint = null;
    state.lastMove = state.moves.length ? { from: state.moves[state.moves.length - 1].mv.from, to: state.moves[state.moves.length - 1].mv.to } : null;
    clearSelection();
    closeModal();

    /* rebuild the board from the restored position */
    pieceMap.forEach(function (r) { if (r.el.parentNode) r.el.parentNode.removeChild(r.el); });
    pieceMap.clear();
    piecesEl.innerHTML = '';

    render();
    updateReviewBar();
    if (!state.over && currentPos().turn === state.aiColor) scheduleAI();
  }

  function showHint() {
    if (state.over || state.thinking || !isPlayerTurn()) return;
    var pos = currentPos();
    var gen = state.generation, atPly = state.ply;
    engineInfo.textContent = 'analysing…';
    AI.findBestMove(pos, 'expert', { noBlunder: true, exact: true }).then(function (res) {
      /* the board may have moved on while we were thinking */
      if (!res || gen !== state.generation || state.ply !== atPly) return;
      state.hint = { from: res.move.from, to: res.move.to };
      engineInfo.textContent = 'hint: ' + Chess.toSAN(pos, res.move);
      render();
      setTimeout(function () {
        if (gen !== state.generation) return;
        state.hint = null;
        if (engineInfo.textContent.indexOf('hint:') === 0) engineInfo.textContent = '';
        render();
      }, 2600);
    });
  }

  function flipBoard() {
    state.flipped = !state.flipped;
    buildSquares();
    pieceMap.forEach(function (r, sq) { placePiece(r.el, sq); });
    render();
  }

  function buildPgn() {
    var cfg = levelCfg();
    var d = new Date();
    var date = d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
    var lines = [];
    lines.push('[Event "KRYPTØN"]');
    lines.push('[Site "Keshav Jha"]');
    lines.push('[Annotator "Keshav Jha"]');
    lines.push('[Date "' + date + '"]');
    lines.push('[White "' + (state.playerColor === 'w' ? 'Player' : cfg.name) + '"]');
    lines.push('[Black "' + (state.playerColor === 'w' ? cfg.name : 'Player') + '"]');
    lines.push('[Result "' + state.result + '"]');
    lines.push('');
    var body = '';
    for (var i = 0; i < state.moves.length; i++) {
      if (i % 2 === 0) body += (i / 2 + 1) + '. ';
      body += state.moves[i].san + ' ';
      if (i % 2 === 1) { lines.push(body.trim()); body = ''; }
    }
    if (body.trim()) lines.push(body.trim());
    lines.push(state.result);
    return lines.join('\n');
  }

  function copyPgn() {
    var pgn = buildPgn();
    var done = function () { toast('PGN copied to clipboard'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(pgn).then(done, function () { fallbackCopy(pgn, done); });
    } else {
      fallbackCopy(pgn, done);
    }
  }

  function fallbackCopy(text, cb) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); cb(); } catch (e) { toast('Could not copy PGN'); }
    document.body.removeChild(ta);
  }

  var toastTimer = null;
  function toast(msg) {
    var old = document.querySelector('.toast');
    if (old) old.remove();
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.remove(); }, 2200);
  }

  /* ---------- level picker ---------- */
  function buildLevels() {
    levelsEl.innerHTML = '';
    AI.LEVELS.forEach(function (lvl, i) {
      var btn = document.createElement('button');
      btn.className = 'level' + (lvl.id === state.level ? ' active' : '');
      btn.type = 'button';
      var num = (i + 1 < 10 ? '0' : '') + (i + 1);
      btn.innerHTML =
        '<span class="level-badge">' + num + '</span>' +
        '<span class="level-meta"><span class="level-name">' + lvl.name + '</span>' +
        '<span class="level-tag">' + (lvl.title || lvl.tagline) + '</span></span>' +
        '<span class="level-elo">' + lvl.elo + '</span>';
      btn.addEventListener('click', function () { selectLevel(lvl.id); });
      levelsEl.appendChild(btn);
    });
    updateLevelInfo();
  }

  function selectLevel(id) {
    /* always store the canonical id, even when a bot name is passed in */
    id = AI.getLevel(id).id;
    state.level = id;
    var kids = levelsEl.children;
    for (var i = 0; i < kids.length; i++) {
      kids[i].classList.toggle('active', AI.LEVELS[i].id === id);
    }
    updateLevelInfo();
    if (!state.over && state.moves.length) {
      toast(levelCfg().name + ' takes over from the next move');
    }
  }

  function updateLevelInfo() {
    var cfg = levelCfg();
    eloChip.textContent = '~' + cfg.elo;
    matchPill.textContent = cfg.name + ' · ' + cfg.elo + ' Elo';
    levelBlurb.textContent = cfg.blurb;
  }

  /* ---------- colour picker ---------- */
  colorPick.addEventListener('click', function (e) {
    var btn = e.target.closest('.seg');
    if (!btn) return;
    state.colorChoice = btn.dataset.color;
    var kids = colorPick.querySelectorAll('.seg');
    for (var i = 0; i < kids.length; i++) kids[i].classList.toggle('active', kids[i].dataset.color === state.colorChoice);
    if (state.colorChoice !== 'r') {
      newGame();
    } else {
      newGame();
    }
  });

  /* ---------- buttons ---------- */
  $('newGameBtn').addEventListener('click', function () { newGame(); });
  $('undoBtn').addEventListener('click', function () { undoMove(); });
  $('hintBtn').addEventListener('click', function () { showHint(); });
  $('flipBtn').addEventListener('click', function () { flipBoard(); });
  $('resignBtn').addEventListener('click', function () {
    if (state.over) return;
    state.generation++;
    var winner = other(state.playerColor);
    finishGame({ over: true, result: winner === 'w' ? '1-0' : '0-1', reason: 'Resignation' });
  });
  $('pgnBtn').addEventListener('click', function () { copyPgn(); });
  $('liveBtn').addEventListener('click', function () { gotoPly(state.positions.length - 1); });

  var SOUND_ICON_ON = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4 9v6h3.5L13 19V5L7.5 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
  var SOUND_ICON_OFF = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4 9v6h3.5L13 19V5L7.5 9H4z"/><path d="M16.5 9.5l4 5"/><path d="M20.5 9.5l-4 5"/></svg>';

  $('soundBtn').addEventListener('click', function () {
    Sound.on = !Sound.on;
    this.innerHTML = Sound.on ? SOUND_ICON_ON : SOUND_ICON_OFF;
    this.setAttribute('aria-label', Sound.on ? 'Mute sound' : 'Unmute sound');
    if (Sound.on) Sound.select();
  });

  /* ---------- keyboard ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    var k = e.key.toLowerCase();
    if (k === 'escape') { clearSelection(); closePromotion(); render(); }
    else if (k === 'u') { undoMove(); }
    else if (k === 'n') { newGame(); }
    else if (k === 'h') { showHint(); }
    else if (k === 'f') { flipBoard(); }
    else if (k >= '1' && k <= '5') { selectLevel(AI.LEVELS[Number(k) - 1].id); }
  });

  /* ---------- boot ---------- */
  function init() {
    buildSquares();
    sizeBoard();
    buildLevels();

    /* optional URL parameters: ?fen=...&level=club&color=b */
    var p = urlParams();
    if (p) {
      var lv = p.get('level');
      if (lv) { state.level = lv; selectLevel(lv); }
      var col = p.get('color');
      if (col === 'w' || col === 'b' || col === 'r') state.colorChoice = col;
    }

    var kids = colorPick.querySelectorAll('.seg');
    for (var i = 0; i < kids.length; i++) kids[i].classList.toggle('active', kids[i].dataset.color === state.colorChoice);
    newGame();

    if (window.ResizeObserver) {
      new ResizeObserver(sizeBoard).observe(boardEl);
    } else {
      window.addEventListener('resize', sizeBoard);
    }
  }

  init();
})();
