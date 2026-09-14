import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { animate } from 'animejs';
import { parseWad, mergeWads, cdn, type Wad, type Scene } from './syd/wad';
import { buildScene, preloadTextures, SCREEN, type Built } from './syd/dom';
import { listStates, isAnimated, type StateInfo } from './syd/scene';
import { playState } from './syd/timeline';
import { Runtime } from './syd/runtime';
import Assets from './ui/Assets';
import Tree from './ui/Tree';
import { nodeBox, fmtMs } from './ui/util';

type Entry = { kind: 'game' | 'lobby'; id: string; title: string; wads: string[]; thumb?: string; anim: number; scenes: number };
type Tab = 'scenes' | 'states' | 'tree';
const K = { lobby: 'assets/en/low/lobby_next_version/lobby.wad.xml', lobbyMain: 'assets/en/low/lobby_next_version/LobbyMain.wad.xml', bottom: 'assets/en/low/games/common_next_version/bottom.wad.xml', indicator: 'assets/en/low/lobby_next_version/Panels/IndicatorPanel.wad.xml', ruby: 'assets/en/low/lobby_next_version/Features/RubyRush/RubyRushInLobby.wad.xml' };
const COMPOSE_KEYS = { none: [], ingame: [K.lobby, K.bottom, K.indicator], lobby: [K.lobby, K.lobbyMain, K.indicator, K.ruby] };
const isAnim = (s: StateInfo) => isAnimated(s.ms, s.tweens, s.steps);

