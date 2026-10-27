# Openings Local

A fully offline chess opening trainer, packaged as a Chrome extension. Click the toolbar icon and the app opens in a new tab. Nothing is ever uploaded; all data lives in the browser profile.

## Install (Chrome / Edge / Brave)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick this folder (`Openings Local`).
4. Pin the ♞ icon and click it. The app opens in its own tab.

## What's inside

- **Library**: 3,865 named openings and variations (150 families, ~1,000 gambits) from the lichess opening database. Search by name, ECO code or moves; filter by first move, ECO volume or gambits only. Add any variation to your White or Black repertoire with one click, or add a whole family.
- **Repertoire**: your lines grouped by opening, with mastery level, due date and mistake history. Rename, edit moves on the board, switch colour, reset progress, export as PGN.
- **Train**: spaced-repetition drills (Again / Hard / Good / Easy). Modes: Reps due, Learn new lines, Fix mistakes, All White, All Black, Random 10, Weakest lines. New lines get a guided pass with arrows, then a test from memory. Wrong moves shake the board, show the repertoire move, and count against the grade.
- **Explore**: a free board with named continuations from the database at every position. Build your own line move by move, then add it as White or Black or drill it immediately.
- **Add PGN**: paste or open a `.pgn` file. Multiple games, comments and nested variations are supported; each variation becomes its own line and every move is validated.
- **Dashboard & Stats**: due counts, streak, activity heatmap, reps per day, mastery distribution, hardest lines, progress by opening.
- **Settings**: four piece sets (cburnett, merida, alpha, staunty), seven board colours, board size, text size, dark/light theme, sound and volume, animation speed, new lines per day, guided first pass, opponent delay, auto-continue. Backup and restore everything as a single JSON file.

Keyboard: `H` hint, `S` skip, `1`–`4` grade, `Space` accept suggested grade, `Esc` end session. In Explore: `←` `→` `Home` `End` navigate, `F` flip.

## Previewing outside Chrome

`node tools/serve.js` serves the app at http://localhost:8765/app/index.html (the app itself does not use any extension APIs, only the toolbar button does).

## Rebuilding the opening database

`node tools/build-openings.js` regenerates `app/js/openings-data.js` from the TSV files in `tools/data` (lichess-org/chess-openings).

## Credits

See `CREDITS.md`.

## Releases

Each `v*` tag builds a ready-to-load zip on the [Releases page](https://github.com/cowcatbird/Openings-Local/releases). To cut a new release, bump `version` in `manifest.json`, commit, then:

```bash
git tag v1.0.1 && git push origin v1.0.1
```
