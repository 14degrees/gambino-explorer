// Turn a state's onEnter action tree into an anime.js timeline over a built scene.
import { createTimeline, cubicBezier } from 'animejs';
import type { Scene } from './wad';
import { expandedOrder, flatten, effectiveProps, TYPE_DEFAULT, type Track } from './scene';
import type { Built } from './dom';

const NAMED: Record<string, string> = { QuadIn: 'inQuad', QuadOut: 'outQuad', QuadInOut: 'inOutQuad', CubicIn: 'inCubic', CubicOut: 'outCubic', CubicInOut: 'inOutCubic', Linear: 'linear' };
const ease = (tr: Track) => tr.tf === 'CubicBezier' && tr.tp ? cubicBezier(tr.tp[0], tr.tp[1], tr.tp[2], tr.tp[3]) : (NAMED[tr.tf || ''] || 'linear');

export function playState(r: Scene, built: Built, actionIndex: number, ownerNode: number, opts: { loop?: boolean; reset?: boolean; onComplete?: () => void } = {}) {
  const order = expandedOrder(r); const tracks: Track[] = [];
  const total = flatten(r, order, actionIndex, ownerNode, 0, tracks);
  tracks.sort((a, b) => a.t0 - b.t0);
  if (opts.reset !== false) built.reset();
  const tl = createTimeline({ loop: !!opts.loop, defaults: { ease: 'linear' }, onLoop: () => { if (opts.reset !== false) built.reset(); }, onComplete: () => opts.onComplete?.() });
  const el = (i: number) => built.els[i];
  for (const tr of tracks) {
    const target = el(tr.node); if (!target) continue;
    const P = effectiveProps(r, built.init, tr.node); const O = P.Origin || {};
    if (tr.discrete) {
      const v = tr.value;
      if (tr.prop === 'Hidden') tl.call(() => { target.style.display = v ? 'none' : ''; const pt = built.particles.get(tr.node); if (pt) v ? pt.stop() : pt.play(); }, tr.t0); // emitters run while visible
      else if (tr.prop === '__play') tl.call(() => { const vid = built.videos.get(tr.node); if (vid) v ? vid.play() : vid.stop(); const snd = built.sounds.get(tr.node); if (snd) { if (v) { snd.currentTime = 0; snd.play().catch(() => {}); } else snd.pause(); } const pt = built.particles.get(tr.node); if (pt) v ? pt.play() : pt.stop(); }, tr.t0);
      else if (tr.prop === 'Frame') tl.call(() => built.setFrame(tr.node, v ?? 0), tr.t0);
      else if (tr.prop === 'Position') tl.set(target, { x: (v?.x ?? 0) - (O.x || 0), y: (v?.y ?? 0) - (O.y || 0) }, tr.t0);
      else if (tr.prop === 'Scale') tl.set(target, { scaleX: v?.x ?? 1, scaleY: v?.y ?? 1 }, tr.t0);
      else if (tr.prop === 'Skew') { const sx = v?.x ?? 0, sy = v?.y ?? 0; tl.set(target, sx === sy ? { rotate: sx } : { skewX: sx, skewY: sy }, tr.t0); }
      else if (tr.prop === 'Color' && v && v.a != null) tl.set(target, { opacity: v.a / 255 }, tr.t0);
      else if (tr.prop === 'DrawOrder') tl.call(() => { target.style.zIndex = String(v ?? 0); }, tr.t0);
      continue;
    }
    const pr: Record<string, any> = {};
    const rng = (from: any, to: any) => from === undefined ? to : [from, to];
    if (tr.prop === 'Position') {
      const ex = tr.end !== undefined ? (tr.end.x ?? P.Position?.x ?? 0) : 0, ey = tr.end !== undefined ? (tr.end.y ?? P.Position?.y ?? 0) : 0;
      pr.x = rng(tr.start && ((tr.start.x ?? P.Position?.x ?? 0) - (O.x || 0)), ex - (O.x || 0));
      pr.y = rng(tr.start && ((tr.start.y ?? P.Position?.y ?? 0) - (O.y || 0)), ey - (O.y || 0));
    } else if (tr.prop === 'Scale') { pr.scaleX = rng(tr.start?.x, tr.end?.x ?? 1); pr.scaleY = rng(tr.start?.y, tr.end?.y ?? 1); }
    else if (tr.prop === 'Color') { pr.opacity = rng(tr.start?.a != null ? tr.start.a / 255 : undefined, (tr.end?.a ?? 255) / 255); }
    else if (tr.prop === 'Skew') { const sx = tr.end?.x ?? 0, sy = tr.end?.y ?? 0; if (sx === sy) pr.rotate = rng(tr.start?.x, sx); else { pr.skewX = rng(tr.start?.x, sx); pr.skewY = rng(tr.start?.y, sy); } }
    else continue;
    tl.add(target, { ...pr, duration: tr.dur, ease: ease(tr) }, tr.t0);
  }
  tl.play();
  return { tl, total, tracks: tracks.length };
}
