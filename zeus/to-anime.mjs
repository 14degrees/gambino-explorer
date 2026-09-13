// Re-express a syd scene as plain DOM + anime.js.
//   node zeus/to-anime.mjs --wad dl/game103/slot.wad.xml --scene slot/jackpot/scene_mobile.object \
//        --state jackpot0 --title "Flash Cash Jackpot" --out zeus/anime/jackpot.html [--spin innerWheel]
// Nodes become <div>s, sprites are cropped from the original atlases with background-position,
// transforms become CSS transforms, masks become mask-image, the state's onEnter becomes a timeline.
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const wadPath = opt('--wad'), sceneId = opt('--scene'), stateId = opt('--state'), title = opt('--title', 'Scene'), out = opt('--out'), spinId = opt('--spin');
const wad = fs.readFileSync(wadPath, 'utf8');
const blocks = (tag) => [...wad.matchAll(new RegExp(`<${tag} id="([^"]+)">(.*?)</${tag}>`, 'gs'))];

// ---- parse (same shapes as build.mjs) -------------------------------------------------------
const scenes = {}; for (const [, id, body] of blocks('scene')) scenes[id] = JSON.parse(body).resource;
const sprites = {}; for (const [, id, body] of blocks('sprite')) sprites[id] = JSON.parse(body).resource;
const fonts = {};
for (const [, id, body] of blocks('font')) {
  const common = /<common base="(\d+)" lineHeight="(\d+)"/.exec(body); const page = /<page file="([^"]+)"/.exec(body)[1]; const chars = {};
  for (const m of body.matchAll(/<char ([^>]*)\/>/g)) { const a = Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map(([, k, v]) => [k, Number(v)])); chars[a.id] = { x: a.x ?? 0, y: a.y ?? 0, w: a.width ?? 0, h: a.height ?? 0, xo: a.xoffset ?? 0, yo: a.yoffset ?? 0, xa: a.xadvance ?? 0 }; }
  fonts[id] = { base: +common[1], lineHeight: +common[2], page, chars };
}
const b64 = (f, mime) => `data:${mime};base64,${fs.readFileSync(f).toString('base64')}`;
const localOf = (src) => path.join('dl', src.replace(/^assets\/en\/low\/(games\/)?/, '').replace(/[0-9a-f]{32}\./, ''));
const texSrc = {}; // texture id -> {local, mime}
for (const [, id, body] of blocks('texture')) { const src = /<source path="([^"]+\.webp)"/.exec(body)?.[1]; if (src && fs.existsSync(localOf(src))) texSrc[id] = localOf(src); }

const r = scenes[sceneId]; if (!r) throw new Error('no scene ' + sceneId);
const nodes = r.nodes;
const roots = () => { const p = new Set(); nodes.forEach((n) => (n.children || []).forEach((c) => p.add(c))); return nodes.map((_, i) => i).filter((i) => !p.has(i)); };
const order = (() => { const seq = []; const walk = (i) => { for (const c of nodes[i].children || []) walk(c); seq.push(i); }; roots().forEach(walk); return seq; })();
const kidsByZ = (n) => [...(n.children || [])].sort((a, b) => (nodes[a].properties?.DrawOrder || 0) - (nodes[b].properties?.DrawOrder || 0));
const TYPE_DEFAULT = { Scale: { x: 1, y: 1 }, Color: { a: 255, r: 255, g: 255, b: 255 }, Position: { x: 0, y: 0 }, Skew: { x: 0, y: 0 }, Origin: { x: 0, y: 0 }, Frame: 0, DrawOrder: 0, Hidden: false };

