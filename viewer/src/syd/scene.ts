// Scene-graph rules shared by everything that renders a syd scene.
import type { Scene, Node } from './wad';

export const TYPE_DEFAULT: Record<string, any> = { Scale: { x: 1, y: 1 }, Color: { a: 255, r: 255, g: 255, b: 255 }, Position: { x: 0, y: 0 }, Skew: { x: 0, y: 0 }, Origin: { x: 0, y: 0 }, Frame: 0, DrawOrder: 0, Hidden: false };

export function roots(r: Scene): number[] {
  const parent = new Set<number>(); r.nodes.forEach((n) => (n.children || []).forEach((c) => parent.add(c)));
  return r.nodes.map((_, i) => i).filter((i) => !parent.has(i));
}
// reference.target counts nodes in an expanded post-order walk (shared nodes once per parent)
export function expandedOrder(r: Scene): number[] {
  const seq: number[] = []; const walk = (i: number) => { for (const c of r.nodes[i].children || []) walk(c); seq.push(i); };
  roots(r).forEach(walk); return seq;
}
export const kidsByZ = (r: Scene, n: Node) => [...(n.children || [])].sort((a, b) => (r.nodes[a].properties?.DrawOrder || 0) - (r.nodes[b].properties?.DrawOrder || 0));

// Every node with a state machine starts in the first leaf of that machine; run its onEnter
// timeline to its end values. A keyframe with no value means the property's type default.
export function initialProps(r: Scene): Record<number, Record<string, any>> {
  const over: Record<number, Record<string, any>> = {}; const order = expandedOrder(r); const A = r.actions || [];
  const set = (node: number, prop: string, val: any) => { (over[node] ||= {})[prop] = val; };
  const run = (ai: number, node: number, depth: number) => {
    const a = A[ai]; if (!a || depth > 12) return;
    if (a.type === 'discrete') set(node, a.property, a.value === undefined ? (TYPE_DEFAULT[a.property] ?? null) : a.value);
    else if (a.type === 'interpolate') set(node, a.property, a.end === undefined ? (TYPE_DEFAULT[a.property] ?? null) : a.end);
    else if (a.type === 'reference') { const t = order[a.target]; const acts = r.nodes[t]?.actions || []; if (acts[a.action] != null) run(acts[a.action], t, depth + 1); }
    else if (a.type === 'sequence' || a.type === 'parallel') for (const k of a.actions || []) run(k, node, depth + 1);
  };
  const firstLeaf = (si: number): any[] => { const st = r.states?.[si]; if (!st) return []; if (st.children?.length) return st.mode === 'Parallel' ? st.children.flatMap(firstLeaf) : firstLeaf(st.children[0]); return [st]; };
  r.nodes.forEach((n, i) => { if (n.stateMachine == null) return; for (const st of firstLeaf(n.stateMachine)) if (st.onEnter != null && (n.actions || [])[st.onEnter] != null) run(n.actions![st.onEnter], i, 0); });
  return over;
}
export function effectiveProps(r: Scene, init: Record<number, Record<string, any>>, i: number) {
  const p = { ...(r.nodes[i].properties || {}) };
  for (const [k, v] of Object.entries(init[i] || {})) { if (v === null) delete p[k]; else if (k === 'Color' && p.Color) p[k] = { ...p.Color, ...v }; else p[k] = v; }
  return p;
}

// state index -> node that owns the machine it belongs to
export function stateOwners(r: Scene): Record<number, number> {
  const owner: Record<number, number> = {};
  const walk = (si: number, node: number) => { const st = r.states?.[si]; if (!st) return; owner[si] = node; for (const c of st.children || []) walk(c, node); };
  r.nodes.forEach((n, i) => { if (n.stateMachine != null) walk(n.stateMachine, i); });
  return owner;
}

