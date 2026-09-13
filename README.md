# Gambino Slots — how the art is rendered

Exploration of `game.onlinefungames.net` (Gambino Slots H5 client), 2026-09-13.

## The stack

- `play/free_fun_games.html` is a marketing wrapper. The game is an iframe:
  `https://game.onlinefungames.net/browser/index.html`
- The whole game is **Dart compiled to JS** (`gambino.dart.js`, ~25 MB, dart2js).
  The engine is an in-house Dart package called **`syd`** (see
  `packages/syd/assets/common_new.wad.xml`).
- Rendering is **WebGL** into the single `<canvas id="drawHere">` (1920×1080
  backing store, CSS-scaled). One GLSL program with `#ifdef` variants:
  TEXTURING / COLORING / MASK1 / MASK2 / COLOR_ADJUST / VIDEO / PREMULTALPHA.
  Canvas2D is used only as a helper (text rasterising, tinting, masks).
- Scene graph is data-driven: `GameScene` JSON with typed nodes
  (`sprite`, `ninePatch`, `ttf`, `node`, …), properties (Position, Size,
  DrawOrder, Color, SpriteName) and a timeline of `actions`
  (`interpolate` / `discrete` / `sequence` / `parallel`, CubicBezier easing).
  Think Flash/Animate exported to JSON.

## Asset pipeline

1. On boot the client logs `MapJson URL: assets/en.<quality>.<VERSION_CODE>.map.json`.
   `quality` is `low` on a 1x display (there are higher tiers), `VERSION_CODE`
   comes from `scripts/init_common_variables.js`.
   Current: `assets/en.low.master_1438c33c6a97863445a7b44a76a92d819a0ddb8e.map.json`
   → 2657 entries mapping logical path → content-hashed path.
2. Each feature/game is a **`.wad.xml` package**: XML wrapping JSON blobs.
   Elements: `<texture>` (with `<source path type>` png + webp variants),
   `<sprite>` (`SpriteFrameSheet`: TexturePacker-style frames, `sourceSize`,
   `spriteSourceSize`, optional `ninePatch`), `<font>` (BMFont `<char>` tables),
   `<ttf>`, `<audio>` (ogg + mp3), `<video>` (`<webgl path>` webm + mp4),
   `<scene>`.
3. Per game: `slot.wad.xml` (reels, popups, sounds, symbol animations),
   `slot_bg`, `loading`, `icon1x1` / `icon1x2` (+ `_gray`, `_anim`) for lobby
   tiles, `additional`, `newgame`, `BuySlotFeature`, etc. 239 game ids in the map.
4. **Atlases** are `atlas.rgba8888.webp` (png fallback), e.g. game117's slot
   atlas is 1398×1762 with a 27-frame fire-ring animation packed in it.
5. **Symbol animations are video, not sprites.** `.bik` ids (Bink, from the
   native build) are served as VP8 `.webm` (mp4 fallback) with the frame packed
   **RGB on the left half | alpha matte on the right half**; the fragment
   shader does `color.a = texture2D(us_0, outCoord + vec2(0.5, 0)).x`.
   Example: `game117/icons/InAnim_3_1.webm` is 708×490 @ 24 fps → a 354×490
   pot-of-gold symbol with alpha.

## Is it accessible from the browser?

Yes — nothing is encrypted or auth-gated. Everything above is plain GET from
the same public paths the client uses (the 403s you get guessing paths are
just GCS "no such object"). DevTools → Network, filter `assets/`, and you see
every atlas, webm and wad go by. `assets.mjs` walks it from the map instead.

```
node assets.mjs games             # game ids
node assets.mjs list game117      # every file each wad references
node assets.mjs fetch game117 slot  # download a wad + its webp/webm/ogg/ttf
```

Local samples in `game117/`: `slot.wad.xml`, `slot.atlas.{webp,png}`,
`InAnim_3_1.webm` + an extracted frame showing the RGB|alpha packing.

The art is Gambino's (Spiral Interactive) copyrighted work — fine to study
the format and technique, not to ship.

## Viewer app

`viewer/` — Vite + React app that loads any game or lobby feature on demand and plays its
states with anime.js: `cd viewer && npm install && npm run dev`. See `viewer/README.md`.