// ---- initial state (first leaf of every node's machine, settled) ------------------------------
const initial = {};
{
  const set = (node, prop, val) => { (initial[node] ||= {})[prop] = val; };
  const run = (ai, node, depth) => {
    const a = r.actions[ai]; if (!a || depth > 12) return;
    if (a.type === 'discrete') set(node, a.property, a.value === undefined ? (TYPE_DEFAULT[a.property] ?? null) : a.value);
    else if (a.type === 'interpolate') set(node, a.property, a.end === undefined ? (TYPE_DEFAULT[a.property] ?? null) : a.end);
    else if (a.type === 'reference') { const t = order[a.target]; const acts = nodes[t]?.actions || []; if (acts[a.action] != null) run(acts[a.action], t, depth + 1); }
    else if (a.type === 'sequence' || a.type === 'parallel') for (const k of a.actions || []) run(k, node, depth + 1);
  };
  const firstLeaf = (si) => { const st = r.states[si]; if (!st) return []; if (st.children?.length) return st.mode === 'Parallel' ? st.children.flatMap(firstLeaf) : firstLeaf(st.children[0]); return [st]; };
  nodes.forEach((n, i) => { if (n.stateMachine == null) return; for (const st of firstLeaf(n.stateMachine)) if (st.onEnter != null && (n.actions || [])[st.onEnter] != null) run(n.actions[st.onEnter], i, 0); });
}
const props = (i) => { const p = { ...(nodes[i].properties || {}) }; for (const [k, v] of Object.entries(initial[i] || {})) { if (v === null) delete p[k]; else if (k === 'Color' && p.Color) p[k] = { ...p.Color, ...v }; else p[k] = v; } return p; };

