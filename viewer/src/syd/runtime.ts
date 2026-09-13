// Interaction runtime: the state machines run as authored. Every node with a machine keeps its
// active leaf per container; `send(node, "param")` and `signal(node, event, value)` follow the
// state's transitions; entering a state plays its onEnter timeline. Buttons get a hit box from
// their TouchArea and feed the engine's touch values (0 up, 1 down, 2 hover) to their own
// self-signal, which is how the client drives `_up / _down / _hover`.
import type { Scene, Wad } from './wad';
import type { Built } from './dom';
import { playState } from './timeline';

type Listener = (ev: { node: number; id: string | null; kind: 'click' | 'enter'; state?: string }) => void;

export class Runtime {
  private container = new Map<number, number>();      // leaf state -> its container state
  private machineOf = new Map<number, number>();       // node -> machine root state
  private active = new Map<number, number>();          // container -> active leaf
  private owner = new Map<number, number>();           // state -> owning node
  private timelines = new Map<number, any>();          // container -> running timeline
  private selfEvent = new Map<number, number>();       // node -> its self signalEvent index
  private listeners: Listener[] = [];
  log: string[] = [];

  constructor(public scene: Scene, public built: Built, public wad: Wad, public name = '') {
    const S = scene.states || [];
    const walk = (si: number, node: number, parent: number | null) => { const st = S[si]; if (!st) return; this.owner.set(si, node); if (st.children?.length) { for (const c of st.children) walk(c, node, si); } else if (parent != null) this.container.set(si, parent); };
    scene.nodes.forEach((n, i) => { if (n.stateMachine != null) { this.machineOf.set(i, n.stateMachine); walk(n.stateMachine, i, null); } });
    // initial: first leaf of every container (parallel containers start all their children)
    const start = (si: number) => { const st = S[si]; if (!st) return; if (!st.children?.length) { const c = this.container.get(si); if (c != null) this.active.set(c, si); return; } if (st.mode === 'Parallel') st.children.forEach(start); else start(st.children[0]); };
    for (const root of this.machineOf.values()) start(root);
    (scene.signalEvents || []).forEach((ev: any, k: number) => { if (ev.source === ev.target) this.selfEvent.set(ev.source, k); });
    this.attachButtons();
  }

  on(fn: Listener) { this.listeners.push(fn); }
  dispose() { for (const tl of this.timelines.values()) tl?.cancel(); this.timelines.clear(); }

  /** leaves currently active in `node`'s machine */
  activeLeaves(node: number): number[] {
    const root = this.machineOf.get(node); if (root == null) return [];
    const out: number[] = []; const S = this.scene.states!;
    const walk = (si: number) => { const st = S[si]; if (!st.children?.length) return; const a = this.active.get(si); if (st.mode === 'Parallel') st.children.forEach(walk); else if (a != null) { out.push(a); walk(a); } };
    walk(root); return out;
  }
  stateId(node: number) { return this.activeLeaves(node).map((si) => this.scene.states![si].id).join('+'); }

  private matchAndEnter(node: number, test: (rule: any) => boolean): boolean {
    const S = this.scene.states!, T = this.scene.transitions || [], R = this.scene.rules || [];
    for (const li of this.activeLeaves(node)) {
      const st = S[li];
      const trs: number[] = st.transitions || [];
      // targets are indices into the container's children, not global state indices
      for (let i = 0; i < trs.length; i++) { const t = T[trs[i]]; const rule = t?.rule != null ? R[t.rule] : null; if (rule && test(rule)) { const local = st.targets?.[i]; const c = this.container.get(li); const target = local != null && c != null ? S[c].children?.[local] : undefined; if (target != null) { this.enter(target); return true; } } }
    }
    return false;
  }
  /** string event, the client's SendSMEventAsync */
  send(node: number, param: string) { const ok = this.matchAndEnter(node, (r) => r.type === 'param' && (r.params || []).includes(param)); this.note(`${this.label(node)} ← "${param}"${ok ? ' → ' + this.stateId(node) : ' (no transition)'}`); return ok; }
  /** engine signal (touch values on buttons) */
  signal(node: number, eventIndex: number, value: number) { return this.matchAndEnter(node, (r) => r.type === 'signal' && r.signal === eventIndex && (r.params || []).includes(value)); }
  /** enter a leaf state by its id on a node's machine (fallback when no signal is wired) */
  enterById(node: number, id: string) { const S = this.scene.states!; const root = this.machineOf.get(node); if (root == null) return false; let found = -1; const walk = (si: number) => { const st = S[si]; if (st.children?.length) st.children.forEach(walk); else if (st.id === id) found = si; }; walk(root); if (found < 0) return false; this.enter(found); return true; }

