import { useEffect, useMemo, useRef, useState } from 'react';
import { parseWad, mergeWads, cdn, type Wad, type Scene } from './syd/wad';
import { buildScene, type Built } from './syd/dom';
import { listStates, roots, type StateInfo } from './syd/scene';
import { playState } from './syd/timeline';

type Entry = { kind: 'game' | 'lobby'; id: string; title: string; wads: string[]; thumb?: string; anim: number };

export default function App() {
  const [catalog, setCatalog] = useState<any>(null);
  const [map, setMap] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const [entry, setEntry] = useState<Entry | null>(null);
  const [wadName, setWadName] = useState<string>('');
  const [wad, setWad] = useState<Wad | null>(null);
  const [sceneId, setSceneId] = useState('');
  const [status, setStatus] = useState('');
  const [opts, setOpts] = useState({ initial: true, backdrop: true, reels: true, reveal: false, loop: true });
  const [playing, setPlaying] = useState<{ label: string; total: number; tracks: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const builtRef = useRef<Built | null>(null);
  const tlRef = useRef<any>(null);

  useEffect(() => { fetch('/catalog.json').then((r) => r.json()).then(setCatalog); fetch('/map.json').then((r) => r.json()).then(setMap); }, []);

  const entries = useMemo<Entry[]>(() => {
    if (!catalog) return [];
    const games = catalog.games.map((g: any) => ({ kind: 'game', id: g.id, title: g.title || `${g.id} (unlisted)`, wads: Object.keys(g.wads), thumb: `/thumbs/${g.id}.webp`, anim: g.animStates }));
    const lobby = catalog.lobby.map((l: any) => ({ kind: 'lobby', id: l.id, title: l.id, wads: Object.keys(l.wads), anim: l.animStates }));
    return [...games.sort((a: Entry, b: Entry) => a.title.localeCompare(b.title)), ...lobby];
  }, [catalog]);
  const shown = entries.filter((e) => !q || e.title.toLowerCase().includes(q.toLowerCase()) || e.id.includes(q));

  // load the wad(s) for an entry
  useEffect(() => {
    if (!entry || !Object.keys(map).length) return;
    let cancelled = false; setWad(null); setSceneId(''); setStatus('loading…');
    const keyOf = (w: string) => entry.kind === 'game' ? `assets/en/low/games/${entry.id}/${w}` : `assets/en/low/lobby_next_version/${w}`;
    const names = entry.kind === 'game' ? ['slot.wad.xml', 'slot_bg.wad.xml'].filter((w) => map[keyOf(w)]) : [wadName || entry.wads[0]];
    Promise.all(names.map((w) => fetch(cdn(map[keyOf(w)])).then((r) => { if (!r.ok) throw new Error(`${r.status} ${w}`); return r.text(); }).then(parseWad)))
      .then((ws) => { if (cancelled) return; const merged = mergeWads(...ws); setWad(merged); const ids = Object.keys(merged.scenes); const main = ['slot/scene_mobile.object', 'slot/scene.object'].find((k) => merged.scenes[k]) || ids.filter((k) => !k.startsWith('slot_bg/')).sort((a, b) => merged.scenes[b].nodes.length - merged.scenes[a].nodes.length)[0] || ids[0]; setSceneId(main || ''); setStatus(`${names.join(' + ')} · ${ids.length} scenes`); })
      .catch((e) => { if (!cancelled) setStatus('failed: ' + e.message); });
    return () => { cancelled = true; };
  }, [entry, wadName, map]);

  const scene: Scene | null = wad && sceneId ? wad.scenes[sceneId] : null;
  const states = useMemo(() => (scene ? listStates(scene) : []), [scene]);
  const animated = states.filter((s) => s.ms >= 40 && s.tweens > 0);

  // (re)build the DOM for the current scene
  useEffect(() => {
    const host = stageRef.current; if (!host) return;
    tlRef.current?.cancel(); tlRef.current = null; setPlaying(null);
    host.innerHTML = ''; builtRef.current = null;
    if (!wad || !scene) return;
    const isMain = /^slot\/scene/.test(sceneId);
    if (isMain && opts.backdrop) { const bg = ['slot_bg/scene.object', 'slot_bg/scene_mobile.object'].find((k) => wad.scenes[k]); if (bg) host.appendChild(buildScene(wad, wad.scenes[bg], { applyInitial: opts.initial }).root); }
    const b = buildScene(wad, scene, { applyInitial: opts.initial, reveal: opts.reveal });
    if (isMain && opts.reels) fillReels(wad, scene, b);
    if (sceneId.startsWith('icons/')) { b.root.style.transform = 'translate(300px, 200px) scale(3)'; }
    host.appendChild(b.root); builtRef.current = b;
  }, [wad, scene, sceneId, opts.backdrop, opts.initial, opts.reels, opts.reveal]);

  // fit the 1366×768 stage into the frame
  useEffect(() => {
    const fit = () => { const f = document.querySelector('.frame') as HTMLElement | null; const s = document.querySelector('.stage') as HTMLElement | null; if (f && s) s.style.transform = `scale(${f.clientWidth / 1366})`; };
    fit(); addEventListener('resize', fit); return () => removeEventListener('resize', fit);
  }, [wad]);

  const play = (st: StateInfo) => {
    if (!scene || !builtRef.current) return;
    tlRef.current?.cancel();
    const res = playState(scene, builtRef.current, st.action, st.owner, { loop: opts.loop && st.ms >= 40 });
    tlRef.current = res.tl; setPlaying({ label: `${st.id}${st.ownerId ? ' on #' + st.ownerId : ''}`, total: res.total, tracks: res.tracks });
  };
  const stop = () => { tlRef.current?.cancel(); tlRef.current = null; builtRef.current?.reset(); setPlaying(null); };

  const sceneGroups = wad ? groupScenes(Object.keys(wad.scenes)) : [];
  return (
    <div className="app">
      <header>
        <h1>Gambino Viewer<small>{entry ? `${entry.title} · ${entry.id}` : 'pick a game or feature'}</small></h1>
        {entry?.kind === 'lobby' && entry.wads.length > 1 && <select value={wadName || entry.wads[0]} onChange={(e) => setWadName(e.target.value)}>{entry.wads.map((w) => <option key={w} value={w}>{w}</option>)}</select>}
        {wad && <select value={sceneId} onChange={(e) => setSceneId(e.target.value)} aria-label="Scene">{sceneGroups.map(([g, ids]) => <optgroup key={g} label={g}>{ids.map((id) => <option key={id} value={id}>{id.replace(/\.object$/, '')}</option>)}</optgroup>)}</select>}
        {(['backdrop', 'initial', 'reels', 'reveal', 'loop'] as const).map((k) => <label key={k}><input type="checkbox" checked={opts[k]} onChange={(e) => setOpts({ ...opts, [k]: e.target.checked })} />{{ backdrop: 'slot_bg backdrop', initial: 'initial state', reels: 'populate reels', reveal: 'reveal hidden', loop: 'loop' }[k]}</label>)}
        <span className="mono" style={{ color: 'var(--muted)', marginLeft: 'auto' }}>{status}</span>
      </header>
      <aside>
        <div className="side-search"><input type="search" placeholder="Search 235 games + 102 features…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {(['game', 'lobby'] as const).map((kind) => <div key={kind}><div className="group">{kind === 'game' ? 'Games' : 'Lobby features'}</div>
          {shown.filter((e) => e.kind === kind).map((e) => <button key={e.kind + e.id} className={`item${entry?.id === e.id && entry.kind === e.kind ? ' sel' : ''}`} onClick={() => { setEntry(e); setWadName(''); }}>
            <div className="th" style={e.thumb ? { backgroundImage: `url(${e.thumb})` } : undefined} /><div><b>{e.title}</b><span>{e.id} · {e.anim} anim</span></div></button>)}
        </div>)}
      </aside>
      <main>
        <div className="frame"><div className="stage"><div className="design" ref={stageRef} /><div className="edge" style={{ left: 107 }} /><div className="edge" style={{ left: 107 + 1152 }} /></div></div>
        <div className="bar">
          {playing ? <><button className="b" onClick={stop}>■ stop</button><span className="mono">{playing.label} · {playing.tracks} tracks · {playing.total} ms{opts.loop ? ' · looping' : ''}</span></> : <span>Pick a state on the right. Design space is 1152 × 768 (dashed), shown at 16:9 like the browser canvas.</span>}
        </div>
      </main>
      <div className="right">
        {!scene ? <div className="empty">{entry ? status : 'Games load on demand: the first open of a game fetches its packages from Gambino\'s CDN through the local cache.'}</div> : <div className="pad">
          <h4>{animated.length} animated · {states.length - animated.length} instant</h4>
          {[...animated.sort((a, b) => b.ms - a.ms), ...states.filter((s) => !(s.ms >= 40 && s.tweens > 0))].map((s) => { const anim = s.ms >= 40 && s.tweens > 0; return <div key={s.index} className={`st${anim ? '' : ' instant'}`}>
            <button className="play" onClick={() => play(s)} title={anim ? 'play' : 'apply'}>{anim ? '▶' : '⚡'}</button>
            <div><b>{s.id}</b><small>{s.ownerId ? '#' + s.ownerId : 'node ' + s.owner}{s.enteredBy.length ? ' · ' + s.enteredBy.join(', ') : ''}</small></div>
            <span className="dur">{anim ? `${s.ms} ms · ${s.tweens}` : 'instant'}</span></div>; })}
        </div>}
      </div>
    </div>
  );
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
  const pool: { kind: 'scene'; id: string }[] | { kind: 'sprite'; name: string; w: number; h: number }[] = [];
  for (const [id, sc] of Object.entries(w.scenes)) {
    if (!/^icons\/icon_\d+\.object$/.test(id)) continue;
    const sp = sc.nodes.find((n) => n.type === 'sprite' && !n.properties?.Hidden && w.sprites[n.properties?.SpriteName]); if (!sp) continue;
    const ss = w.sprites[sp.properties!.SpriteName].frames[0].sourceSize; if (ss.w <= cell.w * 2.2 && ss.h <= cell.h * 2.2) (pool as any[]).push({ kind: 'scene', id });
  }
  if (pool.length < 4) for (const [name, sh] of Object.entries(w.sprites)) { if (!name.startsWith('icons/') || /tip|win|stb|scatter|flash|_000[1-9]\d/i.test(name)) continue; const ss = sh.frames[0].sourceSize; if (ss.w <= cell.w * 2 && ss.h <= cell.h * 2) (pool as any[]).push({ kind: 'sprite', name, w: ss.w, h: ss.h }); }
  if (!pool.length) return;
  starts.forEach((s, col) => { for (let row = 0; row < rows; row++) {
    const pick: any = pool[(row * 7 + col * 3) % pool.length]; const cellEl = document.createElement('div'); cellEl.className = 'nd'; cellEl.style.transform = `translateX(${s.properties!.Position?.x || 0}px) translateY(${row * cell.h}px)`; cellEl.style.zIndex = '50';
    if (pick.kind === 'scene') cellEl.appendChild(buildScene(w, w.scenes[pick.id]).root);
    else { const sh = w.sprites[pick.name]; const f = sh.frames[0]; const t = w.textures[sh.meta.image]; if (t) { const d = document.createElement('div'); d.className = 'spr'; d.style.cssText = `left:${(cell.w - pick.w) / 2}px;top:${(cell.h - pick.h) / 2}px;width:${f.frame.w}px;height:${f.frame.h}px;background-image:url(${cdn(t.webp || t.png!)});background-position:-${f.frame.x}px -${f.frame.y}px`; cellEl.appendChild(d); } }
    holder.appendChild(cellEl);
  } });
}
