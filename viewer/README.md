# Gambino Viewer

Loads any of the 235 games or 102 lobby features, builds the scene as DOM from its `.wad.xml`,
and plays any state's timeline with anime.js. Assets come through a local cache-on-demand
server, so nothing has to be downloaded up front.

```
cd viewer
npm install
npm run dev          # asset server on :8787 + Vite on :5173, opens the browser
```

- **Left**: search and pick a game or lobby feature (sort A–Z or by animation count).
- **Top**: Scene / Assets switch; *View options* for the `slot_bg` backdrop, initial-state
  resolution, populated reels, auto-entrance, x-ray (reveal hidden), looping.
- **Scene view**: the stage, a player (play/pause, scrub, stop), and a **Spin** button when the
  scene has a wheel node. Auto-entrance plays `show`/`default` once for scenes that paint nothing at rest.
- **Right tabs**: **Scenes** (grouped, with node/animation counts) · **States** (animated first with
  duration and tween count; ▶ plays from rest, **+** queues a sequence that plays without resetting —
  spin → sector → win) · **Tree** (layers panel: click to highlight on stage, untick to hide).
- **Assets view**: atlases with every sprite outlined (hover for name and rect), sprite tiles,
  symbol videos composited with their alpha (hover to play), sounds, bitmap fonts rendered.
- **Compose** (header dropdown, Scene view): *+ in-game wrapper* stacks the shared top bar
  (`lobby/Panels/Top`), bet bar (`games/common_next_version/bottom`) and indicator panel around
  the scene the way the client does; *Lobby* builds the lobby from `LobbyMain/sceneGames16x9`
  with the top bar parented into `TopPanelContainer`, tiles from the catalogue laid into
  `GamesScrollingArea`, and a rail widget. **The lobby** is also the first sidebar entry.
  `screenAlignment` nodes anchor a subtree's origin to a screen edge (Center/Bottom = bottom-centre).
- **Interactive**: buttons carry hit boxes from their `TouchArea` and run their `_hover / _down /
  _up` states and click sound as authored (`src/syd/runtime.ts` — state machines with param and
  signal transitions). Lobby tiles open the game in the wrapper; the top bar switches to game
  mode; Back returns to the lobby. Events show under the player. *View options → show hit boxes*.
- Deep links: the URL hash carries `#game:game154//slot/scene_mobile.object`.

`src/syd/` is the runtime: `wad.ts` (parser), `scene.ts` (initial state, expanded-order
references, timeline flattening), `dom.ts` (scene → divs, masks in luminance mode, bitmap text),
`video.ts` (RGB|alpha WebM compositing), `timeline.ts` (tracks → `createTimeline`).

`server.mjs`: `/cdn/<path>` serves from `../dl` or fetches once from Gambino's CDN and keeps it;
also `/catalog.json`, `/map.json`, `/thumbs`. `npm run build && npm run preview` serves the built client.

Not yet: chaining states the way the engine does (spin → sector → win), particles, rgb tint
beyond a brightness approximation, the lobby-only node types (`screenAlignment`, `tile`,
`multilineText`, `renderTarget`), an asset browser per game.
