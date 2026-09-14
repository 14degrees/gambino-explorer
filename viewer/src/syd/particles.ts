// particles2: a Cocos-style emitter. EmissionRate is seconds between births (0.005 = 200/s),
// which with LifeTime gives MaxCount; Skew.x is the emit direction in degrees (-90 = up) and
// AngleVariance the spread; Speed in px/s; sizes tween Start→End over the life; sprites with
// several frames play as a flipbook at FrameSpeed. Particles are plain divs moved each frame.
import type { SpriteSheet } from './wad';

/** 1 = the authored emission rate; lower for a calmer shower */
export const PARTICLE_INTENSITY = 0.6;

type P = { el: HTMLDivElement; x: number; y: number; vx: number; vy: number; age: number; life: number; s0: number; s1: number; r0: number; r1: number; f0: number; a0: number; a1: number };
const rnd = (v: number) => (Math.random() * 2 - 1) * v;

export class Particles {
  private live: P[] = [];
  private raf = 0; private last = 0; private acc = 0; private emitting = false; private started = 0;
  constructor(private host: HTMLElement, private sheet: SpriteSheet, private url: string, private p: Record<string, any>) {}

  private birth() {
    const p = this.p; const f = this.sheet.frames; const size = (p.StartSize?.x ?? 32) + rnd(p.StartSizeVariance?.x ?? 0);
    const ang = ((p.Skew?.x ?? -90) + rnd((p.AngleVariance ?? 0) / 2)) * Math.PI / 180;
    const spd = (p.Speed ?? 0) + rnd(p.SpeedVariance ?? 0);
    const el = document.createElement('div'); el.className = 'spr particle';
    const frame0 = Math.floor(Math.random() * Math.min(f.length, (p.StartFrameVariance ?? 0) + 1));
    const fr = f[0].frame; el.style.cssText = `left:0;top:0;width:${fr.w}px;height:${fr.h}px;background-image:url(${this.url});will-change:transform`;
    this.host.appendChild(el);
    const life = ((p.LifeTime ?? 1) + rnd(p.LifeTimeVariance ?? 0)) * 1000;
    this.live.push({ el, x: rnd((p.PosVariance?.x ?? 0) / 2), y: rnd((p.PosVariance?.y ?? 0) / 2), vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, age: 0, life: Math.max(1, life),
      s0: size, s1: (p.EndSize?.x ?? size) + rnd(p.EndSizeVariance?.x ?? 0), r0: rnd(p.StartRotateVariance ?? 0), r1: rnd((p.EndRotateVariance ?? 0) / 2), f0: frame0, a0: p.StartColor?.a ?? 1, a1: p.EndColor?.a ?? 1 });
  }
  private tick = (ts: number) => {
    const dt = this.last ? Math.min(50, ts - this.last) : 16; this.last = ts;
    const p = this.p; const max = p.MaxCount ?? 200; const every = (p.EmissionRate ?? 0.05) * 1000 / PARTICLE_INTENSITY;
    if (this.emitting) { this.acc += dt; while (this.acc >= every && this.live.length < max) { this.acc -= every; this.birth(); } if (p.Duration > 0 && ts - this.started > p.Duration * 1000) this.emitting = false; }
    const g = p.Gravity || { x: 0, y: 0 }; const f = this.sheet.frames; const fps = p.FrameSpeed ?? 24;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const q = this.live[i]; q.age += dt; if (q.age >= q.life) { q.el.remove(); this.live.splice(i, 1); continue; }
      const u = q.age / q.life; const s = dt / 1000; q.vx += (g.x || 0) * s; q.vy += (g.y || 0) * s; q.x += q.vx * s; q.y += q.vy * s;
      // frames are trimmed to different rects inside one source box; size by the box, place the trim inside it
      const size = q.s0 + (q.s1 - q.s0) * u; const fd = f[(q.f0 + Math.floor(q.age / 1000 * fps)) % f.length]; const fr = fd.frame, ss = fd.sourceSize, off = fd.spriteSourceSize; const k = size / ss.w;
      q.el.style.width = fr.w + 'px'; q.el.style.height = fr.h + 'px'; q.el.style.backgroundPosition = `-${fr.x}px -${fr.y}px`;
      q.el.style.transform = `translate(${q.x}px, ${q.y}px) rotate(${q.r0 + (q.r1 - q.r0) * u}deg) scale(${k}) translate(${off.x - ss.w / 2}px, ${off.y - ss.h / 2}px)`; q.el.style.transformOrigin = '0 0';
      q.el.style.opacity = String(q.a0 + (q.a1 - q.a0) * u);
    }
    if (this.emitting || this.live.length) this.raf = requestAnimationFrame(this.tick); else this.raf = 0;
  };
  play() { this.emitting = true; this.started = performance.now(); this.last = 0; if (!this.raf) this.raf = requestAnimationFrame(this.tick); }
  stop() { this.emitting = false; }
  clear() { this.stop(); cancelAnimationFrame(this.raf); this.raf = 0; this.live.forEach((q) => q.el.remove()); this.live = []; }
}