// ---- DOM ----------------------------------------------------------------------------------------
const usedTex = new Set();
// every distinct (texture, rect) becomes one small webp; sprites reference it by class
const crops = new Map();
const cropClass = (tex, x, y, w, h) => { const key = `${cssId(tex)}_${x}_${y}_${w}_${h}`; if (!crops.has(key)) crops.set(key, { key, src: texSrc[tex], x, y, w, h }); return 'c_' + key; };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function transformOf(p) {
  const P = p.Position || {}, O = p.Origin || {}, S = p.Scale || {}, K = p.Skew || {};
  // individual functions in anime.js's order so tweens on x/rotate/scaleX update in place
  const parts = [`translateX(${(P.x || 0) - (O.x || 0)}px) translateY(${(P.y || 0) - (O.y || 0)}px)`];
  if (K.x || K.y) parts.push(K.x === K.y ? `rotate(${K.x}deg)` : `skewX(${K.x || 0}deg) skewY(${K.y || 0}deg)`); // equal skews are a rotation
  if (S.x != null || S.y != null) parts.push(`scaleX(${S.x ?? 1}) scaleY(${S.y ?? 1})`);
  return parts.join(' ');
}
function spriteDiv(name, frameIdx = 0, extra = '') {
  const sh = sprites[name]; if (!sh) return '';
  const f = sh.frames[Math.min(frameIdx, sh.frames.length - 1)]; const tex = sh.meta.image; usedTex.add(tex);
  return `<div class="spr ${cropClass(tex, f.frame.x, f.frame.y, f.frame.w, f.frame.h)}" style="left:${f.spriteSourceSize.x}px;top:${f.spriteSourceSize.y}px;width:${f.frame.w}px;height:${f.frame.h}px${extra}"></div>`;
}
function textDivs(p) {
  const font = fonts[p.FontName]; if (!font) return '';
  usedTex.add(font.page);
  const text = p.Text || ''; const sp = p.Spacing || 0;
  const glyphs = [...text].map((ch) => font.chars[ch.charCodeAt(0)]).filter(Boolean); if (!glyphs.length) return '';
  const tw = glyphs.reduce((a, g) => a + g.xa + sp, -sp); const box = p.Size || { w: tw, h: font.lineHeight };
  let k = 1; if (p.DimensionSource === 'ProportionalSize') k = Math.min(1, box.w / tw, box.h / font.lineHeight);
  let x = 0, y = 0;
  if (p.HAlignment === 'Center') x = (box.w - tw * k) / 2; else if (p.HAlignment === 'Right') x = box.w - tw * k;
  if (p.VAlignment === 'Center') y = (box.h - font.lineHeight * k) / 2; else if (p.VAlignment === 'Bottom') y = box.h - font.lineHeight * k;
  let pen = 0, out = '';
  for (const g of glyphs) { if (g.w) out += `<div class="spr ${cropClass(font.page, g.x, g.y, g.w, g.h)}" style="left:${pen + g.xo}px;top:${g.yo}px;width:${g.w}px;height:${g.h}px"></div>`; pen += g.xa + sp; }
  return `<div class="txt" style="transform:translate(${x}px,${y}px) scale(${k})">${out}</div>`;
}
const cssId = (s) => s.replace(/[^a-z0-9]/gi, '_');
function nodeHtml(i) {
  const n = nodes[i], p = props(i); const st = [];
  st.push(`transform:${transformOf(p)}`);
  if (p.Origin) st.push(`transform-origin:${p.Origin.x || 0}px ${p.Origin.y || 0}px`);
  if (p.DrawOrder != null) st.push(`z-index:${p.DrawOrder}`);
  if (p.Hidden) st.push('display:none');
  if (p.Color && p.Color.a != null) st.push(`opacity:${(p.Color.a / 255).toFixed(3)}`);
  if (p.Color && (p.Color.r != null || p.Color.g != null || p.Color.b != null)) { const br = ((p.Color.r ?? 255) + (p.Color.g ?? 255) + (p.Color.b ?? 255)) / 765; if (br < 0.98) st.push(`filter:brightness(${br.toFixed(2)})`); }
  if (n.blend?.destinationFactor === 'One') st.push('mix-blend-mode:plus-lighter');
  let inner = '';
  if (n.type === 'sprite' || n.type === 'ninePatch') inner += spriteDiv(p.SpriteName, p.Frame || 0);
  else if (n.type === 'text') inner += textDivs(p);
  if (n.type === 'mask' && p.TextureName && texSrc[p.TextureName] && p.MaskSize) {
    const ms = p.MaskScale || {}, mp = p.MaskPosition || { x: 0, y: 0 }; const w = p.MaskSize.w * (ms.x ?? 1), h = p.MaskSize.h * (ms.y ?? 1); usedTex.add(p.TextureName);
    st.push(`width:${mp.x + w}px;height:${mp.y + h}px;-webkit-mask-image:var(--tex-${cssId(p.TextureName)});mask-image:var(--tex-${cssId(p.TextureName)});-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:${mp.x}px ${mp.y}px;mask-position:${mp.x}px ${mp.y}px;-webkit-mask-size:${w}px ${h}px;mask-size:${w}px ${h}px`);
  }
  for (const k of kidsByZ(n)) inner += nodeHtml(k);
  const id = p.Id ? ` data-id="${esc(p.Id)}"` : '';
  return `<div id="n${i}" class="nd ${n.type}"${id} style="${st.join(';')}">${inner}</div>`;
}
const body = roots().map(nodeHtml).join('');

