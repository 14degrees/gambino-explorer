// Asset browser for a loaded package: atlases with hover-outlined sprites, sprite tiles,
// symbol videos with their alpha composited, sounds, bitmap fonts.
import { useEffect, useMemo, useRef, useState } from 'react';
import { cdn, type Wad } from '../syd/wad';
import { AlphaVideo } from '../syd/video';

const texUrl = (w: Wad, id: string) => { const t = w.textures[id]; return t ? cdn(t.webp || t.png!) : null; };

export default function Assets({ wad }: { wad: Wad }) {
  const [tab, setTab] = useState<'atlases' | 'sprites' | 'videos' | 'sounds' | 'fonts'>('atlases');
  const [q, setQ] = useState('');
  const counts = { atlases: Object.keys(wad.textures).length, sprites: Object.keys(wad.sprites).length, videos: Object.keys(wad.videos).length, sounds: Object.keys(wad.audio).length, fonts: Object.keys(wad.fonts).length };
  return <div className="assets">
    <div className="atabs">{(['atlases', 'sprites', 'videos', 'sounds', 'fonts'] as const).map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t} <span>{counts[t]}</span></button>)}
      <input type="search" placeholder="filter by name…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
    {tab === 'atlases' && <Atlases wad={wad} q={q} />}
    {tab === 'sprites' && <Sprites wad={wad} q={q} />}
    {tab === 'videos' && <Videos wad={wad} q={q} />}
    {tab === 'sounds' && <Sounds wad={wad} q={q} />}
    {tab === 'fonts' && <Fonts wad={wad} q={q} />}
  </div>;
}

