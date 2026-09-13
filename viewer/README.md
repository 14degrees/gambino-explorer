# Gambino Viewer

Loads any of the 235 games or 102 lobby features, builds the scene as DOM from its `.wad.xml`,
and plays any state's timeline with anime.js. Assets come through a local cache-on-demand
server, so nothing has to be downloaded up front.

```
cd viewer
npm install
npm run dev          # asset server on :8787 + Vite on :5173, opens the browser
```

- **Left**: search and pick a game or lobby feature (thumbnails from the catalogue).
- **Top**: scene dropdown (Machine / Panels / Popups / Reel symbols / Backdrop), toggles for
  the `slot_bg` backdrop, initial-state resolution, populated reels, revealing hidden nodes, looping.
- **Right**: every state of the scene; animated ones first (▶, duration and tween count),
  instant switches after (⚡). Click to play on the stage.

`src/syd/` is the runtime: `wad.ts` (parser), `scene.ts` (initial state, expanded-order
references, timeline flattening), `dom.ts` (scene → divs, masks in luminance mode, bitmap text),
`video.ts` (RGB|alpha WebM compositing), `timeline.ts` (tracks → `createTimeline`).

`server.mjs`: `/cdn/<path>` serves from `../dl` or fetches once from Gambino's CDN and keeps it;
also `/catalog.json`, `/map.json`, `/thumbs`. `npm run build && npm run preview` serves the built client.

Not yet: chaining states the way the engine does (spin → sector → win), particles, rgb tint
beyond a brightness approximation, the lobby-only node types (`screenAlignment`, `tile`,
`multilineText`, `renderTarget`), an asset browser per game.