// ---- timeline -> anime.js -------------------------------------------------------------------------
function flatten(ai, node, t0, out, depth = 0) {
  const a = r.actions[ai]; if (!a || depth > 14) return 0; const dur = a.duration || 0;
  if (a.type === 'interpolate') { out.push({ node, prop: a.property, t0, dur, start: a.start, end: a.end, tf: a.timeFunction, tp: a.timeParameters }); return dur; }
  if (a.type === 'discrete') { out.push({ node, prop: a.property, t0, dur, value: a.value === undefined ? (TYPE_DEFAULT[a.property] ?? null) : a.value, discrete: true }); return dur; }
  if (a.type === 'empty') return dur;
  if (a.type === 'reference') { const t = order[a.target]; const acts = nodes[t]?.actions || []; return acts[a.action] != null ? flatten(acts[a.action], t, t0, out, depth + 1) : 0; }
  if (a.type === 'sequence') { let t = t0; for (const k of a.actions || []) t += flatten(k, node, t, out, depth + 1); return t - t0; }
  if (a.type === 'parallel') { let m = 0; for (const k of a.actions || []) m = Math.max(m, flatten(k, node, t0, out, depth + 1)); return m; }
  return 0;
}
const stateOwner = (() => { const owner = {}; const walk = (si, node) => { const st = r.states[si]; if (!st) return; owner[si] = node; for (const c of st.children || []) walk(c, node); }; nodes.forEach((n, i) => { if (n.stateMachine != null) walk(n.stateMachine, i); }); return owner; })();
let tlCode = '', total = 0;
if (stateId) {
  const si = r.states.findIndex((s, i) => s.id === stateId && stateOwner[i] != null && (nodes[stateOwner[i]].actions || [])[s.onEnter] != null);
  if (si < 0) throw new Error('state not found: ' + stateId);
  const own = stateOwner[si]; const tracks = []; total = flatten(nodes[own].actions[r.states[si].onEnter], own, 0, tracks);
  tracks.sort((a, b) => a.t0 - b.t0);
  const ease = (tr) => tr.tf === 'CubicBezier' && tr.tp ? `anime.cubicBezier(${tr.tp.join(',')})` : `'${({ QuadIn: 'inQuad', QuadOut: 'outQuad', QuadInOut: 'inOutQuad', CubicIn: 'inCubic', CubicOut: 'outCubic', CubicInOut: 'inOutCubic' })[tr.tf] || 'linear'}'`;
  const lines = [];
  for (const tr of tracks) {
    const sel = `'#n${tr.node}'`; const P = props(tr.node); const O = P.Origin || {};
    if (tr.discrete) {
      if (tr.prop === 'Hidden') lines.push(`tl.call(() => { $('n${tr.node}').style.display = ${tr.value ? "'none'" : "''"}; }, ${tr.t0});`);
      else if (tr.prop === 'Frame') lines.push(`tl.call(() => setFrame(${tr.node}, ${tr.value ?? 0}), ${tr.t0});`);
      else if (tr.prop === 'Position') lines.push(`tl.set(${sel}, { x: ${(tr.value?.x ?? 0) - (O.x || 0)}, y: ${(tr.value?.y ?? 0) - (O.y || 0)} }, ${tr.t0});`);
      else if (tr.prop === 'Scale') lines.push(`tl.set(${sel}, { scaleX: ${tr.value?.x ?? 1}, scaleY: ${tr.value?.y ?? 1} }, ${tr.t0});`);
      else if (tr.prop === 'Color' && tr.value && tr.value.a != null) lines.push(`tl.set(${sel}, { opacity: ${(tr.value.a / 255).toFixed(3)} }, ${tr.t0});`);
      else if (tr.prop === 'DrawOrder') lines.push(`tl.call(() => { $('n${tr.node}').style.zIndex = ${tr.value ?? 0}; }, ${tr.t0});`);
      else if (tr.prop === 'Text') lines.push(`tl.call(() => setText(${tr.node}, ${JSON.stringify(String(tr.value ?? ''))}), ${tr.t0});`);
      continue;
    }
    const pr = {}; const rng = (from, to) => from === undefined ? to : `[${from}, ${to}]`;
    const endOr = (k, dflt) => tr.end?.[k] ?? dflt;
    if (tr.prop === 'Position') { pr.x = rng(tr.start && ((tr.start.x ?? P.Position?.x ?? 0) - (O.x || 0)), endOr('x', tr.end ? (P.Position?.x ?? 0) : 0) - (O.x || 0)); pr.y = rng(tr.start && ((tr.start.y ?? P.Position?.y ?? 0) - (O.y || 0)), endOr('y', tr.end ? (P.Position?.y ?? 0) : 0) - (O.y || 0)); }
    else if (tr.prop === 'Scale') { pr.scaleX = rng(tr.start?.x, endOr('x', 1)); pr.scaleY = rng(tr.start?.y, endOr('y', 1)); }
    else if (tr.prop === 'Color') { pr.opacity = rng(tr.start?.a != null ? +(tr.start.a / 255).toFixed(3) : undefined, +((tr.end?.a ?? 255) / 255).toFixed(3)); }
    else if (tr.prop === 'Skew') { const sx = endOr('x', 0), sy = endOr('y', 0); if (sx === sy) pr.rotate = rng(tr.start?.x, sx); else { pr.skewX = rng(tr.start?.x, sx); pr.skewY = rng(tr.start?.y, sy); } }
    else if (tr.prop === 'Origin') continue; // origin tweens are rare; skipped
    else continue;
    lines.push(`tl.add(${sel}, { ${Object.entries(pr).map(([k, v]) => `${k}: ${v}`).join(', ')}, duration: ${tr.dur}, ease: ${ease(tr)} }, ${tr.t0});`);
  }
  tlCode = lines.join('\n');
}