function Atlases({ wad, q }: { wad: Wad; q: string }) {
  const ids = Object.keys(wad.textures).filter((t) => t.toLowerCase().includes(q.toLowerCase()));
  return <div className="atlas-list">{ids.map((id) => <Atlas key={id} wad={wad} id={id} />)}</div>;
}
function Atlas({ wad, id }: { wad: Wad; id: string }) {
  const [dim, setDim] = useState<{ w: number; h: number } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const url = texUrl(wad, id);
  const frames = useMemo(() => Object.entries(wad.sprites).filter(([, s]) => s.meta.image === id).flatMap(([name, s]) => s.frames.map((f, i) => ({ name: s.frames.length > 1 ? `${name} [${i}]` : name, ...f.frame }))), [wad, id]);
  useEffect(() => { const fit = () => { if (boxRef.current && dim) setScale(Math.min(1, boxRef.current.clientWidth / dim.w)); }; fit(); addEventListener('resize', fit); return () => removeEventListener('resize', fit); }, [dim]);
  if (!url) return null;
  return <section className="atlas">
    <h3><span className="mono">{id}</span>{dim && <span className="dim">{dim.w} × {dim.h} · {frames.length} sprite{frames.length === 1 ? '' : 's'}</span>}{hover && <span className="hov">{hover}</span>}</h3>
    <div className="atlas-box" ref={boxRef}>
      <div style={{ position: 'relative', width: dim ? dim.w * scale : 'auto', height: dim ? dim.h * scale : 'auto' }}>
        <img src={url} alt={id} onLoad={(e) => setDim({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} style={{ width: dim ? dim.w * scale : undefined, display: 'block' }} />
        {dim && frames.map((f, i) => <div key={i} className={`outline${hover === f.name ? ' on' : ''}`} style={{ left: f.x * scale, top: f.y * scale, width: f.w * scale, height: f.h * scale }} onMouseEnter={() => setHover(`${f.name} · ${f.w}×${f.h} @ ${f.x},${f.y}`)} onMouseLeave={() => setHover(null)} />)}
      </div>
    </div>
  </section>;
}

function Sprites({ wad, q }: { wad: Wad; q: string }) {
  const list = Object.entries(wad.sprites).filter(([n]) => n.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a[0].localeCompare(b[0]));
  return <div className="tiles">{list.map(([name, s]) => { const f = s.frames[0]; const url = texUrl(wad, s.meta.image); if (!url) return null; const k = Math.min(1, 120 / f.frame.w, 120 / f.frame.h);
    return <div key={name} className="tile" title={`${name} · ${f.sourceSize.w}×${f.sourceSize.h}${s.frames.length > 1 ? ` · ${s.frames.length} frames` : ''}`}>
      <div className="crop" style={{ width: f.frame.w * k, height: f.frame.h * k }}><div className="spr" style={{ width: f.frame.w, height: f.frame.h, backgroundImage: `url(${url})`, backgroundPosition: `-${f.frame.x}px -${f.frame.y}px`, transform: `scale(${k})`, transformOrigin: '0 0' }} /></div>
      <b>{name.split('/').pop()}</b><span>{f.sourceSize.w}×{f.sourceSize.h}{s.frames.length > 1 ? ` · ${s.frames.length}f` : ''}</span></div>; })}</div>;
}

function Videos({ wad, q }: { wad: Wad; q: string }) {
  const list = Object.entries(wad.videos).filter(([n]) => n.toLowerCase().includes(q.toLowerCase()));
  return <div className="tiles vids">{list.map(([name, v]) => <VideoTile key={name} name={name} src={cdn(v.webm || v.mp4!)} />)}</div>;
}
function VideoTile({ name, src }: { name: string; src: string }) {
  const ref = useRef<HTMLDivElement>(null); const av = useRef<AlphaVideo | null>(null); const [dim, setDim] = useState('');
  useEffect(() => { const a = new AlphaVideo(src); av.current = a; a.video.addEventListener('loadedmetadata', () => setDim(`${a.video.videoWidth / 2}×${a.video.videoHeight} · ${a.video.duration.toFixed(1)} s`)); ref.current?.appendChild(a.canvas); return () => { a.stop(); a.canvas.remove(); }; }, [src]);
  return <div className="tile" onMouseEnter={() => av.current?.play()} onMouseLeave={() => av.current?.stop()} title={name}>
    <div className="vbox" ref={ref} /><b>{name.split('/').pop()}</b><span>{dim || 'hover to play'}</span></div>;
}

function Sounds({ wad, q }: { wad: Wad; q: string }) {
  const list = Object.entries(wad.audio).filter(([n]) => n.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a[0].localeCompare(b[0]));
  return <div className="sounds">{list.map(([name, a]) => <div key={name} className="snd"><span className="mono">{name}</span><audio controls preload="none" src={cdn(a.ogg || a.mp3!)} /></div>)}</div>;
}

function Fonts({ wad, q }: { wad: Wad; q: string }) {
  const list = Object.entries(wad.fonts).filter(([n]) => n.toLowerCase().includes(q.toLowerCase()));
  return <div className="fonts">{list.map(([name, f]) => { const url = texUrl(wad, f.page); if (!url) return null; const chars = Object.keys(f.chars).map(Number).map((c) => String.fromCharCode(c)).join('');
    let pen = 0; const glyphs = [...chars].map((ch) => { const g = f.chars[ch.charCodeAt(0)]; const x = pen; pen += g.xa + 2; return { g, x }; });
    const k = Math.min(1, 700 / Math.max(pen, 1));
    return <section key={name} className="font"><h3><span className="mono">{name}</span><span className="dim">{Object.keys(f.chars).length} glyphs · line {f.lineHeight}px · page {f.page}</span></h3>
      <div className="glyphs" style={{ height: f.lineHeight * k + 8 }}><div style={{ transform: `scale(${k})`, transformOrigin: '0 0', position: 'relative' }}>{glyphs.map(({ g, x }, i) => g.w ? <div key={i} className="spr" style={{ left: x + g.xo, top: g.yo, width: g.w, height: g.h, backgroundImage: `url(${url})`, backgroundPosition: `-${g.x}px -${g.y}px` }} /> : null)}</div></div></section>; })}</div>;
}