## Scene inspectors and anime.js rebuilds

Interactive pages built from the scene data (each `zeus/*.html` is self-contained):

- Zeus 2 inspector — https://claude.ai/code/artifact/2020db08-2894-4436-a104-36cbf2778ade
- Jackpot City inspector — https://claude.ai/code/artifact/42ef6b2e-43ea-41f7-ac55-41151ceac772
- Bonus Wheel inspector — https://claude.ai/code/artifact/2246c379-07a5-4fb9-a236-de98ca03567f
- Bonus Wheel in anime.js — https://claude.ai/code/artifact/bd97ce46-3abe-4de5-b82d-36fb5c3afc44
- Flash Cash Jackpot popup in anime.js — https://claude.ai/code/artifact/481993e6-2826-42b3-8f6e-2e3846db7ab9
- Wheel jackpot popup in anime.js — https://claude.ai/code/artifact/7765a6ef-c41a-4c55-b54a-e627fbf035b8
- Teardown write-up — https://claude.ai/code/artifact/d905a3ff-c95a-476b-94dc-ca1a3b8f55da
- **Catalogue of every game and lobby feature** — https://claude.ai/code/artifact/f85b486a-f866-43e3-beb8-2be5f5564a62

```
node catalog/crawl.mjs        # every .wad.xml manifest in the map (games + lobby) + lobby tiles, ~35 s
node catalog/index.mjs        # -> catalog/catalog.json: scenes, state machines, animated states, sprites, videos, grid…
node catalog/build-page.mjs   # -> catalog/gambino-catalog.html
```

```
node assets.mjs fetch game154 slot && node assets.mjs fetch game154 slot_bg
node zeus/build.mjs game154                      # -> zeus/game154-inspector.html (tree, node, states, timeline player)
node assets.mjs get lobby_next_version/BonusWheel.wad.xml
node zeus/build.mjs --wad dl/lobby_next_version/BonusWheel.wad.xml --main lobby/BonusWheel/sceneBonusWheel.object \
     --title "Bonus Wheel" --out zeus/bonuswheel-inspector.html
node zeus/to-anime.mjs --wad dl/game103/slot.wad.xml --scene slot/jackpot/scene_mobile.object --state jackpot0 \
     --title "Flash Cash Jackpot" --out zeus/anime/jackpot.html        # DOM + anime.js 4 version of one state
python3 scene.py find "zeus" | list <wad> | tree <wad> <scene> [depth] | sm <wad> <scene>
```

Format notes that took real reverse engineering (also in `LEARNINGS.md`): `stateMachine: k` indexes
`states[]` (first leaf = initial state); `state.onEnter` indexes the owning node's `actions[]`;
`reference.target` numbers nodes in an expanded post-order walk (shared nodes counted per parent);
a keyframe with no value means the property's type default; `Skew` with x = y is rotation in degrees;
`Color.rgb` is a multiply tint. The browser client instantiates `slot/scene_mobile` and `slot_bg/scene`.

## Files

- `page.html`, `browser-index.html` — wrapper and game HTML
- `gambino.dart.js` — the client bundle (rendering core ≈ lines 754k, 760k)
- `scripts_*.js` — boot scripts with the version/stage variables
- `map.json`, `stages_list.json`, `login.wad.xml`, `lobby.wad.xml`,
  `common_new.wad.xml` (the shaders)
- `capture.mjs`, `capture-lobby.mjs`, `requests.json` — headless-Chrome captures (each run creates a guest user on their backend)
- `games.json` — flattened catalogue (id → title, assetsVersion) from the lobby API
- `scene.py`, `zeus/build.mjs`, `zeus/template.html`, `zeus/to-anime.mjs`, `zeus/crop.py` — the inspector and anime.js converters
- `report/` — the teardown page source and figures
- `LEARNINGS.md` — what we learned, in one page
- `dl/` — every wad and asset fetched so far; `api/` — raw lobby API bodies from the captures; `gambino.dart.js` — the client bundle

- `PLAYABLE.md` — plan for making the composed lobby / in-game wrapper interactive (button runtime, signal wiring, glue, stubbed data)
