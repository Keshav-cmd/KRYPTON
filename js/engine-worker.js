/* KRYPTØN — engine worker
 *
 * Runs the search in a background thread so the interface never stutters while
 * a bot is thinking. The protocol is deliberately tiny and stateless: the page
 * sends a FEN, the worker sends back a from/to/promo triple.
 *
 *   in : { type:'think',  id, fen, level, noBlunder?, exact?, useTT? }
 *        { type:'review', id, fen, moves:[{from,to,promo}], level? }
 *   out: { type:'progress', id, depth, nodes }
 *        { type:'result', id, move:{from,to,promo}|null, score, depth, nodes, blunder }
 *        { type:'review-progress', id, done, total }
 *        { type:'review', id, plies:[{ ply, played, best, delta }] }
 *        { type:'error',  id, message }
 *
 * Cancellation is handled by the page terminating the worker — a fresh one is
 * spawned on the next request, which is cheaper and more predictable than
 * threading an abort flag through the search.
 */

importScripts('engine.js', 'ai.js');

var PROGRESS_INTERVAL_MS = 60;

self.onmessage = function (e) {
  var msg = e.data || {};
  if (msg.type === 'review') { runReview(msg); return; }
  if (msg.type !== 'think') return;

  var pos;
  try {
    pos = new Chess.Position(msg.fen);
  } catch (err) {
    self.postMessage({ type: 'error', id: msg.id, message: 'bad position' });
    return;
  }

  var lastPost = 0;

  ChessAI.findBestMove(pos, msg.level, {
    noBlunder: !!msg.noBlunder,
    exact: !!msg.exact,
    useTT: msg.useTT !== false,
    onProgress: function (info) {
      var now = Date.now();
      if (now - lastPost < PROGRESS_INTERVAL_MS) return;
      lastPost = now;
      self.postMessage({ type: 'progress', id: msg.id, depth: info.depth, nodes: info.nodes });
    }
  }).then(function (res) {
    if (!res) {
      self.postMessage({ type: 'result', id: msg.id, move: null });
      return;
    }
    self.postMessage({
      type: 'result',
      id: msg.id,
      move: { from: res.move.from, to: res.move.to, promo: res.move.promo || null },
      score: res.score,
      depth: res.depth,
      nodes: res.nodes,
      blunder: !!res.blunder
    });
  }).catch(function (err) {
    self.postMessage({
      type: 'error',
      id: msg.id,
      message: String((err && err.message) || err)
    });
  });
};

/* ---------------- post-game review ----------------

   Walks the game and scores every move against the engine's choice:

     bestScore   = search from the position before the move (mover's view)
     playedScore = -(search of the position after the move)  ← opponent's view, negated
     delta       = bestScore - playedScore, in centipawns, never negative

   Both sides are searched at the same shallow depth so the comparison is
   symmetric; that is what keeps a "blunder" honest rather than a horizon
   artefact. The page decides how to label the deltas.
*/

var REVIEW_LEVEL = 'casual';   /* depth 2 — fast, and deep enough to see a capture+recapture */
var REVIEW_CAP = 1200;         /* clamp: one bad move is not worth more than 12 pawns */

function uciOf(m) { return { from: m.from, to: m.to, promo: m.promo || null }; }

function matchLegal(legal, u) {
  for (var i = 0; i < legal.length; i++) {
    var m = legal[i];
    if (m.from === u.from && m.to === u.to && (m.promo || null) === (u.promo || null)) return m;
  }
  return null;
}

async function reviewMove(pos, level) {
  return ChessAI.findBestMove(pos, level, { noBlunder: true, exact: true, useTT: false });
}

async function runReview(msg) {
  var pos;
  try {
    pos = new Chess.Position(msg.fen);
  } catch (err) {
    self.postMessage({ type: 'error', id: msg.id, message: 'bad position' });
    return;
  }

  var moves = msg.moves || [];
  var level = msg.level || REVIEW_LEVEL;
  var only = msg.only || null;             /* 'w' | 'b': score just the human's moves */
  var plies = [];

  for (var i = 0; i < moves.length; i++) {
    var legal = Chess.legalMoves(pos);
    if (!legal.length) break;

    var played = matchLegal(legal, moves[i]);
    if (!played) break;                      /* a move that is not legal: stop here */

    var after = pos.clone();
    Chess.makeMove(after, played);

    /* the opponent's moves are replayed but not scored: nobody reads them */
    if (only && pos.turn !== only) {
      plies.push({ ply: i + 1, played: uciOf(played), best: null, bestSan: null, delta: 0, skipped: true });
      self.postMessage({ type: 'review-progress', id: msg.id, done: i + 1, total: moves.length });
      pos = after;
      continue;
    }

    var best = await reviewMove(pos, level);
    var reply = await reviewMove(after, level);

    var bestScore = best ? best.score : 0;
    var playedScore;
    if (reply) {
      playedScore = -reply.score;            /* opponent's view, flipped to ours */
    } else {
      /* no legal reply: the move ended the game (mate, stalemate, or a rule draw) */
      playedScore = Chess.status(after).over && !Chess.status(after).result.startsWith('1/2')
        ? 100000 : 0;
    }

    var delta = bestScore - playedScore;
    if (!isFinite(delta)) delta = 0;
    delta = Math.max(0, Math.min(REVIEW_CAP, Math.round(delta)));

    plies.push({
      ply: i + 1,
      played: uciOf(played),
      best: best && best.move ? uciOf(best.move) : null,
      bestSan: best && best.move ? Chess.toSAN(pos, best.move) : null,
      delta: delta
    });

    self.postMessage({ type: 'review-progress', id: msg.id, done: i + 1, total: moves.length });

    pos = after;
  }

  self.postMessage({ type: 'review', id: msg.id, plies: plies });
}