  enter(si: number) {
    const S = this.scene.states!; const st = S[si]; const c = this.container.get(si); const node = this.owner.get(si)!;
    if (c != null) { this.timelines.get(c)?.cancel(); this.active.set(c, si); }
    const acts = this.scene.nodes[node].actions || [];
    if (st.onEnter != null && acts[st.onEnter] != null) { const res = playState(this.scene, this.built, acts[st.onEnter], node, { loop: false, reset: false }); if (c != null) this.timelines.set(c, res.tl); }
    this.listeners.forEach((fn) => fn({ node, id: this.scene.nodes[node].properties?.Id || null, kind: 'enter', state: st.id }));
  }

  private label(node: number) { const id = this.scene.nodes[node]?.properties?.Id; return `${this.name ? this.name + ' ' : ''}[${node}]${id ? ' #' + id : ''}`; }
  private note(s: string) { this.log.push(s); if (this.log.length > 200) this.log.shift(); }

  private attachButtons() {
    this.scene.nodes.forEach((n, i) => {
      if (n.type !== 'button' && n.type !== 'checkbox') return;
      const el = this.built.els[i]; if (!el) return;
      // TouchArea is a top-left box from the node origin; without one, use the union of the button's sprites
      let ta = n.properties?.TouchArea;
      if (!ta) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const sp of el.querySelectorAll('.spr') as NodeListOf<HTMLElement>) { let ox = 0, oy = 0; for (let p = sp.parentElement; p && p !== el; p = p.parentElement) { const m = /translateX\(([-\d.]+)px\) translateY\(([-\d.]+)px\)/.exec(p.style.transform); if (m) { ox += +m[1]; oy += +m[2]; } }
          const l = ox + parseFloat(sp.style.left || '0'), t = oy + parseFloat(sp.style.top || '0'); x0 = Math.min(x0, l); y0 = Math.min(y0, t); x1 = Math.max(x1, l + parseFloat(sp.style.width || '0')); y1 = Math.max(y1, t + parseFloat(sp.style.height || '0')); }
        ta = x0 === Infinity ? { x: -30, y: -30, w: 60, h: 60 } : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; }
      const hit = document.createElement('div'); hit.className = 'hit'; hit.title = n.properties?.Id || `button ${i}`;
      hit.style.cssText = `left:${ta.x || 0}px;top:${ta.y || 0}px;width:${ta.w}px;height:${ta.h}px`;
      const ev = this.selfEvent.get(i);
      const touch = (v: number, fallback: string) => { if (ev != null) { if (!this.signal(i, ev, v)) this.enterById(i, fallback); } else this.enterById(i, fallback); };
      let down = false;
      hit.addEventListener('mouseenter', () => { if (!down) touch(2, '_hover'); });
      hit.addEventListener('mouseleave', () => { down = false; touch(0, '_up'); });
      hit.addEventListener('mousedown', (e) => { e.preventDefault(); down = true; touch(1, '_down'); });
      hit.addEventListener('mouseup', () => { if (!down) return; down = false; touch(2, '_hover'); this.send(i, 'click_sound_play'); setTimeout(() => this.send(i, 'click_sound_default'), 400); this.note(`click ${this.label(i)}`); this.listeners.forEach((fn) => fn({ node: i, id: n.properties?.Id || null, kind: 'click' })); });
      el.appendChild(hit);
    });
  }
}