export default function App() {
  const [catalog, setCatalog] = useState<any>(null);
  const [map, setMap] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'title' | 'anim'>('title');
  const [entry, setEntry] = useState<Entry | null>(null);
  const [wadName, setWadName] = useState('');
  const [wad, setWad] = useState<Wad | null>(null);
  const [sceneId, setSceneId] = useState('');
  const [status, setStatus] = useState('');
  const [loadNote, setLoadNote] = useState('');
  const [view, setView] = useState<'scene' | 'assets'>('scene');
  const [compose, setCompose] = useState<'none' | 'ingame' | 'lobby'>('none');
  const extraRef = useRef<Record<string, Wad>>({});
  const [extraTick, setExtraTick] = useState(0);
  const loadExtra = useCallback(async (keys: string[]) => {
    const missing = keys.filter((k) => !extraRef.current[k] && map[k]);
    if (!missing.length) return;
    await Promise.all(missing.map((k) => fetch(cdn(map[k])).then((r) => r.text()).then((x) => { extraRef.current[k] = parseWad(x); })));
    setExtraTick((t) => t + 1);
  }, [map]);
  const [tab, setTab] = useState<Tab>('states');
  const [opts, setOpts] = useState({ initial: true, backdrop: true, reels: true, reveal: false, loop: true, auto: true });
  const [playing, setPlaying] = useState<{ label: string; total: number; tracks: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [queue, setQueue] = useState<StateInfo[]>([]);
  const [hiddenNodes, setHiddenNodes] = useState<Set<number>>(new Set());
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const builtRef = useRef<Built | null>(null);
  const tlRef = useRef<any>(null);
  const runtimesRef = useRef<Runtime[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [showHits, setShowHits] = useState(false);
  const scaleRef = useRef(1);

  useEffect(() => { fetch('/catalog.json').then((r) => r.json()).then(setCatalog); fetch('/map.json').then((r) => r.json()).then(setMap); }, []);

  const entries = useMemo<Entry[]>(() => {
    if (!catalog) return [];
    const games = catalog.games.map((g: any) => ({ kind: 'game', id: g.id, title: g.title || `${g.id} (unlisted)`, wads: Object.keys(g.wads), thumb: `/thumbs/${g.id}.webp`, anim: g.animStates, scenes: g.scenes.length }));
    const lobby = catalog.lobby.map((l: any) => ({ kind: 'lobby', id: l.id, title: l.id, wads: Object.keys(l.wads), anim: l.animStates, scenes: l.scenes.length }));
    return [...games, ...lobby];
  }, [catalog]);
  const shown = useMemo(() => entries.filter((e) => !q || e.title.toLowerCase().includes(q.toLowerCase()) || e.id.includes(q)).sort((a, b) => sort === 'anim' ? b.anim - a.anim : a.title.localeCompare(b.title)), [entries, q, sort]);

  // deep links: #<kind>:<id>/<wad>/<scene>
  useEffect(() => {
    if (!entries.length) return;
    const apply = () => { const m = /^#(game|lobby):([^/]+)(?:\/([^/]*))?(?:\/(.+))?$/.exec(location.hash);
      if (m) { const e = entries.find((x) => x.kind === m[1] && x.id === decodeURIComponent(m[2])); if (e) { setEntry(e); setWadName(m[3] ? decodeURIComponent(m[3]) : ''); setSceneId(m[4] ? decodeURIComponent(m[4]) : ''); setView('scene'); } } };
    apply(); addEventListener('hashchange', apply); return () => removeEventListener('hashchange', apply);
  }, [entries]);
  useEffect(() => { if (entry) history.replaceState(null, '', `#${entry.kind}:${encodeURIComponent(entry.id)}/${encodeURIComponent(wadName)}/${encodeURIComponent(sceneId)}`); }, [entry, wadName, sceneId]);

  // load the wad(s) for an entry
  useEffect(() => {
    if (!entry || !Object.keys(map).length) return;
    let cancelled = false; setWad(null); setStatus('loading…'); setQueue([]); setHiddenNodes(new Set()); setSelectedNode(null);
    const keyOf = (w: string) => entry.kind === 'game' ? `assets/en/low/games/${entry.id}/${w}` : `assets/en/low/lobby_next_version/${w}`;
    const names = entry.kind === 'game' ? ['slot.wad.xml', 'slot_bg.wad.xml'].filter((w) => map[keyOf(w)]) : [wadName || entry.wads[0]];
    Promise.all(names.map((w) => fetch(cdn(map[keyOf(w)])).then((r) => { if (!r.ok) throw new Error(`${r.status} ${w}`); return r.text(); }).then(parseWad)))
      .then((ws) => { if (cancelled) return; const merged = mergeWads(...ws); setWad(merged); const ids = Object.keys(merged.scenes);
        setSceneId((cur) => merged.scenes[cur] ? cur : (['slot/scene_mobile.object', 'slot/scene.object'].find((k) => merged.scenes[k]) || ids.filter((k) => !k.startsWith('slot_bg/')).sort((a, b) => merged.scenes[b].nodes.length - merged.scenes[a].nodes.length)[0] || ids[0] || ''));
        setStatus(`${names.join(' + ')} · ${ids.length} scenes`); })
      .catch((e) => { if (!cancelled) setStatus('failed: ' + e.message); });
    return () => { cancelled = true; };
  }, [entry, wadName, map]);

  useEffect(() => { if (compose !== 'none') loadExtra(COMPOSE_KEYS[compose]); }, [compose, loadExtra]);
  const scene: Scene | null = wad && sceneId ? wad.scenes[sceneId] : null;
  const states = useMemo(() => (scene ? listStates(scene) : []), [scene]);
  const animated = useMemo(() => states.filter(isAnim).sort((a, b) => b.ms - a.ms), [states]);
  const instant = useMemo(() => states.filter((s) => !isAnim(s)), [states]);
  const wheelNode = useMemo(() => scene ? scene.nodes.findIndex((n) => /wheel/i.test(n.properties?.Id || '') && !/holder|shadow|anim|btn|button/i.test(n.properties?.Id || '')) : -1, [scene]);

  const stop = useCallback(() => { tlRef.current?.cancel(); tlRef.current = null; builtRef.current?.reset(); setPlaying(null); setPaused(false); setProgress(0); }, []);
  const play = useCallback((st: StateInfo, o: { reset?: boolean; loop?: boolean; onComplete?: () => void } = {}) => {
    if (!scene || !builtRef.current) return;
    tlRef.current?.cancel();
    const res = playState(scene, builtRef.current, st.action, st.owner, { loop: o.loop ?? (opts.loop && isAnim(st)), reset: o.reset, onComplete: o.onComplete });
    tlRef.current = res.tl; setPaused(false); setPlaying({ label: `${st.id}${st.ownerId ? ' on #' + st.ownerId : ''}${o.loop === false ? ' · once' : ''}`, total: res.total, tracks: res.tracks });
    if (!isAnim(st)) setPlaying({ label: `${st.id}${st.ownerId ? ' on #' + st.ownerId : ''} · instant, values applied`, total: 0, tracks: res.tracks });
  }, [scene, opts.loop]);
  const playQueue = useCallback((list: StateInfo[]) => {
    if (!list.length) return; builtRef.current?.reset();
    const step = (i: number) => { if (i >= list.length) { setPlaying(null); return; } play(list[i], { reset: false, loop: false, onComplete: () => step(i + 1) }); if (!isAnim(list[i])) step(i + 1); };
    step(0);
  }, [play]);

  const openGame = useCallback((id: string) => { const e = entries.find((x) => x.kind === 'game' && x.id === id); if (!e) return; setEntry(e); setWadName(''); setSceneId(''); setView('scene'); setCompose('ingame'); setEvents((l) => [...l, `open ${e.title}`]); }, [entries]);
  const openLobby = useCallback(() => { const e = entries.find((x) => x.kind === 'lobby' && x.id === 'LobbyMain'); if (!e) return; setEntry(e); setWadName(''); setSceneId('LobbyMain/sceneGames16x9.object'); setView('scene'); setCompose('lobby'); }, [entries]);
  // the hand-written glue: what a click means. Everything else just animates as authored.
  const onButton = (layer: string, id: string | null, node: number) => {
    if (id === 'BackBtn' || id === 'backHHRBtn' || id === 'HomeBtn') openLobby();
  };
  // (re)build the DOM for the current scene
  useEffect(() => {
    let cleanup = () => {};
    const host = stageRef.current; if (!host) return;
    tlRef.current?.cancel(); tlRef.current = null; setPlaying(null); setPaused(false); setBox(null);
    host.innerHTML = ''; builtRef.current = null;
    if (!wad || !scene) return;
    const isMain = /^slot\/scene/.test(sceneId);
    if (isMain && opts.backdrop) { const bg = ['slot_bg/scene.object', 'slot_bg/scene_mobile.object'].find((k) => wad.scenes[k]); if (bg) host.appendChild(buildScene(wad, wad.scenes[bg], { applyInitial: opts.initial }).root); }
    const b = buildScene(wad, scene, { applyInitial: opts.initial, reveal: opts.reveal });
    if (isMain && opts.reels) fillReels(wad, scene, b);
    if (sceneId.startsWith('icons/')) b.root.style.transform = 'translate(300px, 200px) scale(3)';
    for (const i of hiddenNodes) if (b.els[i]) b.els[i].style.display = 'none';
    host.appendChild(b.root); builtRef.current = b;
    // wrappers: the packages the client stacks around a scene
    runtimesRef.current.forEach((rt) => rt.dispose()); runtimesRef.current = [];
    const wire = (w: Wad, sc: Scene, bb: Built, name: string) => { const rt = new Runtime(sc, bb, w, name); rt.on((ev) => { if (ev.kind === 'click') onButton(name, ev.id, ev.node); if (ev.kind === 'click' || (ev.kind === 'enter' && ev.state && !/^_/.test(ev.state))) setEvents((l) => [...l.slice(-60), `${name} ${ev.id ? '#' + ev.id : '[' + ev.node + ']'} ${ev.kind === 'click' ? 'click' : '→ ' + ev.state}`]); }); runtimesRef.current.push(rt); return rt; };
    wire(wad, scene, b, sceneId.replace(/\.object$/, ''));
    (window as any).__rt = runtimesRef.current; // for probing from the console
    const X = extraRef.current; const layer = (w: Wad | undefined, id: string, z: number, dx = 0, dy = 0, into?: HTMLElement) => { if (!w?.scenes[id]) return null; const bb = buildScene(w, w.scenes[id], { applyInitial: opts.initial }); bb.root.style.zIndex = String(z); if (dx || dy) bb.root.style.transform = `translate(${dx}px, ${dy}px)`; (into || host).appendChild(bb.root); wire(w, w.scenes[id], bb, id.split('/').slice(-2).join('/').replace(/\.object$/, '')); return bb; };
    if (compose === 'ingame' && !sceneId.startsWith('icons/')) {
      layer(X[K.bottom], 'bottom/scene16x9.object', 900);
      const topB = layer(X[K.lobby], 'lobby/Panels/Top/scene16x9.object', 910, 0, 0); // measured against the live client: the bar is authored at the design-box origin
      if (topB) { const topRt = runtimesRef.current[runtimesRef.current.length - 1]; // the params the client sends when a game opens
        const byId = (id: string) => topRt.scene.nodes.findIndex((n) => n.properties?.Id === id);
        setTimeout(() => { for (const [id, param] of [['TopPanelMode', 'game'], ['LeftBtnStates', 'btn_back']]) { const n = byId(id); if (n >= 0) topRt.send(n, param); } }, 0); }
      layer(X[K.indicator], 'IndicatorPanel/scene16x9.object', 905);
    }
    if (compose === 'lobby') {
      host.innerHTML = ''; builtRef.current = null;
      layer(X[K.lobby], 'lobby_bg/scene.object', 1);
      const grid = layer(X[K.lobbyMain], 'LobbyMain/sceneGames16x9.object', 10);
      layer(X[K.lobby], 'lobby/Panels/Top/scene16x9.object', 910, 0, 0); // design-box origin, above the grid
      const area = grid?.els.find((e) => e?.dataset.id === 'GamesScrollingArea');
      if (area && catalog) { area.style.zIndex = '20';
        // the scroll area's masks are sized by the client at runtime; lift them so the tiles paint
        for (let p: HTMLElement | null = area; p && !p.classList.contains('scene'); p = p.parentElement) if (p.classList.contains('mask')) { p.style.maskImage = 'none'; (p.style as any).webkitMaskImage = 'none'; p.style.width = '0'; p.style.height = '0'; }
        // tiles are laid out by code in the client; use the catalogue's lobby games
        const games = catalog.games.filter((g: any) => g.title).sort((a: any, b: any) => (a.level ?? 99) - (b.level ?? 99) || a.title.localeCompare(b.title));
        const T = 196, G = 19; // measured from the live lobby: ~196 px tiles on a 215 px pitch, two rows
        games.forEach((g: any, i: number) => { const col = Math.floor(i / 2), row = i % 2; const d = document.createElement('div'); d.className = 'tile-lobby'; d.style.cssText = `position:absolute;left:${-26 + col * (T + G)}px;top:${row * (T + G)}px;width:${T}px;height:${T}px;background:url(/thumbs/${g.id}.webp) center/cover;border-radius:14px;box-shadow:0 4px 12px rgba(0,0,0,.5)`; d.title = g.title; d.addEventListener('click', () => openGame(g.id)); area.appendChild(d); });
      }
      layer(X[K.indicator], 'IndicatorPanel/scene16x9.object', 905);
      const rail = grid?.els.find((e) => e?.dataset.id === 'IndicatorScrollingArea'); if (rail) rail.style.zIndex = '21';
      const ruby = layer(X[K.ruby], 'Features/RubyRush/RubyRushInLobby/sceneLobbyBanner.object', 906, 0, 150, rail || undefined); // left-rail widget slot
      if (ruby) ruby.root.style.transform += ' scale(0.55)'; // the promo banner variant; the rail shows the compact widget
      if (grid) builtRef.current = grid;
    }
    // auto-entrance: a scene with a `show` entrance, or one that paints nothing at rest, plays its
    // entrance once — after its textures have decoded, so the reveal is not spent on empty sprites
    if (opts.auto && !opts.reveal) {
      const st = listStates(scene).filter(isAnim);
      const pick = st.find((s) => s.id === 'show') || (b.visibleLeaves() === 0 ? (st.find((s) => s.id === 'default') || [...st].sort((a, c) => c.tweens - a.tweens)[0]) : undefined);
      if (pick) { setLoadNote('decoding art…'); let live = true; cleanup = () => { live = false; };
        preloadTextures(wad, scene).then(() => { if (live && builtRef.current === b) { setLoadNote(''); play(pick, { loop: false }); } }); }
    }
    return () => cleanup();
  }, [wad, scene, sceneId, view, compose, extraTick, opts.backdrop, opts.initial, opts.reels, opts.reveal, opts.auto]);

  // hide toggles from the tree apply live
  useEffect(() => { const b = builtRef.current; if (!b || !scene) return; b.els.forEach((el, i) => { if (!el) return; const wantHidden = hiddenNodes.has(i); if (wantHidden) el.style.display = 'none'; else if (el.style.display === 'none' && !(opts.initial ? (scene.nodes[i].properties?.Hidden && !b.init[i]?.hasOwnProperty('Hidden')) || b.init[i]?.Hidden : scene.nodes[i].properties?.Hidden)) el.style.display = ''; }); }, [hiddenNodes]);
  // highlight box for the selected node
  useEffect(() => { const b = builtRef.current, st = stageRef.current; if (selectedNode == null || !b || !st) { setBox(null); return; } setBox(nodeBox(b, selectedNode, st, scaleRef.current)); }, [selectedNode, playing, sceneId]);

  // fit the 1366×768 stage into the frame
  useEffect(() => {
    const fit = () => { const f = frameRef.current; const s = f?.querySelector('.stage') as HTMLElement | null; if (f && s) { scaleRef.current = f.clientWidth / 1366; s.style.transform = `scale(${scaleRef.current})`; } };
    fit(); addEventListener('resize', fit); return () => removeEventListener('resize', fit);
  }, [wad, view]);
  // progress readout
  useEffect(() => { let raf = 0; const tick = () => { const tl = tlRef.current; if (tl && playing?.total) setProgress(Math.min(1, (tl.currentTime || 0) / (tl.duration || 1))); raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf); }, [playing]);

  const spin = () => { const el = builtRef.current?.els[wheelNode]; if (!el) return; const cur = +(/rotate\(([-\d.]+)deg\)/.exec(el.style.transform)?.[1] || 0); animate(el, { rotate: cur + 1440 + Math.floor(Math.random() * 16) * 22.5, duration: 4200, ease: 'outCubic' }); };
  const sceneGroups = wad ? groupScenes(Object.keys(wad.scenes)) : [];
  const cat = entry && catalog ? (entry.kind === 'game' ? catalog.games.find((g: any) => g.id === entry.id) : catalog.lobby.find((l: any) => l.id === entry.id)) : null;
  const sceneMeta = (id: string) => cat?.scenes.find((s: any) => s.id === id);

  return (
    <div className={`app${showHits ? ' hits' : ''}`}>
      <header>
        <h1>Gambino Viewer</h1>
        {entry && <div className="crumb"><b>{entry.title}</b><span>{entry.id}{status ? ' · ' + status : ''}{loadNote ? ' · ' + loadNote : ''}</span></div>}
        {entry?.kind === 'lobby' && entry.wads.length > 1 && <select value={wadName || entry.wads[0]} onChange={(e) => { setWadName(e.target.value); setSceneId(''); }}>{entry.wads.map((w) => <option key={w} value={w}>{w}</option>)}</select>}
        {wad && <div className="seg"><button className={view === 'scene' ? 'on' : ''} onClick={() => setView('scene')}>Scene</button><button className={view === 'assets' ? 'on' : ''} onClick={() => setView('assets')}>Assets</button></div>}
        {wad && view === 'scene' && <select value={compose} onChange={(e) => setCompose(e.target.value as any)} aria-label="Compose" title="Stack the shared wrapper packages around the scene, the way the client does"><option value="none">Scene only</option><option value="ingame">+ in-game wrapper (top bar, bet bar, side panel)</option><option value="lobby">Lobby (grid + top bar + rail)</option></select>}
        <details className="menu"><summary>View options</summary><div>
          {([['backdrop', 'slot_bg backdrop', 'Draw the separate background package under machine scenes'], ['initial', 'apply initial state', 'Settle every node into its state machine\'s first state before drawing'], ['reels', 'populate reels', 'Fill the empty reel grid with the game\'s own symbols'], ['auto', 'auto-entrance', 'If a scene paints nothing at rest, play its show/default state once'], ['reveal', 'reveal hidden (x-ray)', 'Ignore Hidden and alpha 0 — every layer at once, including alternatives'], ['loop', 'loop playback', '']] as const).map(([k, l, t]) => <label key={k} title={t}><input type="checkbox" checked={opts[k]} onChange={(e) => setOpts({ ...opts, [k]: e.target.checked })} />{l}</label>)}
        </div></details>
      </header>

      <aside>
        <div className="side-search"><input type="search" placeholder={`Search ${entries.filter((e) => e.kind === 'game').length} games, ${entries.filter((e) => e.kind === 'lobby').length} features…`} value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={sort} onChange={(e) => setSort(e.target.value as any)} aria-label="Sort"><option value="title">A–Z</option><option value="anim">most animated</option></select></div>
        <button className={`item lobby-entry${compose === 'lobby' ? ' sel' : ''}`} onClick={() => { const e = entries.find((x) => x.kind === 'lobby' && x.id === 'LobbyMain'); if (e) { setEntry(e); setWadName(''); setSceneId('LobbyMain/sceneGames16x9.object'); setView('scene'); setCompose('lobby'); } }}>
          <div className="th" style={{ background: 'linear-gradient(135deg,#5b1a8a,#c2258f)' }} /><div><b>The lobby</b><span>composed: grid · top bar · rail · dock</span></div></button>
        {(['game', 'lobby'] as const).map((kind) => { const list = shown.filter((e) => e.kind === kind); return !list.length ? null : <div key={kind}><div className="group">{kind === 'game' ? 'Games' : 'Lobby features'} · {list.length}</div>
          {list.map((e) => <button key={e.kind + e.id} className={`item${entry?.id === e.id && entry.kind === e.kind ? ' sel' : ''}`} onClick={() => { setEntry(e); setWadName(''); setSceneId(''); setView('scene'); if (compose === 'lobby') setCompose(e.kind === 'game' ? 'ingame' : 'none'); }}>
            <div className="th" style={e.thumb ? { backgroundImage: `url(${e.thumb})` } : undefined} /><div><b>{e.title}</b><span>{e.id} · {e.scenes} scenes · {e.anim} anim</span></div></button>)}
        </div>; })}
      </aside>

      <main>
        {!entry && <div className="hello"><h2>Pick a game or lobby feature</h2><p>Games load on first open through the local cache. Then: <b>Scenes</b> to choose a screen, <b>States</b> to play its animations, <b>Tree</b> to peel layers, <b>Assets</b> for the raw art.</p></div>}
        {entry && view === 'assets' && (wad ? <Assets wad={wad} /> : <div className="hello">{status}</div>)}
        {entry && view === 'scene' && <>
          <div className="frame" ref={frameRef}><div className="stage"><div className="design" ref={stageRef} /><div className="edge" style={{ left: 107 }} /><div className="edge" style={{ left: 107 + 1152 }} />
            {box && <div className="hl" style={{ left: 107 + box.x, top: box.y, width: box.w, height: box.h }} />}</div>
            {!wad && <div className="loading">{status}</div>}</div>
          <div className="player">
            <button className="b" onClick={() => { if (!tlRef.current) return; paused ? tlRef.current.play() : tlRef.current.pause(); setPaused(!paused); }} disabled={!playing || !playing.total}>{paused ? '▶' : '❚❚'}</button>
            <button className="b" onClick={stop} disabled={!playing}>■</button>
            <input type="range" min={0} max={1000} value={Math.round(progress * 1000)} disabled={!playing?.total} onChange={(e) => { const tl = tlRef.current; if (!tl) return; tl.pause(); setPaused(true); tl.seek((+e.target.value / 1000) * tl.duration); }} aria-label="scrub" />
            <span className="mono">{playing ? `${playing.label} · ${playing.tracks} tracks · ${fmtMs(playing.total)}${opts.loop && playing.total && !playing.label.endsWith('once') ? ' · loop' : ''}` : (scene ? `${sceneId.replace(/\.object$/, '')} · ${scene.nodes.length} nodes · ${animated.length} animated states` : '')}</span>
            {wheelNode >= 0 && <button className="b gold" onClick={spin} title="rotate the wheel node the way the engine's code does">Spin</button>}
          </div>
          <div className="events">{events.length ? events.slice(-8).map((e, i) => <div key={i}><b>{e.split(' ')[0]}</b>{e.slice(e.indexOf(' '))}</div>) : 'Buttons react as authored — hover, press, release, click sound. Tiles open the game; Back returns to the lobby. Events show here.'}</div>
        </>}
      </main>

      <div className="right">
        <div className="tabs">{(['scenes', 'states', 'tree'] as Tab[]).map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
        {!scene ? <div className="empty">{entry ? status : 'Nothing loaded yet.'}</div> : <>
          {tab === 'scenes' && <div className="scenes">{sceneGroups.map(([g, ids]) => <div key={g}><div className="group">{g}</div>{ids.map((id) => { const m = sceneMeta(id); return <button key={id} className={`srow${id === sceneId ? ' sel' : ''}`} onClick={() => { setSceneId(id); setView('scene'); }}><b>{id.replace(/\.object$/, '')}</b><span>{m ? `${m.nodes} nodes · ${m.anims.length} anim` : ''}</span></button>; })}</div>)}</div>}
          {tab === 'states' && <div className="states">
            <div className="seqbar">{queue.length ? <><span>Sequence: {queue.map((s) => s.id).join(' → ')}</span><button className="b gold" onClick={() => playQueue(queue)}>▶ play</button><button className="b" onClick={() => setQueue([])}>clear</button></> : <span className="hint">▶ plays a state from rest. <b>+</b> queues states to play in order without resetting (spin → sector → win).</span>}</div>
            <div className="group">{animated.length} animated</div>
            {animated.map((s) => <StateRow key={s.index} s={s} anim onPlay={() => play(s)} onQueue={() => setQueue([...queue, s])} />)}
            <div className="group">{instant.length} instant switches</div>
            {instant.map((s) => <StateRow key={s.index} s={s} anim={false} onPlay={() => play(s)} onQueue={() => setQueue([...queue, s])} />)}
          </div>}
          {tab === 'tree' && <Tree scene={scene} hidden={hiddenNodes} onToggle={(i) => { const n = new Set(hiddenNodes); n.has(i) ? n.delete(i) : n.add(i); setHiddenNodes(n); }} selected={selectedNode} onSelect={setSelectedNode} />}
        </>}
      </div>
    </div>
  );
}

function StateRow({ s, anim, onPlay, onQueue }: { s: StateInfo; anim: boolean; onPlay: () => void; onQueue: () => void }) {
  return <div className={`st${anim ? '' : ' instant'}`}>
    <button className="play" onClick={onPlay} title={anim ? 'play from rest' : 'apply'}>{anim ? '▶' : '⚡'}</button>
    <div><b>{s.id}</b><small>{s.ownerId ? '#' + s.ownerId : 'node ' + s.owner}{s.enteredBy.length ? ' · via ' + s.enteredBy.slice(0, 4).join(', ') + (s.enteredBy.length > 4 ? '…' : '') : ''}</small></div>
    <span className="dur">{anim ? `${fmtMs(s.ms)} · ${s.tweens ? s.tweens + ' tw' : s.steps + ' steps'}` : 'instant'}</span>
    <button className="plus" onClick={onQueue} title="add to sequence">+</button>
  </div>;
}

function groupScenes(ids: string[]): [string, string[]][] {
  const g: Record<string, string[]> = {};
  for (const id of ids) { const k = /^slot\/scene/.test(id) ? 'Machine' : id.startsWith('slot_bg/') ? 'Backdrop' : id.startsWith('icons/') ? 'Reel symbols' : id.startsWith('slot/popups/') ? 'Popups' : /^slot\/(jackpot|paytable)\//.test(id) ? 'Panels' : 'Scenes'; (g[k] ||= []).push(id); }
  const order = ['Machine', 'Panels', 'Popups', 'Scenes', 'Reel symbols', 'Backdrop'];
  return order.filter((k) => g[k]).map((k) => [k, g[k].sort((a, b) => (+(a.match(/\d+/) || [0])[0]) - (+(b.match(/\d+/) || [0])[0]) || a.localeCompare(b))]);
}

// The wad ships the reel grid empty; the engine parents symbols into it. Fill it from whatever
// the game provides: per-symbol scenes with a static sprite, else icons/*.spr centred in the cell.
function fillReels(w: Wad, r: Scene, b: Built) {
  const holderIdx = r.nodes.findIndex((n) => n.properties?.Id === 'icons_holder'); if (holderIdx < 0) return;
  const holder = b.els[holderIdx]; if (!holder) return;
  const kids = (r.nodes[holderIdx].children || []).map((k) => r.nodes[k]);
  const starts = kids.filter((k) => /^slot_start_\d$/.test(k.properties?.Id || '')).sort((a, c) => (a.properties!.Position?.x || 0) - (c.properties!.Position?.x || 0));
  const end = kids.find((k) => k.properties?.Id === 'slot_end'); if (!starts.length || !end) return;
  const cell = starts[0].properties!.Size; const rows = Math.round((end.properties!.Position?.y || 0) / cell.h) + 1;
  const pool: any[] = [];
  for (const [id, sc] of Object.entries(w.scenes)) {
    if (!/^icons\/icon_\d+\.object$/.test(id)) continue;
    const sp = sc.nodes.find((n) => n.type === 'sprite' && !n.properties?.Hidden && w.sprites[n.properties?.SpriteName]); if (!sp) continue;
    const ss = w.sprites[sp.properties!.SpriteName].frames[0].sourceSize; if (ss.w <= cell.w * 2.2 && ss.h <= cell.h * 2.2) pool.push({ kind: 'scene', id });
  }
  if (pool.length < 4) for (const [name, sh] of Object.entries(w.sprites)) { if (!name.startsWith('icons/') || /tip|win|stb|scatter|flash|_000[1-9]\d/i.test(name)) continue; const ss = sh.frames[0].sourceSize; if (ss.w <= cell.w * 2 && ss.h <= cell.h * 2) pool.push({ kind: 'sprite', name, w: ss.w, h: ss.h }); }
  if (!pool.length) return;
  starts.forEach((s, col) => { for (let row = 0; row < rows; row++) {
    const pick = pool[(row * 7 + col * 3) % pool.length]; const cellEl = document.createElement('div'); cellEl.className = 'nd'; cellEl.style.transform = `translateX(${s.properties!.Position?.x || 0}px) translateY(${row * cell.h}px)`; cellEl.style.zIndex = '50';
    if (pick.kind === 'scene') cellEl.appendChild(buildScene(w, w.scenes[pick.id]).root);
    else { const sh = w.sprites[pick.name]; const f = sh.frames[0]; const t = w.textures[sh.meta.image]; if (t) { const d = document.createElement('div'); d.className = 'spr'; d.style.cssText = `left:${(cell.w - pick.w) / 2}px;top:${(cell.h - pick.h) / 2}px;width:${f.frame.w}px;height:${f.frame.h}px;background-image:url(${cdn(t.webp || t.png!)});background-position:-${f.frame.x}px -${f.frame.y}px`; cellEl.appendChild(d); } }
    holder.appendChild(cellEl);
  } });
}
