// Build catalog/catalog.json from every manifest under dl/: one record per game (dl/gameNNN)
// and per lobby feature wad (dl/lobby_next_version/**). Manifest-only: counts, names, scene
// graphs, state machines and animation durations — no pixels except a small thumbnail.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const catalogue = JSON.parse(fs.readFileSync('games.json', 'utf8'));
const titles = {}; for (const [k, v] of Object.entries(catalogue)) { const id = k.split('/').pop(); titles[id] ||= v; }

const TYPE_DEFAULT = { Scale: { x: 1, y: 1 }, Color: { a: 255 }, Position: { x: 0, y: 0 }, Skew: { x: 0, y: 0 }, Origin: { x: 0, y: 0 }, Frame: 0, DrawOrder: 0, Hidden: false };

function parseWad(file) {
  const wad = fs.readFileSync(file, 'utf8');
  const blocks = (tag) => [...wad.matchAll(new RegExp(`<${tag} id="([^"]+)">(.*?)</${tag}>`, 'gs'))];
  const scenes = {}; for (const [, id, body] of blocks('scene')) { try { scenes[id] = JSON.parse(body).resource; } catch {} }
  const sprites = {}; for (const [, id, body] of blocks('sprite')) { try { const r = JSON.parse(body).resource; sprites[id] = { frames: r.frames.length, w: r.frames[0]?.sourceSize?.w, h: r.frames[0]?.sourceSize?.h, tex: r.meta?.image }; } catch {} }
  const textures = blocks('texture').map(([, id]) => id);
  const videos = blocks('video').map(([, id]) => id);
  const audio = blocks('audio').map(([, id]) => id);
  const fonts = blocks('font').map(([, id]) => id);
  return { scenes, sprites, textures, videos, audio, fonts, bytes: wad.length };
}

// --- animation durations, same rules as the inspector -------------------------------------
function sceneSummary(id, r) {
  const nodes = r.nodes || []; const actions = r.actions || []; const states = r.states || [];
  const parent = new Set(); nodes.forEach((n) => (n.children || []).forEach((c) => parent.add(c)));
  const seq = []; const walk = (i) => { for (const c of nodes[i].children || []) walk(c); seq.push(i); };
  nodes.forEach((_, i) => { if (!parent.has(i)) walk(i); });
  const dur = (ai, d = 0) => { // [ms, tweens]
    const a = actions[ai]; if (!a || d > 14) return [0, 0]; const D = a.duration || 0;
    if (a.type === 'interpolate') return [D, 1];
    if (a.type === 'discrete' || a.type === 'empty') return [D, 0];
    if (a.type === 'reference') { const t = seq[a.target]; const acts = nodes[t]?.actions || []; return acts[a.action] != null ? dur(acts[a.action], d + 1) : [0, 0]; }
    if (a.type === 'sequence') { let tot = 0, k = 0; for (const x of a.actions || []) { const [dd, kk] = dur(x, d + 1); tot += dd; k += kk; } return [tot, k]; }
    if (a.type === 'parallel') { let mx = 0, k = 0; for (const x of a.actions || []) { const [dd, kk] = dur(x, d + 1); mx = Math.max(mx, dd); k += kk; } return [mx, k]; }
    return [0, 0];
  };
  const owner = {}; const sw = (si, node) => { const st = states[si]; if (!st) return; owner[si] = node; for (const c of st.children || []) sw(c, node); };
  nodes.forEach((n, i) => { if (n.stateMachine != null) sw(n.stateMachine, i); });
  const anims = [];
  states.forEach((st, si) => {
    if (!st.id || st.onEnter == null || owner[si] == null) return;
    const acts = nodes[owner[si]].actions || []; if (st.onEnter >= acts.length) return;
    const [ms, tw] = dur(acts[st.onEnter]);
    if (ms >= 40 && tw > 0) anims.push([st.id, ms, tw, nodes[owner[si]].properties?.Id || null]);
  });
  const types = {}; for (const n of nodes) types[n.type] = (types[n.type] || 0) + 1;
  const ids = nodes.map((n) => n.properties?.Id).filter(Boolean);
  // reel geometry from the slot_start_N / slot_end hooks
  let grid = null;
  const starts = nodes.filter((n) => /^slot_start_\d$/.test(n.properties?.Id || '')); const end = nodes.find((n) => n.properties?.Id === 'slot_end');
  if (starts.length && end && starts[0].properties.Size) { const cell = starts[0].properties.Size; grid = { cols: starts.length, rows: Math.round((end.properties.Position?.y || 0) / cell.h) + 1, w: cell.w, h: cell.h }; }
  return { id, nodes: nodes.length, states: states.filter((s) => s.id).length, actions: actions.length, types, anims, ids: ids.length, grid };
}

