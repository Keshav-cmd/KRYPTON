<div align="center">

<img src="assets/poster.png" alt="KRYPTØN — free AI chess game you can play online against five chess engines, Obsidian Edition" width="100%">

# KRYPTØN — Free AI Chess Game You Can Play Online

**Play chess against five AI opponents in your browser. No sign-up, no install, no engine to configure.**

`v1.1.2` · the engine runs in a worker, games resume after a refresh, the app installs offline, and every game you finish is rated and reviewed.

[![Live demo](https://img.shields.io/badge/live_demo-keshav--cmd.github.io%2FKRYPTON-D8B878?style=flat-square&labelColor=0B0D12)](https://keshav-cmd.github.io/KRYPTON/)
[![Download APK](https://img.shields.io/badge/download-Android_APK-D72638?style=flat-square&labelColor=0B0D12)](https://github.com/Keshav-cmd/KRYPTON/raw/refs/heads/main/app/KRYPT%C3%98N.apk)
[![Built with](https://img.shields.io/badge/built_with-HTML_%2B_CSS_%2B_JS-A78BFA?style=flat-square&labelColor=0B0D12)](js/)
[![No dependencies](https://img.shields.io/badge/dependencies-zero-9299A9?style=flat-square&labelColor=0B0D12)](#how-the-engine-thinks)

[**Play now**](https://keshav-cmd.github.io/KRYPTON/) · [Download the APK](https://github.com/Keshav-cmd/KRYPTON/raw/refs/heads/main/app/KRYPT%C3%) · [Screenshots](#screenshots) · [How it works](#how-the-engine-thinks)

</div>

---

**KRYPTØN** is a free, open-source **AI chess game** that runs entirely in your browser. It pits you against five distinct **chess engines** — from a beginner-friendly strategist at ~450 Elo to a full-strength 7-ply searcher at ~1900 Elo — on a single page of HTML, CSS and JavaScript. There is no backend, no account, no analytics and nothing to install: every move is calculated on your own device, which means it also works **offline**.

The project is a from-scratch chess engine — move generation, alpha-beta search, evaluation and all — with a UI built around it in the **Obsidian Edition** design system (void black, titanium, champagne gold).

## Table of contents

- [Play online](#play-online)
- [Screenshots](#screenshots)
- [The five AI opponents](#the-five-ai-opponents)
- [Features](#features)
- [How the engine thinks](#how-the-engine-thinks)
- [Colour system — Obsidian Edition](#colour-system--obsidian-edition)
- [Download & install](#download--install)
- [Controls & keyboard shortcuts](#controls--keyboard-shortcuts)
- [URL parameters](#url-parameters)
- [Project structure](#project-structure)
- [FAQ](#faq)
- [Credits](#credits)

## Play online

**[keshav-cmd.github.io/KRYPTON](https://keshav-cmd.github.io/KRYPTON/)** — works in any modern desktop or mobile browser, installs to nothing, and needs no account. Pick an opponent, choose White or Black, and start playing.

Prefer an app icon on your home screen? Grab the Android build: **[`app/KRYPTØN.apk`](https://github.com/Keshav-cmd/KRYPTON/raw/refs/heads/main/app/KRYPT%C3%98N.apk)**.

## Screenshots

| Desktop — playing CAISSA | Board detail — selection, legal moves, last move |
| :---: | :---: |
| ![KRYPTØN desktop interface: chessboard, opponent ladder, evaluation bar and move list](screenshots/01-desktop.png) | ![Chessboard detail showing gold selection ring, green legal-move dots and gold last-move highlight](screenshots/02-board-detail.png) |

| Engine thinking & hint | Victory screen | Mobile layout |
| :---: | :---: | :---: |
| ![Violet AI panel while the chess engine is calculating depth and nodes](screenshots/05-engine-thinking.png) | ![Checkmate victory modal with champagne gold confetti](screenshots/03-victory.png) | ![KRYPTØN chess game on a phone, single column layout](screenshots/04-mobile.png) |

![Post-game review: a violet ACPL chip and a blunder marked in the move list with the better move named](screenshots/06-review.png)

## The five AI opponents

Five fixed personalities, each with its own search budget and mistake rate — a deliberate difficulty ladder rather than a slider.

| #  | Bot            | Title                     | Elo   | How it plays                                    |
| -- | -------------- | ------------------------- | ----- | ----------------------------------------------- |
| 01 | **NOX**        | The Shadow Strategist     | ~450  | depth 1, 50 % random moves                      |
| 02 | **DEEPNIGHT**  | The Calculating Master    | ~850  | depth 2, 22 % random moves                      |
| 03 | **AXIOM**      | The Logical Genius        | ~1200 | depth 3 with quiescence search                  |
| 04 | **CAISSA**     | The Spirit of Chess       | ~1550 | depth 5, null-move pruning                      |
| 05 | **NEMESIS**    | The Ultimate Challenger   | ~1900 | depth 7, full search                            |

Press `1`–`5` to jump between them mid-session.

## Features

- **Play chess against AI** by clicking or dragging — castling, en passant, under-promotion and the promotion picker all work
- **Full rule set**: check, checkmate, stalemate, threefold repetition, fifty-move rule and insufficient material are all detected
- **Legal-move highlighting** in green, gold selection and a restrained gold last-move overlay — pieces stay legible on both square colours
- **Your own rating** — a local Elo estimate that moves with every result, the same maths chess servers use; no account, nothing leaves the device
- **Post-game review** — when the game ends the engine replays it and scores every move you played against its own choice, marking blunders and mistakes in the move list and naming the move you should have played
- **Evaluation bar** plus a live engine read-out (search depth and nodes searched) for every move
- **Background search** — the engine runs off the main thread, so the board stays smooth even while NEMESIS is 6 plies deep
- **Hints** from a full-strength search when you get stuck, and single-click **undo** that takes back a whole round
- **Resumes where you left off** — the game is saved to `localStorage` after every move, so a refresh, a closed tab or a phone call mid-game does not throw it away
- **Play as White, Black or random**; the board auto-orients and can be flipped at any time
- **Move list** with click-to-review any earlier position, then jump back to the live game
- **PGN export** to the clipboard, captured-material panel, synthesized sound effects
- **Responsive** down to small phones, with visible keyboard focus rings and `prefers-reduced-motion` support
- **Installable** — a service worker caches the whole app, so "Add to Home Screen" gives you a real app icon that opens with no network and no browser chrome
- **Offline and private**: no network calls, no tracking, no accounts

## How the engine thinks

The engine is written from scratch in `js/engine.js` and `js/ai.js` — no Stockfish, no WASM blobs, no dependencies.

| Layer | Implementation |
| ----- | -------------- |
| Board | 0×88 mailbox representation, incremental zobrist hashing |
| Move generation | Fully legal generation — pins, checks, castling rights, en passant |
| Search | Alpha-beta with iterative deepening, transposition table, killer moves, history heuristic, MVV-LVA ordering |
| Quiescence | Capture-only search at the horizon to avoid the horizon effect |
| Pruning | Null-move pruning at the higher tiers |
| Evaluation | Material, piece-square tables, king safety, pawn structure, mobility |
| Scheduling | The search runs in a **Web Worker** (`js/engine-worker.js`), so the interface keeps its frame budget while a bot thinks; if workers are unavailable it falls back to the in-page search and plays identically |

Correctness is checked against known references rather than by feel: the starting position returns **20** legal moves, **perft(3) = 8,902**, and Kiwipete at depth 2 returns **2,039** — the standard values for a correct move generator.

## Colour system — Obsidian Edition

Deep black, titanium panels, one champagne accent. Colour is earned, not sprayed: gold marks the brand and the engine's voice, crimson is reserved for the things that end a game, violet belongs to the AI, green means "this move is legal".

| Token        | Hex       | Name            | Role                                                                  |
| ------------ | --------- | --------------- | --------------------------------------------------------------------- |
| `--void`     | `#0B0D12` | Void Black      | page background, ~50 % of the surface                                 |
| `--titanium` | `#191D26` | Titanium        | panels and cards (~25 % together with graphite)                       |
| `--graphite` | `#292D37` | Graphite        | elevated surfaces, dark board squares, active rows                    |
| `--gold`     | `#D8B878` | Champagne Gold  | primary buttons, wordmark, eval bar, engine read-outs (~12 %)         |
| `--crimson`  | `#D72638` | Crimson Red     | resign, alerts, check, defeat (~8 %)                                  |
| `--violet`   | `#A78BFA` | Electric Violet | AI surfaces: opponent picker, thinking state, hints (~5 %)            |
| `--steel`    | `#9299A9` | Steel Grey      | secondary text, labels, metadata                                      |
| `--cloud`    | `#F4F1EA` | Cloud White     | primary text, bone board squares                                      |

Derived tokens keep the board and feedback states on the same palette: `--sq-light #DDD6C7`, `--sq-dark #2B303B`, `--legal #28854F` (move dots) / `--legal-strong #63C98C` (on dark squares), `--gold-text #E7CD95`, `--violet-text #C3B2FC`, `--crimson-text #F08A98`, plus a gold ramp (`--gold-50` … `--gold-550`) and RGB triplets so translucent layers are mixed from the same values.

Every colour in `styles.css` resolves from the `:root` token block — a scan finds no stray hex or `rgba()` literal elsewhere in the stylesheet. All text pairs clear WCAG AA (Cloud/Void 17.2:1, Cloud/Graphite 12.2:1, Gold/Titanium 8.9:1, Violet-text/Titanium 8.9:1, Steel/Titanium 5.9:1) and the legal-move dots clear 3:1 on both board colours.

### Logo & app icon

The mark is a geometric gold knight on an obsidian tile, carrying the palette into the browser
chrome and the Android launcher:

| File | Use |
| ---- | --- |
| `assets/logo/icon-512.png` | Play Store / Android launcher / social avatars |
| `assets/logo/icon-192.png`, `icon-180.png` | PWA manifest icon, iOS home screen |
| `assets/logo/favicon.ico`, `icon-32.png`, `icon-16.png` | browser tabs and bookmarks |
| `assets/logo/logo-lockup.png` / `-dark.png` | horizontal lockup for slides, posts and docs |

`index.html` links the favicons, the Apple touch icon and `site.webmanifest`, and sets
`theme-color` to Void Black so mobile browser chrome matches the app.

## Download & install

### Play in the browser

Open **[keshav-cmd.github.io/KRYPTON](https://keshav-cmd.github.io/KRYPTON/)** — nothing else required.

### Android APK

Download **[`app/KRYPTØN.apk`](https://github.com/Keshav-cmd/KRYPTON/raw/refs/heads/main/app/KRYPT%C3%98N.apk)** and open it on your phone. Android will ask for permission to install from your browser or file manager the first time (*Settings → Install unknown apps*). The same build works offline.

> The repository stores the APK at `app/KRYPTØN.apk`. Because the filename contains `Ø`, links use the percent-encoded path `https://github.com/Keshav-cmd/KRYPTON/raw/refs/heads/main/app/KRYPT%C3%https://github.com/Keshav-cmd/KRYPTON/raw/refs/heads/main/app/KRYPT%C3%98N.apk98N.apk`.

### Run it locally

```bash
git clone https://github.com/keshav-cmd/KRYPTON.git
cd KRYPTON
python3 -m http.server 8000
# then open http://localhost:8000
```

There is no build step and there is no `npm install` — `index.html` opens directly from disk too, which is also why the game works offline.

## Controls & keyboard shortcuts

| Key | Action |
| --- | ------ |
| `1`–`5` | Pick an opponent (NOX → NEMESIS) |
| `N` | New game |
| `U` | Undo a full round |
| `H` | Hint from the engine |
| `F` | Flip the board |
| `Esc` | Clear the current selection |

Click your piece, click the destination — or drag and drop. Click any move in the move list to review the position, then *Back to live*.

## URL parameters

Handy for demos, testing and sharing a position:

```text
?level=<id|name>&color=<w|b>&fen=<FEN>
```

- `level` accepts the internal id (`novice`, `casual`, `club`, `expert`, `master`) or the bot's name (`NOX`, `DEEPNIGHT`, `AXIOM`, `CAISSA`, `NEMESIS`)
- `color` accepts `w` or `b` (or `white` / `black`)
- `fen` loads any position, so you can share a puzzle or analyse a specific game

Example: `index.html?level=nemesis&color=b&fen=6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1`

## Project structure

```text
KRYPTON/
├── index.html              # app shell — board, opponent ladder, panels, modals
├── styles.css              # Obsidian Edition design system (all colours are tokens)
├── js/
│   ├── engine.js           # board, move generation, make/unmake, SAN, FEN, game state
│   ├── ai.js               # evaluation, search, the five difficulty tiers
│   ├── engine-worker.js    # search in a background thread (FEN in, move out)
│   ├── engine-client.js    # Engine façade: worker when available, inline fallback
│   └── app.js              # rendering, input, game flow, modals, sound
├── assets/
│   ├── pieces/             # SVG chess piece set
│   ├── logo/
│   │   ├── icon-master.png # square logo master (transparent corners)
│   │   ├── icon-16 … 512   # app icon / favicon sizes
│   │   ├── favicon.ico     # multi-resolution favicon
│   │   └── logo-lockup.png # icon + wordmark, light and dark variants
│   └── poster.png          # this README's hero image
├── screenshots/            # reference renders used above
├── docs/
│   ├── CHANGELOG.md         # what changed per upgrade step, file by file
│   ├── repo-metadata.md     # description, topics, social preview
│   └── changes/             # ready-to-apply .patch files per step
├── site.webmanifest        # PWA install metadata, icons, screenshots, theme colour
├── sw.js                   # service worker: offline shell + cache versioning
└── app/
    └── KRYPTØN.apk         # Android build
```

## FAQ

**Is KRYPTØN free?**
Yes. The whole game is free to play in the browser or as an APK, with no ads, accounts or paywalls.

**Do I need to install anything to play online?**
No. It is a static site — HTML, CSS and JavaScript only — so it runs in any modern browser and even loads straight from the filesystem.

**Does refreshing the page lose my game?**
No. Each move is written to `localStorage` (about 200 bytes: the start position plus the moves
played), so reloading resumes the same game, opponent and colour. Resigning or starting a new
game clears it, and nothing is ever sent anywhere — the save never leaves your device.

**Can I install KRYPTØN as an app?**
Yes. On Chrome, Edge and Android an **Install app** button appears in the *You play* panel once the
browser decides the app is installable; on iPhone and iPad use **Share → Add to Home Screen**. The
installed version keeps working with no connection, because a service worker caches the entire
shell — board, pieces, engine and all.

**Does it work offline?**
Yes. Once the page is loaded (or the APK is installed) the engine runs locally on your device, so no internet connection is required to play.

**Can I play as Black?**
Yes — choose Black before you start, use *Random*, or flip the board with `F` at any time.

**Is it as strong as Stockfish?**
No, and it does not try to be. KRYPTØN is a compact, readable engine tuned to a human-relevant range, from ~450 Elo for beginners to ~1900 Elo for experienced club players.

**Which is the hardest opponent?**
NEMESIS at ~1900 Elo — full 7-ply search with null-move pruning. CAISSA (~1550) is the usual tipping point for improving players.

**How do I take back a move?**
Press `U` or hit **Undo**: it takes back your move and the engine's reply together, so it is always your turn again.

**How does the post-game review work?**
When a game ends, the engine replays it and searches the position before and after each of your
moves at the same depth, then compares the two scores. The gap — in centipawns, where 100 is one
pawn — becomes your average centipawn loss (ACPL), the same metric chess servers use. Moves that
lose 1.5 pawns or more are marked as blunders, 0.8 as mistakes, 0.4 as inaccuracies; hover any
mark to see what it cost and what the engine preferred. Your opponent's moves are replayed but not
scored, which halves the analysis time.

**Where does my rating come from?**
It starts at 800 and moves after every finished game using the standard Elo formula, scored against
the bot's own rating — so beating NOX at 450 barely moves it, while beating NEMESIS at 1900 moves
it a long way. The first ten games are provisional and move faster (K = 40, then 20). It lives in
`localStorage` next to your saved game; there is no account and no server.

**Can I copy the game as PGN?**
Yes — **Copy PGN** puts the full game on your clipboard, ready to paste into a database or share.

## Credits

Designed and built by **Keshav Jha**.

- Live site: [keshav-cmd.github.io/KRYPTON](https://keshav-cmd.github.io/KRYPTON/)
- Source: [github.com/keshav-cmd/KRYPTON](https://github.com/keshav-cmd/KRYPTON)

If you play a game and enjoy it, a ⭐ on the repository genuinely helps other people find it.

---

<div align="center">
<sub>KRYPTØN · Obsidian Edition · chess engine written from scratch in JavaScript</sub>
</div>