// ---- page ------------------------------------------------------------------------------------------
// A whole atlas as one data URI exceeds Chrome's CSS token limit, so each used frame is cropped
// to its own small webp (see zeus/crop.py) and referenced by class. Mask textures are small and stay whole.
import { execFileSync } from 'node:child_process';
execFileSync('python3', ['zeus/crop.py'], { input: JSON.stringify([...crops.values()].filter((c) => c.src)) });
const cropCss = [...crops.keys()].map((k) => `.c_${k}{background-image:url(${b64(`zeus/anime/crops/${k}.webp`, 'image/webp')})}`).join('\n');
const maskTex = [...usedTex].filter((t) => texSrc[t] && nodes.some((n) => n.type === 'mask' && n.properties?.TextureName === t));
const texVars = maskTex.map((t) => `--tex-${cssId(t)}: url(${b64(texSrc[t], texSrc[t].endsWith('.png') ? 'image/png' : 'image/webp')});`).join('\n    ');
const texJson = '{}';
const html = `<title>${esc(title)} in anime.js</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=IBM+Plex+Sans:wght@400;500&display=swap">
<script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/4.5.0/anime.umd.min.js"></script>
<style>
  :root { --ground: #EEF0F3; --ink: #171A20; --muted: #5E6774; --line: #D3D8E0; --gold: #B8871F; --gold-soft: #F3E7C8; --stage: #0F1115;
    ${texVars} }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --ground: #14161C; --ink: #E8E6E0; --muted: #8E96A3; --line: #2C313B; --gold: #E2B54B; --gold-soft: #33290F; --stage: #0A0B0E; } }
  :root[data-theme="dark"] { --ground: #14161C; --ink: #E8E6E0; --muted: #8E96A3; --line: #2C313B; --gold: #E2B54B; --gold-soft: #33290F; --stage: #0A0B0E; }
  body { margin: 0; background: var(--ground); color: var(--ink); font: 14px/1.5 "IBM Plex Sans", sans-serif; }
  .wrap { max-width: 1100px; margin: 0 auto; padding-inline: 16px; padding-block: 16px 40px; }
  h1 { font: 700 30px/1 "Barlow Condensed", sans-serif; margin: 0 0 4px; } h1 small { font-weight: 600; font-size: 15px; color: var(--muted); margin-left: 8px; }
  .lede { color: var(--muted); max-width: 70ch; margin: 0 0 12px; }
  .frame { position: relative; width: 100%; aspect-ratio: 1152 / 768; max-width: 100%; background: var(--stage); border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
  .stage { position: absolute; left: 0; top: 0; width: 1152px; height: 768px; transform-origin: 0 0; }
  .nd { position: absolute; left: 0; top: 0; width: 0; height: 0; transform-origin: 0 0; }
  .spr { position: absolute; background-repeat: no-repeat; background-size: 100% 100%; pointer-events: none; }
  ${cropCss}
  .txt { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
  .bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 10px; }
  .btn { font: 600 14px "Barlow Condensed", sans-serif; letter-spacing: .06em; text-transform: uppercase; background: var(--gold-soft); color: var(--ink); border: 1px solid var(--line); border-radius: 4px; padding: 7px 14px; cursor: pointer; }
  .btn:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
  .note { color: var(--muted); font-size: 13px; }
  pre { background: #0E1014; color: #E6E3DA; padding: 14px; border-radius: 6px; overflow-x: auto; font: 12px/1.5 "IBM Plex Mono", ui-monospace, monospace; max-height: 340px; }
  @media (prefers-reduced-motion: reduce) { .stage * { transition: none !important; } }
</style>
<div class="wrap">
  <h1>${esc(title)}<small>rebuilt as DOM + anime.js 4.5</small></h1>
  <p class="lede">Same atlases, same coordinates, same easing curves — but every node is a <code>&lt;div&gt;</code>, every sprite a <code>background-position</code> crop, and the state's timeline is an <code>anime.createTimeline()</code>. Nothing is drawn to a canvas.</p>
  <div class="frame"><div class="stage" id="stage">${body}</div></div>
  <div class="bar">${stateId ? `<button id="replay" class="btn">Replay “${esc(stateId)}” (${total} ms)</button>` : ''}${spinId ? `<button id="spinBtn" class="btn">Spin the wheel</button>` : ''}<span class="note">${nodes.length} nodes → ${nodes.length} divs · ${crops.size} sprite crops inlined</span></div>
  <details style="margin-top:14px"><summary class="note" style="cursor:pointer">The generated timeline code</summary><pre>${esc(tlCode)}</pre></details>
</div>
<script>
  const $ = (id) => document.getElementById(id);
  const texReady = Promise.resolve();
  const SPRITES = ${JSON.stringify(Object.fromEntries(Object.entries(sprites).map(([k, v]) => [k, v.frames.map((f) => [f.frame.x, f.frame.y])])))};
  const NODES = ${JSON.stringify(nodes.map((n) => n.properties?.SpriteName || null))};
  function setFrame(i, f) { const s = $('n' + i)?.querySelector('.spr'); const fr = SPRITES[NODES[i]]?.[f]; if (s && fr) s.style.backgroundPosition = -fr[0] + 'px ' + -fr[1] + 'px'; }
  function setText(i, t) { const el = $('n' + i); if (el) el.title = t; }
  // fit the 1152×768 stage to the frame
  const fit = () => { const f = document.querySelector('.frame'); $('stage').style.transform = 'scale(' + (f.clientWidth / 1152) + ')'; };
  addEventListener('resize', fit); fit();
  ${stateId ? `
  let tl;
  function play() {
    if (tl) tl.cancel();
    // reset to the scene's rest pose, then build the timeline the wad describes
    document.querySelectorAll('#stage .nd').forEach((el) => { el.dataset.css ??= el.style.cssText; el.style.cssText = el.dataset.css; });
    tl = anime.createTimeline({ defaults: { ease: 'linear' } });
${tlCode.split('\\n').map((l) => '    ' + l).join('\\n')}
    tl.play();
  }
  $('replay').addEventListener('click', play);
  texReady.then(play);` : ''}
  ${spinId ? `
  // The wheel's rotation is code-driven in the original too — this is that code, in anime.js.
  let turns = 0;
  $('spinBtn').addEventListener('click', () => {
    const wheel = document.querySelector('[data-id="${spinId}"]');
    const sector = Math.floor(Math.random() * 16);
    turns += 4 + Math.random() * 2;
    anime.animate(wheel, { rotate: Math.round(turns * 360 + sector * 22.5), duration: 4200, ease: 'outCubic' });
  });` : ''}
</script>
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`${out}: ${nodes.length} nodes, ${usedTex.size} textures, timeline ${total} ms, ${(html.length / 1048576).toFixed(1)} MB`);
