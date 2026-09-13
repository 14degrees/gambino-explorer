import type { Built } from '../syd/dom';
// union of a node's painted descendants, in stage (design) pixels
export function nodeBox(built: Built, i: number, stageEl: HTMLElement, scale: number) {
  const el = built.els[i]; if (!el) return null;
  const s = stageEl.getBoundingClientRect(); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const leaf of el.querySelectorAll('.spr, .vid')) { const r = leaf.getBoundingClientRect(); if (!r.width && !r.height) continue; x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); }
  if (x0 === Infinity) return null;
  return { x: (x0 - s.left) / scale, y: (y0 - s.top) / scale, w: (x1 - x0) / scale, h: (y1 - y0) / scale };
}
export const fmtMs = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(ms % 1000 ? 1 : 0)} s` : `${ms} ms`;
