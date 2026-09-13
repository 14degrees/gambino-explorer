// Node tree: top layer first like a layers panel; click to highlight on stage, checkbox to hide.
import { useState } from 'react';
import type { Scene, Node } from '../syd/wad';
import { kidsByZ, roots } from '../syd/scene';

export default function Tree({ scene, hidden, onToggle, selected, onSelect }: { scene: Scene; hidden: Set<number>; onToggle: (i: number) => void; selected: number | null; onSelect: (i: number | null) => void }) {
  return <div className="tree">{roots(scene).map((i) => <Row key={i} scene={scene} i={i} depth={0} hidden={hidden} onToggle={onToggle} selected={selected} onSelect={onSelect} />)}</div>;
}
const label = (n: Node) => { const p = n.properties || {}; const nm = p.SpriteName || p.VideoName || p.SoundName || p.TextureName || p.FontName || ''; return { id: p.Id, nm: nm.split('/').pop(), text: p.Text, hidden: p.Hidden, a0: p.Color && p.Color.a === 0 }; };
function Row({ scene, i, depth, hidden, onToggle, selected, onSelect }: { scene: Scene; i: number; depth: number; hidden: Set<number>; onToggle: (i: number) => void; selected: number | null; onSelect: (i: number | null) => void }) {
  const n = scene.nodes[i]; const kids = kidsByZ(scene, n).reverse(); const [open, setOpen] = useState(depth < 2);
  const l = label(n);
  return <div>
    <div className={`trow${selected === i ? ' sel' : ''}`} style={{ paddingLeft: 6 + depth * 12 }} onClick={() => onSelect(selected === i ? null : i)}>
      <input type="checkbox" checked={!hidden.has(i)} onClick={(e) => e.stopPropagation()} onChange={() => onToggle(i)} aria-label="visible" />
      <span className="car" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>{kids.length ? (open ? '▾' : '▸') : ''}</span>
      <span className="idx">{i}</span><span className={`b ${n.type}`}>{n.type === 'videoSprite' ? 'video' : n.type === 'particles2' ? 'particles' : n.type}</span>
      {l.id && <span className="id">#{l.id}</span>}{l.nm && <span className="nm">{l.nm}</span>}{l.text != null && <span className="nm">{JSON.stringify(l.text)}</span>}{l.hidden && <span className="hid">HIDDEN</span>}{l.a0 && <span className="hid">α0</span>}
    </div>
    {open && kids.map((k) => <Row key={k} scene={scene} i={k} depth={depth + 1} hidden={hidden} onToggle={onToggle} selected={selected} onSelect={onSelect} />)}
  </div>;
}
