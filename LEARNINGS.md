# What we learned from Gambino Slots

Teardown of `game.onlinefungames.net` (Gambino Slots H5 client, Spiral Interactive), 2026-09-13.
Detail lives in `README.md`, the teardown page, and the Zeus 2 inspector:

- Teardown: https://claude.ai/code/artifact/d905a3ff-c95a-476b-94dc-ca1a3b8f55da
- Zeus 2 Scene Inspector: https://claude.ai/code/artifact/2020db08-2894-4436-a104-36cbf2778ade

## The stack

- Dart compiled to JS (`gambino.dart.js`, 25 MB) with an in-house engine, `syd`. One WebGL canvas,
  1920×1080 backing store. One shader program with `#ifdef` variants (texture, tint, two masks,
  hue/brightness, video). Canvas2D only for text rasterising and tints. No Pixi/Phaser/Flutter.
- Every visual asset is a plain public GET: a content-hashed map
  (`assets/en.<quality>.<VERSION_CODE>.map.json`) then `.wad.xml` packages per feature/game.
  Nothing encrypted or auth-gated; 403s are GCS "no such object".
- Game titles come from the backend (`getBatchInfo → game.getgameconfig`), not the map.
  209 titles, 239 game ids. Marketing scenes sit on a second CDN (`static.gambinoslot.com/MediaLibrary`).

## How the art is packaged

- Atlases: WebP with PNG fallback, TexturePacker-style frame sheets (`frame`, `sourceSize`,
  `spriteSourceSize`, nine-patch). Flipbooks are multi-frame sheets stepped by a `Frame` property
  at ~42 ms (24 fps).
- Symbol animations are video, not sprites: VP8 WebM, RGB on the left half, alpha matte on the
  right; the shader samples `uv + (0.5, 0)` for alpha. `.bik` ids betray the native-build origin.
- Bitmap fonts are glyph rects into the same atlases; text nodes pre-declare their glyph set
  (`0123456789.,KMB`) so the atlas carries only what the HUD needs.
- Masks are textures whose red channel multiplies alpha; the reel window is a white rectangle image.

## How a screen is assembled

- A screen is a JSON scene graph: `node / sprite / text / mask / videoSprite / particles2 /
  button / sound`, each with `Position / Origin / Scale / Skew / Color / DrawOrder / Hidden`.
  Transform = `T(Position) · S(Scale) · T(−Origin)`; children render ascending DrawOrder.
  Design space 1152×768 with overscanned backgrounds for wide screens. Reads like Flash/Animate
  exported to JSON.
- Layouts are skeletons with named hooks. `slot/scene` ships its reel grid empty —
  `icons_holder`, `slot_start_0..4`, `slot_end`, `anticipation_1_N`, `lines_holder`,
  `anim_icons_holder` — and Dart code finds those by `Id` and parents symbol scenes into them at
  runtime. All 209 games use the same hook names with different geometry
  (Zeus 2: 5×4 of 161×144; American Eagle: 5×4 of 196×127; Shamrock Luck: 5×3 of 191×174).
- Behaviour is data too. Nodes own hierarchical state machines (`default / anim / anticipation /
  hide …`, some `mode: Parallel`); transitions fire on string params (`SendSMEventAsync("anim")`);
  each state's `onEnter` is a timeline of `interpolate / discrete / sequence / parallel /
  reference` actions with cubic-bezier easing. A reel symbol's whole life — appear, pulse
  1.0→1.2→0.85, play its WebM, swap DrawOrder, settle — is ~180 actions of JSON and no per-symbol code.
- Export quirk: `stateMachine: k` points at a container in `states[]` (first leaf = initial
  state); `state.onEnter` indexes the owning node's `actions[]`; `reference.target` numbers nodes
  in an expanded post-order walk (shared nodes counted once per parent), `reference.action`
  indexes that node's `actions[]`. Resolved 100% of references in every scene tested.

## Transferable to gamby

- Separate layout (scene JSON with named hook points) from content (what gets parented in).
  That is how one engine ships 209 games.
- Atlases + a tiny frame-sheet format + bitmap fonts give a whole HUD from one texture.
  WebP with PNG fallback is a solved packaging choice.
- Side-by-side RGB|alpha video is a cheap route to rich symbol animation without WebM alpha
  support — one `drawImage` with `destination-in` (or a shader) does it.
- A data-driven state machine + action timelines is what makes "anticipation on reel 3",
  "big win popup", "idle pulse" designer-authored rather than programmer-authored — the seam a
  wheel/lottery UI would want.

## Caveats

- Two headless runs each created a guest user on Gambino's backend; nothing else was written.
- The art is Spiral Interactive's — study the format, don't ship the pixels.

## Tools in this folder

```
node assets.mjs games | list <gameId> | fetch <gameId> <wad>   # walk the public asset map
python3 scene.py find "<title>" | list <wad> | tree <wad> <scene> [depth] | sm <wad> <scene>
node zeus/build.mjs <gameId>       # pack a game's slot.wad.xml into the inspector page
```
