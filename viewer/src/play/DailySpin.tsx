// The Daily Free Spin, playable. Every visual and every state is Gambino's data; this file is
// the glue the client's Dart code provides: what a click means, where the wheel stops, what
// the numbers are. Open → idle lights → SPIN → lights race, wheel spins, lands → slice
// highlight → Congratulations → COLLECT → reset.
import { useEffect, useRef, useState } from 'react';
import { animate } from 'animejs';
import { parseWad, cdn, type Wad } from '../syd/wad';
import { buildScene, preloadTextures, type Built } from '../syd/dom';
import { Runtime } from '../syd/runtime';

const WAD = 'assets/en/low/lobby_next_version/BonusWheel.wad.xml', LOBBY = 'assets/en/low/lobby_next_version/lobby.wad.xml';
const SHELL = 'lobby/BonusWheel/scene16x9.object', WHEEL = 'lobby/BonusWheel/sceneFreeWheel.object', WIN = 'lobby/BonusWheel/sceneWinPopup.object';
// slice values clockwise from the pointer, as in the live game; slice 0 is the MEGA WHEEL prize
const VALUES = [0, 5940, 12100, 8910, 9900, 6930, 15400, 8910, 29700, 9900, 6930, 7920, 6930, 7920, 13200, 5940];
const short = (n: number) => n >= 10000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : n.toLocaleString('en-US');
const fmt = (n: number) => n.toLocaleString('en-US');