function summarise(dir, wadFiles) {
  const wads = {}; let sprites = 0, videos = [], audio = 0, fonts = 0, textures = 0, bytes = 0; const scenes = []; let grid = null;
  const symbolScenes = new Set(); const symbolSprites = new Set(); const bigSprites = [];
  for (const f of wadFiles) {
    const w = parseWad(f); const name = path.relative(dir, f);
    wads[name] = { scenes: Object.keys(w.scenes).length, sprites: Object.keys(w.sprites).length, textures: w.textures.length, videos: w.videos.length, audio: w.audio.length, fonts: w.fonts.length, kb: Math.round(w.bytes / 1024) };
    sprites += Object.keys(w.sprites).length; videos.push(...w.videos); audio += w.audio.length; fonts += w.fonts.length; textures += w.textures.length; bytes += w.bytes;
    for (const [id, r] of Object.entries(w.scenes)) { const s = sceneSummary(id, r); s.wad = name; scenes.push(s); if (s.grid && !grid) grid = s.grid; if (/^icons\/icon_\d+\.object$/.test(id)) symbolScenes.add(id); }
    for (const [id, sp] of Object.entries(w.sprites)) { if (id.startsWith('icons/')) symbolSprites.add(id); if (sp.w * sp.h > 400 * 400) bigSprites.push([id, sp.w, sp.h]); }
  }
  const animStates = scenes.reduce((a, s) => a + s.anims.length, 0);
  const totalNodes = scenes.reduce((a, s) => a + s.nodes, 0);
  return { wads, scenes, sprites, videos: videos.length, videoNames: videos.map((v) => v.split('/').pop()), audio, fonts, textures, kb: Math.round(bytes / 1024), grid, symbols: symbolScenes.size || symbolSprites.size, animStates, totalNodes, bigSprites: bigSprites.sort((a, b) => b[1] * b[2] - a[1] * a[2]).slice(0, 5) };
}

// --- games ------------------------------------------------------------------------------------
const games = [];
const thumbJobs = [];
for (const d of fs.readdirSync('dl').filter((d) => /^game\d+$/.test(d)).sort((a, b) => +a.slice(4) - +b.slice(4))) {
  const dir = path.join('dl', d);
  const wadFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.wad.xml')).map((f) => path.join(dir, f));
  if (!wadFiles.length) continue;
  const rec = { id: d, title: titles[d]?.title || null, assetsVersion: titles[d]?.assetsVersion || null, level: titles[d]?.availableFromLevel ?? null, ...summarise(dir, wadFiles) };
  rec.features = Object.keys(rec.wads).map((w) => w.replace('.wad.xml', '')).filter((w) => !/^(slot|slot_bg|loading|newgame|icon1x[12](_gray|_anim)?|additional|items|bottom)$/.test(w));
  rec.sceneKinds = [...new Set(rec.scenes.map((s) => s.id.split('/')[0]))];
  const thumb = path.join(dir, 'icon1x1', 'atlas.rgba8888.webp');
  if (fs.existsSync(thumb)) { rec.thumb = `catalog/thumbs/${d}.webp`; thumbJobs.push([thumb, rec.thumb]); }
  games.push(rec);
}
// --- lobby features ---------------------------------------------------------------------------------
const lobby = [];
const walkDir = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walkDir(path.join(d, e.name)) : e.name.endsWith('.wad.xml') ? [path.join(d, e.name)] : []);
const byFeature = {};
for (const f of walkDir('dl/lobby_next_version')) { const rel = path.relative('dl/lobby_next_version', f); const feat = rel.startsWith('Features/') ? rel.split('/')[1] : rel.replace('.wad.xml', ''); (byFeature[feat] ||= []).push(f); }
for (const [feat, files] of Object.entries(byFeature).sort()) lobby.push({ id: feat, ...summarise('dl/lobby_next_version', files) });

// --- thumbnails (128 px) via PIL ------------------------------------------------------------------------
fs.mkdirSync('catalog/thumbs', { recursive: true });
execFileSync('python3', ['-c', `
import sys, json
from PIL import Image
for src, dst in json.load(sys.stdin):
    im = Image.open(src).convert('RGBA'); im.thumbnail((256, 256)); im.save(dst, 'WEBP', quality=80, method=4)
`], { input: JSON.stringify(thumbJobs.filter(([, dst]) => !fs.existsSync(dst))) });

const totals = {
  games: games.length, titled: games.filter((g) => g.title).length,
  scenes: games.reduce((a, g) => a + g.scenes.length, 0) + lobby.reduce((a, g) => a + g.scenes.length, 0),
  nodes: games.reduce((a, g) => a + g.totalNodes, 0) + lobby.reduce((a, g) => a + g.totalNodes, 0),
  sprites: games.reduce((a, g) => a + g.sprites, 0) + lobby.reduce((a, g) => a + g.sprites, 0),
  videos: games.reduce((a, g) => a + g.videos, 0) + lobby.reduce((a, g) => a + g.videos, 0),
  audio: games.reduce((a, g) => a + g.audio, 0) + lobby.reduce((a, g) => a + g.audio, 0),
  animStates: games.reduce((a, g) => a + g.animStates, 0) + lobby.reduce((a, g) => a + g.animStates, 0),
  lobbyFeatures: lobby.length,
};
fs.writeFileSync('catalog/catalog.json', JSON.stringify({ built: new Date().toISOString().slice(0, 10), totals, games, lobby }));
console.log(JSON.stringify(totals), `-> catalog/catalog.json (${(fs.statSync('catalog/catalog.json').size / 1048576).toFixed(1)} MB)`);
