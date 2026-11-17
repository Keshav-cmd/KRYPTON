# KRYPTØN

A complete, playable chess game against five AI minds — dressed in the **Obsidian Edition**
colour system. Plain HTML/CSS/JS: no build step, no dependencies.

**Created by Keshav Jha.**

## Run

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000
```

## The five minds

| #  | Bot          | Title                       | Elo   | Search                     |
| -- | ------------ | --------------------------- | ----- | -------------------------- |
| 01 | **NOX**      | The Shadow Strategist       | ~450  | depth 1 + 50% random moves |
| 02 | **DEEPNIGHT**| The Calculating Master      | ~850  | depth 2 + 22% random moves |
| 03 | **AXIOM**    | The Logical Genius          | ~1200 | depth 3, quiescence        |
| 04 | **CAISSA**   | The Spirit of Chess         | ~1550 | depth 5, null-move pruning |
| 05 | **NEMESIS**  | The Ultimate Challenger     | ~1900 | depth 7, full search       |

Search is alpha-beta with iterative deepening, transposition table, killer/history
move ordering, quiescence search and null-move pruning. The root loop yields to the
browser between moves, so the page never locks up while a bot thinks.

## Palette — Obsidian Edition

Deep black, titanium panels, one champagne accent. Colour is earned, not sprayed: gold marks
the brand and the engine's voice, crimson is reserved for the things that end a game, violet
belongs to the AI, and green means "this move is legal".

| Token      | Hex       | Name             | Role                                                                 |
| ---------- | --------- | ---------------- | -------------------------------------------------------------------- |
| `--void`   | `#0B0D12` | Void Black       | page background, ~50% of the surface                                  |
| `--titanium` | `#191D26` | Titanium       | panels and cards (~25% together with graphite)                        |
| `--graphite` | `#292D37` | Graphite       | elevated surfaces, dark board squares, active rows                    |
| `--gold`   | `#D8B878` | Champagne Gold   | primary buttons, wordmark, eval bar, engine read-outs, headings (~12%) |
| `--crimson`| `#D72638` | Crimson Red      | resign, alerts, check, defeat (~8%)                                   |
| `--violet` | `#A78BFA` | Electric Violet  | AI surfaces: opponent picker, thinking state, hints, AI badge (~5%)   |
| `--steel`  | `#9299A9` | Steel Grey       | secondary text, labels, metadata                                      |
| `--cloud`  | `#F4F1EA` | Cloud White      | primary text, bone board squares                                      |

Derived tokens keep the board and feedback states on the same palette: `--sq-light #DDD6C7`,
`--sq-dark #2B303B`, `--legal #28854F` (move dots) / `--legal-strong #63C98C` (on dark
squares), `--gold-text #E7CD95`, `--violet-text #C3B2FC`, `--crimson-text #F08A98`, plus a
gold ramp (`--gold-50` … `--gold-500`) and RGB triplets (`--gold-rgb`, `--void-rgb`, …) so
translucent layers are mixed from the same values instead of new hexes.

Every colour in `styles.css` resolves from that token block — a scan finds no hex or `rgba()`
literal anywhere else in the stylesheet. `js/app.js` reads the palette at runtime for the
victory confetti (`--gold`, `--violet`, `--crimson`, `--cloud`, `--steel`), with the hex values
kept only as fallbacks. All text pairs clear WCAG AA — Cloud/Void 17.2:1, Cloud/Graphite 12.2:1, Gold/Titanium
8.9:1, Violet-text/Titanium 8.9:1, Steel/Titanium 5.9:1 — and the legal-move dots clear 3:1
on both board colours, keyboard focus draws a 2 px gold
ring, and `prefers-reduced-motion` collapses animation, transitions and confetti.

## Features

- Click-to-move and drag-and-drop, legal-move highlighting, last-move and check markers
- Castling, en passant, promotion picker, checkmate / stalemate / threefold repetition /
  fifty-move / insufficient-material detection
- Play as White, Black or random; board auto-orients and can be flipped
- Undo (takes back a full round), hint (expert-strength), resign, rematch
- Move list with click-to-review any position, then "Back to live"
- Evaluation bar, captured-material panel, per-move engine read-out (depth / nodes)
- PGN export to clipboard, synthesized sound effects, keyboard shortcuts

## Keyboard

`1`–`5` pick an opponent · `N` new game · `U` undo · `H` hint · `F` flip · `Esc` clear selection

## URL options

`?level=nemesis&color=b&fen=<FEN>` — `level` accepts either the id (`novice`, `casual`,
`club`, `expert`, `master`) or the bot's name (`NOX` … `NEMESIS`).

## Files

- `js/engine.js` — board representation, move generation, make/unmake, SAN, FEN, game state
- `js/ai.js` — evaluation, search, the five difficulty tiers
- `js/app.js` — rendering, input, game flow
- `styles.css` — the KRYPTØN theme: Obsidian Edition design tokens in `:root`
- `assets/pieces/` — SVG piece set
- `screenshots/` — reference renders: desktop, board detail, victory, mobile, engine thinking
