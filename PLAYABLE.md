# Making the composed lobby playable

How to turn the viewer's composed lobby and in-game wrapper into something you can click
around like the real client — and what that is worth for gamby.

## What the data already gives you (the feel of interaction)

- `button` nodes with `_up / _down / _hover / dis` states and `click_sound_play`. The lobby
  grid (`LobbyMain/sceneGames16x9`) has 15, the top bar (`lobby/Panels/Top/scene16x9`) 17,
  the bet bar (`games/common_next_version/bottom/scene16x9`) 11 plus a `checkbox`.
  `TouchArea` on a node is its hit box.
- State machines with transitions keyed on **string params** (`SendSMEventAsync("spin")`)
  and on **signals**: a scene's `signalEvents` list `{source, signal: "StateChanged", target}`
  — when node `source` changes state, node `target` hears it — and `rules` of type `signal`
  react to it. That is how a button press lights a tooltip or flips a panel mode with no code.
- Timelines for everything visual (already played by the viewer).

## What it does not give you (the meaning of a click)

- What a click does: open this game, deduct coins, start a spin, show the shop. That is Dart glue.
- Outcomes and numbers: reel results, balances, prices, jackpot values — server responses.
- Reel motion and the wheel spin — code-driven in the client, same as we stubbed for the wheel.

## Plan — three layers, in this order

### 1. Interaction runtime (generic, one sitting) — DONE, `viewer/src/syd/runtime.ts`

In `viewer/src/syd/`:

- Hit-test `button` nodes on the stage (their `TouchArea`, else the union of their painted
  descendants). On pointer enter / down / up, send `_hover` / `_down` / `_up` to the button's
  own machine so it animates and clicks exactly as authored.
- Keep a **current state per machine** (initial = first leaf, as now).
- `send(node, param)`: find a transition on the current state whose `param` rule matches →
  enter the target state → play its `onEnter` timeline (reset: false, so pose accumulates) →
  emit `StateChanged` → deliver through `signalEvents` → evaluate `signal` rules on the
  targets. Parallel machines (`mode: "Parallel"`) advance their children independently.
- Log every event a click would send (`node #BuyBtn → "_up"` …) so we can see the graph fire.

Result: the composed lobby and bet bar respond to the mouse — buttons depress, tooltips open,
panels switch modes — with zero hand-written behaviour.

### 2. Glue for the flows that matter (hand-written, small) — tile → game and Back → lobby done; rest open

- Tile click → load that game in the in-game wrapper (both halves exist already).
- BUY → `send(shopPopup, "show")` (the popup scenes are in `PaymentPage.wad.xml` / `popups.wad.xml`).
- Back / home → the lobby.
- SPIN → a fake spin: scroll the symbol cells in `icons_holder` for ~2 s, stop on random
  symbols, play their `anim` states on a random win line, tick the coin counter (the balance
  is a bitmap-text node — set its `Text`). Maybe 6–8 handlers in total.

### 3. Stubbed data

Balances, prices, jackpot values, level, timers from a small local JSON so every screen fills in.

## Two honest notes

- The result is a fan replica of their client. Fine to study on this machine; not something to
  put online — the art is Spiral Interactive's.
- For gamby the payoff is **layer 1**: a state-machine-plus-timeline runtime where designers
  author states and code only sends events. That is exactly the shape the gamby wheel and
  jackpot reveal want, with our own art.

## What the data turned out to mean (found while building layer 1)

- Every button has a **self-signal** (`signalEvents` entry with source = target = the button)
  carrying the engine's touch value: 0 up, 1 down, 2 hover. Its `_up/_down/_hover` states
  transition on `signal` rules with those values. All `signalEvents` in these scenes are
  self-signals — there are no authored cross-node reactions; that is always code.
- A state's `targets[i]` is an index into its **container's `children`**, not a global state index.
- `TouchArea` is a top-left box `{x, y, w, h}` from the node origin; buttons without one hit on
  their sprites.
- `click_sound_play` / `click_sound_default` are sent by code around a click; `dis`, `activate`,
  `lock_*`, `hide` are code-sent params too.
- The top bar is authored at the design-box origin (measured against the live client), and the
  client sends it `TopPanelMode → "game"` and `LeftBtnStates → "btn_back"` when a game opens.
