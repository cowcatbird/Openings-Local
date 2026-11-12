# Openings Local

A ChessReps-style chess opening trainer that runs 100% offline as a Chrome extension, an Android app or an iPhone home-screen app. Nothing is uploaded; all progress lives on your device.

## Install (Chrome / Edge / Brave)

1. Download the latest zip from the [Releases page](https://github.com/cowcatbird/Openings-Local/releases) and unzip it, or clone this repository.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the folder that contains `manifest.json`.
4. Pin the ♞ icon and click it. The app opens in its own tab.

## Install on iPhone or iPad

1. Open https://cowcatbird.github.io/Openings-Local/ in Safari.
2. Tap **Share**, then **Add to Home Screen**.
3. Open **Openings** from your home screen. It works offline from then on.

## Install on Android

1. On your phone, open the [Releases page](https://github.com/cowcatbird/Openings-Local/releases) and download the `.apk` file.
2. Open the downloaded file. When Android asks, allow your browser to install apps.
3. Tap **Install**, then open **Openings Local** from your home screen.

The Android app has no internet permission, so it cannot send anything anywhere.

Progress stays on each device. To move it to another device, open **Settings → Backup**, export, and import the file on the other device.

## How it works

Every course is a tree for one side. You always play one move; the tree branches on the replies real opponents actually choose, taken from 5.3 million rated lichess games. Popular mistakes are included, so you also learn how to punish them (for example the Fried Liver's 7...Kg8?? running into Bxd5+, Qxd5, Qxd5+ and Qxe6#).

- **Courses**: 37 built-in courses for both colours, from the Italian, Ruy Lopez and London to gambits like the Grob, Fried Liver, Vienna, Danish, Halloween, Stafford, Englund, Albin and Benko. Every move you play comes with a coaching note.
- **Essentials or Full Mastery**: start with the most common lines, or take on every line in the course.
- **Learn**: play through a new line with the coach telling you each move and why.
- **Practice**: replay learned lines from memory with no instructions. Spaced repetition decides what comes back and when; a clean run marks the line as perfected.
- **Drill**: recall as many perfected lines in a row as you can. One mistake ends the run.
- **Time**: a 60-second trial. Correct moves add time, and the clock speeds up after every line.
- **Puzzles**: positions right after the opponent's mistake; find the punishing line.
- **Lines**: browse every line in a course and jump straight into any of them.
- **Analysis Board**: free board with an offline games explorer (move statistics from the same game database) and named continuations from the 3,865-entry opening database.
- **Create a Course**: paste or open a PGN with variations. Comments become coaching notes, and `?` or `??` on opponent moves become puzzles. Add any line from the Analysis board or the Opening Library to your own courses.
- **Opening Library**: every named opening and gambit, searchable by name, ECO code or moves.
- **Progress**: day streak, activity heatmap and per-course records.
- **Settings**: four piece sets, eight board colours, board size, text size, dark/light theme, sounds, animation speed, opponent speed, evaluation bar and effects. Backup and restore as one JSON file.

Keyboard: `H` hint (press again to solve), `Esc` show modes, `←` `→` previous/next line, `Space` next line or undo a wrong move. Right-click drag draws arrows. On the Analysis board: `←` `→` `Home` `End`, and `F` flips.

## Previewing outside Chrome

`node tools/serve.js` serves the app at http://localhost:8765/app/index.html (the app itself does not use extension APIs; only the toolbar button does).

To preview the offline web version, run `node tools/build-web.js`. It copies `app/` to `_site/` and adds the service worker that caches every file. Serve `_site/` with any static server, for example `npx serve _site`.

The Android project lives in `android/` and packages `app/` as its assets. `gradle -p android assembleRelease` builds it with Gradle 8.11.1 and JDK 17.

## Rebuilding the data

All generated data is checked in, so none of this is needed to use the app.

1. `node tools/build-openings.js` builds `app/js/openings-data.js` from the lichess chess-openings TSV files in `tools/data`.
2. `node --max-old-space-size=24000 tools/build-book.js tools/cache/book.json <lichess .pgn.zst files>` counts moves from lichess monthly dumps (https://database.lichess.org).
3. `node tools/build-explorer.js` trims the book into `app/js/book-data.js`.
4. `node tools/build-courses.js` builds `app/js/courses-data.js` from the course definitions in `tools/courses.js`, the book, and move scores from the chessdb.cn cloud database (cached in `tools/cache/chessdb.json`). Use `--only=grob-gambit,stafford-gambit` to rebuild single courses.

## Releases

Each `v*` tag builds a ready-to-load zip and a signed Android `.apk` on the Releases page, and deploys the web version to GitHub Pages. The Android version number comes from `manifest.json` too. To cut a new release, bump `version` in `manifest.json`, commit, then:

```bash
git tag v2.0.1 && git push origin v2.0.1
```

## Credits

See `CREDITS.md`.