export type Track = { node: number; prop: string; t0: number; dur: number; start?: any; end?: any; tf?: string; tp?: number[]; value?: any; discrete?: boolean };
// Flatten an action tree into absolute-time tracks. sequence = cumulative, parallel = same start,
// reference = another node's action, empty = wait, discrete = set and hold, interpolate = tween.
export function flatten(r: Scene, order: number[], ai: number, node: number, t0: number, out: Track[], depth = 0): number {
  const a = r.actions?.[ai]; if (!a || depth > 14) return 0; const dur = a.duration || 0;
  if (a.type === 'interpolate') { out.push({ node, prop: a.property, t0, dur, start: a.start, end: a.end, tf: a.timeFunction, tp: a.timeParameters }); return dur; }
  if (a.type === 'discrete') { out.push({ node, prop: a.property, t0, dur, value: a.value === undefined ? (TYPE_DEFAULT[a.property] ?? null) : a.value, discrete: true }); return dur; }
  if (a.type === 'empty') return dur;
  if (a.type === 'method') { if (a.method === 'Play' || a.method === 'Stop') out.push({ node, prop: '__play', t0, dur: 0, value: a.method === 'Play', discrete: true }); return 0; }
  if (a.type === 'reference') { const t = order[a.target]; const acts = r.nodes[t]?.actions || []; return acts[a.action] != null ? flatten(r, order, acts[a.action], t, t0, out, depth + 1) : 0; }
  if (a.type === 'sequence') { let t = t0; for (const k of a.actions || []) t += flatten(r, order, k, node, t, out, depth + 1); return t - t0; }
  if (a.type === 'parallel') { let m = 0; for (const k of a.actions || []) m = Math.max(m, flatten(r, order, k, node, t0, out, depth + 1)); return m; }
  // repeat: loop one action forever — unrolled to a horizon so it fits one timeline
  if (a.type === 'repeat') { let t = t0; for (let i = 0; i < REPEAT_MAX && t - t0 < REPEAT_HORIZON; i++) { const d = flatten(r, order, a.action, node, t, out, depth + 1); if (d <= 0) break; t += d; } return t - t0; }
  // timed: run one action, repeating, for `duration` ms (iterations 0 = as many as fit)
  if (a.type === 'timed') { const span = a.duration || 0; let t = t0; const max = a.iterations || 1000; for (let i = 0; i < max && t - t0 < span; i++) { const d = flatten(r, order, a.action, node, t, out, depth + 1); if (d <= 0) break; t += d; } return span; }
  return 0;
}
const REPEAT_HORIZON = 20_000, REPEAT_MAX = 200;
/** a state counts as animated when it tweens, or steps values over time (lamp chases, flipbooks) */
export function isAnimated(ms: number, tweens: number, steps: number) { return ms >= 40 && (tweens > 0 || steps >= 3); }

export type StateInfo = { id: string; index: number; owner: number; ownerId: string | null; action: number; ms: number; tweens: number; steps: number; enteredBy: string[] };
export function listStates(r: Scene): StateInfo[] {
  const owners = stateOwners(r); const order = expandedOrder(r); const out: StateInfo[] = [];
  (r.states || []).forEach((st, si) => {
    if (!st.id || owners[si] == null) return;
    const own = owners[si]; const acts = r.nodes[own].actions || []; const ai = st.onEnter != null ? acts[st.onEnter] : null; if (ai == null) return;
    const tracks: Track[] = []; const ms = flatten(r, order, ai, own, 0, tracks);
    const enteredBy = (st.transitions || []).map((t: number) => r.transitions?.[t]).filter((t: any) => t && t.rule != null).map((t: any) => { const ru = r.rules![t.rule]; return ru.type === 'param' ? (ru.params || []).join('/') : `${ru.type}:${ru.signal ?? ''}`; });
    const stepTimes = new Set(tracks.filter((t) => t.discrete && t.t0 > 0).map((t) => t.t0));
    out.push({ id: st.id, index: si, owner: own, ownerId: r.nodes[own].properties?.Id || null, action: ai, ms, tweens: tracks.filter((t) => !t.discrete && t.dur > 0).length, steps: stepTimes.size, enteredBy });
  });
  return out;
}
