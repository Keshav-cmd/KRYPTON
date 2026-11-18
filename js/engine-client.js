/* KRYPTØN — engine client
 *
 * A thin façade over the search with one promise-shaped API:
 *
 *     Engine.findBestMove(pos, levelId, opts) -> Promise<result|null>
 *     Engine.review(fen, moves, opts)         -> Promise<[{ply, played, best, delta}]>
 *
 * If Web Workers are available the search runs in js/engine-worker.js and the
 * main thread stays free to paint. If they are not — Safari on file://, an
 * ancient browser, a worker that failed to load — every call transparently
 * falls back to the in-page search, so behaviour is identical, only slower.
 *
 * The result shape matches AI.findBestMove, except that `move` is re-resolved
 * against the live position, so callers get the engine's real move object with
 * all of its flags (captured piece, castling, en passant) instead of a
 * deserialised copy.
 */
(function (global) {
  'use strict';

  var WORKER_URL = 'js/engine-worker.js';

  /* file:// cannot start a worker in Chrome or Safari */
  var supported = (typeof Worker === 'function') && (global.location && global.location.protocol !== 'file:');

  var worker = null;
  var seq = 0;
  var pending = null;

  /* ---------------- helpers ---------------- */

  function toFen(pos) {
    var rows = [];
    for (var r = 0; r < 8; r++) {
      var row = '';
      var empty = 0;
      for (var f = 0; f < 8; f++) {
        var p = pos.board[r * 8 + f];
        if (!p) { empty++; continue; }
        if (empty) { row += empty; empty = 0; }
        row += p;
      }
      if (empty) row += empty;
      rows.push(row);
    }
    var ep = pos.ep >= 0 ? Chess.squareName(pos.ep) : '-';
    return rows.join('/') + ' ' + pos.turn + ' ' + (pos.castling || '-') + ' ' + ep +
      ' ' + (pos.halfmove || 0) + ' ' + (pos.fullmove || 1);
  }

  function resolveMove(pos, wire) {
    if (!wire) return null;
    var legal = Chess.legalMoves(pos);
    for (var i = 0; i < legal.length; i++) {
      var m = legal[i];
      if (m.from === wire.from && m.to === wire.to &&
          (m.promo || null) === (wire.promo || null)) return m;
    }
    return null;
  }

  function spawn() {
    var w = new Worker(WORKER_URL);
    w.onmessage = onMessage;
    w.onerror = onWorkerError;
    return w;
  }

  function ensureWorker() {
    if (!supported) return null;
    if (!worker) {
      try {
        worker = spawn();
      } catch (e) {
        supported = false;
        worker = null;
      }
    }
    return worker;
  }

  function dropWorker() {
    if (!worker) return;
    try { worker.terminate(); } catch (e) { /* already gone */ }
    worker = null;
  }

  function finishInline(req) {
    ChessAI.findBestMove(req.pos, req.levelId, req.opts).then(req.resolve, function () {
      req.resolve(null);
    });
  }

  /* ---------------- worker events ---------------- */

  function onMessage(ev) {
    var msg = ev.data || {};
    if (!pending || msg.id !== pending.id) return;

    if (msg.type === 'progress') {
      if (pending.opts.onProgress) pending.opts.onProgress({ depth: msg.depth, nodes: msg.nodes });
      return;
    }

    if (msg.type === 'review-progress') {
      if (pending.opts.onProgress) pending.opts.onProgress({ done: msg.done, total: msg.total });
      return;
    }

    if (msg.type === 'review') {
      var doneReq = pending;
      pending = null;
      doneReq.resolve(msg.plies || []);
      return;
    }

    if (msg.type === 'result') {
      var req = pending;
      pending = null;
      if (!msg.move) { req.resolve(null); return; }
      var move = resolveMove(req.pos, msg.move);
      if (!move) { req.resolve(null); return; }
      req.resolve({
        move: move,
        score: msg.score,
        depth: msg.depth,
        nodes: msg.nodes,
        blunder: !!msg.blunder,
        level: ChessAI.getLevel(req.levelId)
      });
      return;
    }

    if (msg.type === 'error') {
      var failed = pending;
      pending = null;
      supported = false;
      dropWorker();
      if (failed) finishInline(failed);
    }
  }

  function onWorkerError() {
    /* the worker could not load or crashed: serve this request in-page and
       stop trying to use workers for the rest of the session */
    var req = pending;
    pending = null;
    supported = false;
    dropWorker();
    if (req) finishInline(req);
  }

  /* ---------------- review (fallback path) ---------------- */

  var REVIEW_LEVEL = 'casual';
  var REVIEW_CAP = 1200;

  function matchLegal(legal, u) {
    for (var i = 0; i < legal.length; i++) {
      var m = legal[i];
      if (m.from === u.from && m.to === u.to && (m.promo || null) === (u.promo || null)) return m;
    }
    return null;
  }

  /* same maths as the worker, run in-page when workers are unavailable */
  function reviewInline(fen, moves, opts) {
    var level = opts.level || REVIEW_LEVEL;
    var plies = [];
    var i = 0;

    return new Promise(function (resolve) {
      function step() {
        if (i >= moves.length) { resolve(plies); return; }

        var pos;
        try { pos = new Chess.Position(fen); } catch (e) { resolve(plies); return; }
        for (var k = 0; k < i; k++) {
          var lm = matchLegal(Chess.legalMoves(pos), moves[k]);
          if (!lm) { resolve(plies); return; }
          Chess.makeMove(pos, lm);
        }

        var legal = Chess.legalMoves(pos);
        var played = matchLegal(legal, moves[i]);
        if (!played) { resolve(plies); return; }
        if (opts.only && pos.turn !== opts.only) {
          plies.push({ ply: i + 1, played: { from: played.from, to: played.to, promo: played.promo || null },
                       best: null, bestSan: null, delta: 0, skipped: true });
          i++;
          if (opts.onProgress) opts.onProgress({ done: i, total: moves.length });
          setTimeout(step, 0);
          return;
        }

        ChessAI.findBestMove(pos, level, { noBlunder: true, exact: true, useTT: false })
          .then(function (best) {
            var after = pos.clone();
            Chess.makeMove(after, played);
            return ChessAI.findBestMove(after, level, { noBlunder: true, exact: true, useTT: false })
              .then(function (reply) {
                var bestScore = best ? best.score : 0;
                var playedScore = reply ? -reply.score : 0;
                var delta = Math.max(0, Math.min(REVIEW_CAP, Math.round(bestScore - playedScore || 0)));
                plies.push({
                  ply: i + 1,
                  played: { from: played.from, to: played.to, promo: played.promo || null },
                  best: best && best.move ? { from: best.move.from, to: best.move.to, promo: best.move.promo || null } : null,
                  bestSan: best && best.move ? Chess.toSAN(pos, best.move) : null,
                  delta: delta
                });
                i++;
                if (opts.onProgress) opts.onProgress({ done: i, total: moves.length });
                setTimeout(step, 0);            /* let the page paint between plies */
              });
          });
      }
      step();
    });
  }

  /* ---------------- public API ---------------- */

  function findBestMove(pos, levelId, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var w = ensureWorker();
      if (!w) {
        finishInline({ pos: pos, levelId: levelId, opts: opts, resolve: resolve });
        return;
      }

      var req = { id: ++seq, pos: pos, levelId: levelId, opts: opts, resolve: resolve };
      pending = req;

      try {
        w.postMessage({
          type: 'think',
          id: req.id,
          fen: toFen(pos),
          level: levelId,
          noBlunder: !!opts.noBlunder,
          exact: !!opts.exact,
          useTT: opts.useTT !== false
        });
      } catch (e) {
        pending = null;
        supported = false;
        dropWorker();
        finishInline(req);
      }
    });
  }

  function review(fen, moves, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var w = ensureWorker();
      if (!w) { reviewInline(fen, moves, opts).then(resolve); return; }

      var req = { id: ++seq, kind: 'review', resolve: resolve, opts: opts };
      pending = req;

      try {
        w.postMessage({ type: 'review', id: req.id, fen: fen, moves: moves, level: opts.level, only: opts.only });
      } catch (e) {
        pending = null;
        supported = false;
        dropWorker();
        reviewInline(fen, moves, opts).then(resolve);
      }
    });
  }

  /* Abandon the current search. Called whenever the game moves on underneath
     us (new game, undo, resign) so a stale search cannot burn a phone battery. */
  function cancel() {
    if (!pending) return;
    pending = null;
    dropWorker();
    /* spawning a worker costs ~50 ms on a throttled phone, and it used to land
       right on the next move. Warm a replacement while the page is idle instead. */
    if (supported) setTimeout(ensureWorker, 220);
  }

  function mode() { return supported ? 'worker' : 'inline'; }

  /* Spawn eagerly so the first bot move does not pay the startup cost. */
  function prewarm() { ensureWorker(); }

  global.Engine = {
    findBestMove: findBestMove,
    review: review,
    cancel: cancel,
    mode: mode,
    prewarm: prewarm,
    toFen: toFen
  };
})(typeof window !== 'undefined' ? window : globalThis);