export default function DailySpin() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('loading the Bonus Wheel package…');
  const [log, setLog] = useState<string[]>([]);
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'landed' | 'won'>('idle');
  const world = useRef<{ wad: Wad; shell: Built; wheel: Built; win: Built; rShell: Runtime; rWheel: Runtime; rWin: Runtime; turns: number } | null>(null);
  const say = (s: string) => setLog((l) => [...l.slice(-5), s]);

  useEffect(() => {
    let dead = false;
    (async () => {
      const map = await fetch('/map.json').then((r) => r.json());
      const wad = parseWad(await fetch(cdn(map[WAD])).then((r) => r.text()));
      setStatus('decoding art…');
      await Promise.all([SHELL, WHEEL, WIN].map((id) => preloadTextures(wad, wad.scenes[id])));
      if (dead || !stageRef.current) return;
      const host = stageRef.current; host.innerHTML = '';
      try { const lob = parseWad(await fetch(cdn(map[LOBBY])).then((r) => r.text())); const bg = buildScene(lob, lob.scenes['lobby_bg/scene.object']); bg.root.style.zIndex = '1'; host.appendChild(bg.root); } catch {}
      const shell = buildScene(wad, wad.scenes[SHELL]); shell.root.style.zIndex = '10'; host.appendChild(shell.root);
      const wheel = buildScene(wad, wad.scenes[WHEEL]); wheel.root.style.zIndex = '20'; wheel.root.style.transform = 'translate(321px, 127px)'; host.appendChild(wheel.root);
      const win = buildScene(wad, wad.scenes[WIN]); win.root.style.zIndex = '30'; host.appendChild(win.root);
      const rShell = new Runtime(wad.scenes[SHELL], shell, wad, 'shell', { playInitial: true }), rWheel = new Runtime(wad.scenes[WHEEL], wheel, wad, 'wheel', { playInitial: true }), rWin = new Runtime(wad.scenes[WIN], win, wad, 'win');
      world.current = { wad, shell, wheel, win, rShell, rWheel, rWin, turns: 0 }; (window as any).__play = world.current;
      const id = (rt: Runtime, name: string) => rt.scene.nodes.findIndex((n) => n.properties?.Id === name);
      const idAll = (rt: Runtime, re: RegExp) => rt.scene.nodes.map((n, i) => (re.test(n.properties?.Id || '') ? i : -1)).filter((i) => i >= 0);
      // --- the numbers on the slices ---------------------------------------------------------
      for (let k = 0; k < 16; k++) for (const suffix of ['', '_new']) { // each slice has a twin node; the icons live on the _new one
        const n = id(rWheel, `BonusWin_${k}${suffix}`); if (n < 0) continue;
        rWheel.send(n, k === 0 ? 'mega_wheel' : 'coins');
        const txt = rWheel.scene.nodes.findIndex((nd, i) => nd.type === 'text' && nd.properties?.Id === 'coinsTxt' && isInside(rWheel, n, i));
        if (txt >= 0) wheel.setText(txt, k === 0 ? '' : short(VALUES[k]));
      }
      // --- open: shell entrance, idle lights, free-spin hub ------------------------------------
      rShell.send(id(rShell, 'Modes'), 'show'); rShell.send(id(rShell, 'Check'), 'check_show');
      rWheel.send(id(rWheel, 'Modes'), 'show'); rWheel.send(id(rWheel, 'lamps'), 'default'); rWheel.send(id(rWheel, 'PriceStates'), 'free_spin');
      // --- what a click means ----------------------------------------------------------------------
      rWheel.on((ev) => { if (ev.kind === 'click' && ev.id === 'spinBtn') spin(); });
      rWin.on((ev) => { if (ev.kind === 'click' && ev.id === 'CollectBtn') collect(); });
      rShell.on((ev) => { if (ev.kind === 'click' && ev.id === 'CloseBtn') say('close (would return to the lobby)'); });
      setStatus('');

      function spin() {
        const w = world.current!; if (phaseRef.current !== 'idle') return; phaseRef.current = 'spinning'; setPhase('spinning');
        const sector = Math.floor(Math.random() * 16);
        rWheel.send(id(rWheel, 'spinBtn'), 'dis'); rWheel.send(id(rWheel, 'lamps'), 'spin');
        const el = wheel.els[id(rWheel, 'innerWheel')];
        // slice k's label sits at angle a_k; the pointer is at -90°. Rotate so a_k + φ ≡ -90.
        const ak = rWheel.scene.nodes[id(rWheel, `BonusWin_${sector}`)].properties?.Skew?.x ?? 0;
        const cur = +(/rotate\(([-\d.]+)deg\)/.exec(el.style.transform)?.[1] || 0);
        const phi = ((-90 - ak) % 360 + 360) % 360; const target = cur + 4 * 360 + ((phi - cur) % 360 + 360) % 360;
        say(`spin → slice ${sector} (${sector === 0 ? 'MEGA WHEEL' : fmt(VALUES[sector])})`);
        animate(el, { rotate: target, duration: 4600, ease: 'outQuart', onComplete: () => land(sector) });
      }
      function land(sector: number) {
        phaseRef.current = 'landed'; setPhase('landed');
        rWheel.send(id(rWheel, 'fakeSector'), `sector_${sector}`); rWheel.send(id(rWheel, 'sectorWin'), 'win'); rWheel.send(id(rWheel, 'lamps'), 'win');
        setTimeout(() => showWin(sector), 2200);
      }
      function showWin(sector: number) {
        phaseRef.current = 'won'; setPhase('won');
        const base = VALUES[sector] || 5940, tier = Math.round(base * 0.1), friends = 0, ret = Math.round(base * 0.2), total = base + tier + friends + ret;
        const t = (name: string, v: string) => { const n = id(rWin, name); if (n >= 0) win.setText(n, v); };
        t('TotalWinTxt', fmt(total)); t('WheelBonusTxt', fmt(base)); t('TierBonusTxt', fmt(tier)); t('FriendsBonusTxt', fmt(friends)); t('ReturnBonusTxt', fmt(ret));
        rWin.send(id(rWin, 'winPanel'), 'free'); rWin.send(id(rWin, 'WinType'), 'coins'); rWin.send(id(rWin, 'infoPanel'), 'free'); rWin.send(id(rWin, 'PopupWinStates'), 'win_return');
        for (let e: HTMLElement | null = win.els[id(rWin, 'panel')]; e && !e.classList.contains('scene'); e = e.parentElement) if (e.style.display === 'none') e.style.display = ''; // the client unhides the breakdown container itself
        rWin.send(id(rWin, 'Modes'), 'show');
        say(`won ${fmt(total)} = ${fmt(base)} wheel + ${fmt(tier)} tier + ${friends} friends + ${fmt(ret)} return`);
      }
      function collect() {
        rWin.send(id(rWin, 'Modes'), 'default'); win.reset();
        rWheel.send(id(rWheel, 'sectorWin'), 'no_win'); rWheel.send(id(rWheel, 'fakeSector'), 'default'); rWheel.send(id(rWheel, 'lamps'), 'default');
        rWheel.send(id(rWheel, 'spinBtn'), 'up'); rWheel.send(id(rWheel, 'PriceStates'), 'free_spin');
        phaseRef.current = 'idle'; setPhase('idle'); say('collected — spin again');
      }
    })().catch((e) => setStatus('failed: ' + e.message));
    return () => { dead = true; world.current?.rShell.dispose(); world.current?.rWheel.dispose(); world.current?.rWin.dispose(); };
  }, []);
  const phaseRef = useRef<'idle' | 'spinning' | 'landed' | 'won'>('idle');

  // fit the stage to the window
  useEffect(() => { const fit = () => { const f = document.querySelector('.play .frame') as HTMLElement | null; const s = document.querySelector('.play .stage') as HTMLElement | null; if (f && s) s.style.transform = `scale(${f.clientWidth / 1366})`; }; fit(); addEventListener('resize', fit); return () => removeEventListener('resize', fit); }, []);

  return <div className="play">
    <div className="frame"><div className="stage"><div className="design" ref={stageRef} /></div></div>
    {status && <div className="loading">{status}</div>}
    <div className="hud"><b>Daily Free Spin</b><span>{phase === 'idle' ? 'click SPIN FOR FREE' : phase === 'spinning' ? 'spinning…' : phase === 'landed' ? 'landed' : 'click COLLECT'}</span>{log.slice(-2).map((l, i) => <span key={i}>· {l}</span>)}<a href="/" style={{ color: 'inherit', marginLeft: 8 }}>viewer</a></div>
  </div>;
}

function isInside(rt: Runtime, ancestor: number, node: number): boolean {
  const kids = rt.scene.nodes[ancestor].children || [];
  return kids.includes(node) || kids.some((k) => isInside(rt, k, node));
}
