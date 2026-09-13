// Build a syd scene as nested <div>s. Sprites crop whole atlases with background-position
// (served as URLs, so no data-URI limits), text is glyph divs from bitmap fonts, masks are
// CSS masks in luminance mode (the shader multiplies by the red channel), videos are canvases
// that composite the RGB|alpha halves.
import type { Wad, Scene } from './wad';
import { cdn } from './wad';
import { initialProps, effectiveProps, kidsByZ, roots } from './scene';
import { AlphaVideo } from './video';

export type Built = { root: HTMLElement; els: HTMLElement[]; videos: Map<number, AlphaVideo>; init: Record<number, Record<string, any>>; setFrame: (i: number, f: number) => void; reset: () => void };

const texUrl = (w: Wad, id: string) => { const t = w.textures[id]; return t ? cdn(t.webp || t.png!) : null; };

export function transformOf(p: Record<string, any>) {
  const P = p.Position || {}, O = p.Origin || {}, S = p.Scale || {}, K = p.Skew || {};
  // individual functions in anime.js's order so tweens on x / rotate / scaleX update in place
  const parts = [`translateX(${(P.x || 0) - (O.x || 0)}px) translateY(${(P.y || 0) - (O.y || 0)}px)`];
  if (K.x || K.y) parts.push(K.x === K.y ? `rotate(${K.x}deg)` : `skewX(${K.x || 0}deg) skewY(${K.y || 0}deg)`); // equal skews are a rotation
  if (S.x != null || S.y != null) parts.push(`scaleX(${S.x ?? 1}) scaleY(${S.y ?? 1})`);
  return parts.join(' ');
}

export function buildScene(w: Wad, r: Scene, opts: { applyInitial?: boolean; reveal?: boolean } = {}): Built {
  const init = opts.applyInitial === false ? {} : initialProps(r);
  const els: HTMLElement[] = []; const videos = new Map<number, AlphaVideo>();
  const spriteEl = (name: string, frameIdx = 0) => {
    const sh = w.sprites[name]; if (!sh) return null;
    const f = sh.frames[Math.min(frameIdx, sh.frames.length - 1)]; const url = texUrl(w, sh.meta.image); if (!url) return null;
    const d = document.createElement('div'); d.className = 'spr';
    d.style.cssText = `left:${f.spriteSourceSize.x}px;top:${f.spriteSourceSize.y}px;width:${f.frame.w}px;height:${f.frame.h}px;background-image:url(${url});background-position:-${f.frame.x}px -${f.frame.y}px`;
    return d;
  };
  const textEl = (p: Record<string, any>) => {
    const font = w.fonts[p.FontName]; if (!font) return null; const url = texUrl(w, font.page); if (!url) return null;
    const text: string = p.Text || ''; const sp = p.Spacing || 0;
    const glyphs = [...text].map((ch) => font.chars[ch.charCodeAt(0)]).filter(Boolean); if (!glyphs.length) return null;
    const tw = glyphs.reduce((a, g) => a + g.xa + sp, -sp); const box = p.Size || { w: tw, h: font.lineHeight };
    let k = 1; if (p.DimensionSource === 'ProportionalSize') k = Math.min(1, box.w / tw, box.h / font.lineHeight);
    let x = 0, y = 0;
    if (p.HAlignment === 'Center') x = (box.w - tw * k) / 2; else if (p.HAlignment === 'Right') x = box.w - tw * k;
    if (p.VAlignment === 'Center') y = (box.h - font.lineHeight * k) / 2; else if (p.VAlignment === 'Bottom') y = box.h - font.lineHeight * k;
    const t = document.createElement('div'); t.className = 'txt'; t.style.transform = `translate(${x}px,${y}px) scale(${k})`;
    let pen = 0;
    for (const g of glyphs) { if (g.w) { const d = document.createElement('div'); d.className = 'spr'; d.style.cssText = `left:${pen + g.xo}px;top:${g.yo}px;width:${g.w}px;height:${g.h}px;background-image:url(${url});background-position:-${g.x}px -${g.y}px`; t.appendChild(d); } pen += g.xa + sp; }
    return t;
  };
  const build = (i: number): HTMLElement => {
    const n = r.nodes[i]; const p = effectiveProps(r, init, i);
    const el = document.createElement('div'); el.className = `nd ${n.type}`; el.id = 'n' + i; if (p.Id) el.dataset.id = p.Id;
    const st: string[] = [`transform:${transformOf(p)}`];
    if (p.Origin) st.push(`transform-origin:${p.Origin.x || 0}px ${p.Origin.y || 0}px`);
    if (p.DrawOrder != null) st.push(`z-index:${p.DrawOrder}`);
    if (p.Hidden && !opts.reveal) st.push('display:none');
    if (p.Color && p.Color.a != null && !opts.reveal) st.push(`opacity:${(p.Color.a / 255).toFixed(3)}`);
    if (p.Color && (p.Color.r != null || p.Color.g != null || p.Color.b != null)) { const br = ((p.Color.r ?? 255) + (p.Color.g ?? 255) + (p.Color.b ?? 255)) / 765; if (br < 0.98) st.push(`filter:brightness(${br.toFixed(2)})`); }
    if (n.blend?.destinationFactor === 'One') st.push('mix-blend-mode:plus-lighter');
    if (n.type === 'mask' && p.TextureName && p.MaskSize) {
      const url = texUrl(w, p.TextureName);
      if (url) { const ms = p.MaskScale || {}, mp = p.MaskPosition || { x: 0, y: 0 }; const mw = p.MaskSize.w * (ms.x ?? 1), mh = p.MaskSize.h * (ms.y ?? 1);
        st.push(`width:${mp.x + mw}px;height:${mp.y + mh}px;-webkit-mask-image:url(${url});mask-image:url(${url});-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:${mp.x}px ${mp.y}px;mask-position:${mp.x}px ${mp.y}px;-webkit-mask-size:${mw}px ${mh}px;mask-size:${mw}px ${mh}px;mask-mode:luminance`); }
    }
    el.style.cssText = st.join(';');
    if (n.type === 'sprite' || n.type === 'ninePatch') { const s = spriteEl(p.SpriteName, p.Frame || 0); if (s) el.appendChild(s); }
    else if (n.type === 'text') { const t = textEl(p); if (t) el.appendChild(t); }
    else if (n.type === 'videoSprite' && p.VideoName && w.videos[p.VideoName]) { const v = new AlphaVideo(cdn(w.videos[p.VideoName].webm || w.videos[p.VideoName].mp4!)); videos.set(i, v); el.appendChild(v.canvas); }
    for (const k of kidsByZ(r, n)) el.appendChild(build(k));
    els[i] = el; return el;
  };
  const root = document.createElement('div'); root.className = 'scene';
  for (const rt of roots(r)) root.appendChild(build(rt));
  const base = els.map((e) => e?.style.cssText);
  return {
    root, els, videos, init,
    setFrame: (i, f) => { const sp = els[i]?.querySelector('.spr') as HTMLElement | null; const sh = w.sprites[r.nodes[i].properties?.SpriteName]; const fr = sh?.frames[Math.min(f, sh.frames.length - 1)]; if (sp && fr) sp.style.backgroundPosition = `-${fr.frame.x}px -${fr.frame.y}px`; },
    reset: () => { els.forEach((e, i) => { if (e) e.style.cssText = base[i]; }); videos.forEach((v) => v.stop()); },
  };
}
