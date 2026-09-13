// Pack a game's slot.wad.xml (scenes, sprite sheets, fonts, textures, video stills)
// into one self-contained inspector page:  node zeus/build.mjs game154
// Needs dl/<game>/ from `node assets.mjs fetch <game> slot`.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Either a game id (uses dl/<game>/slot.wad.xml + slot_bg.wad.xml) or
//   --wad dl/lobby_next_version/BonusWheel.wad.xml --main lobby/BonusWheel/sceneBonusWheel.object --title "Bonus Wheel" --out zeus/bonuswheel-inspector.html
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const game = argv.find((a) => /^game\d+$/.test(a)) || (opt('--wad') ? path.basename(opt('--wad'), '.wad.xml') : 'game154');
const dir = `dl/${game}`;
// slot_bg.wad.xml (the machine backdrop) is merged in when it has been fetched.
const wad = opt('--wad')
  ? fs.readFileSync(opt('--wad'), 'utf8')
  : ['slot', 'slot_bg'].filter((w) => fs.existsSync(`${dir}/${w}.wad.xml`)).map((w) => fs.readFileSync(`${dir}/${w}.wad.xml`, 'utf8')).join('\n');
const tmp = `zeus/tmp/${game}`; fs.mkdirSync(tmp, { recursive: true });
const stillsDir = `zeus/stills/${game}`; fs.mkdirSync(stillsDir, { recursive: true });

const catalogue = JSON.parse(fs.readFileSync('games.json', 'utf8'));
const title = opt('--title') || Object.entries(catalogue).find(([k]) => k.endsWith('/' + game))?.[1].title || game;

const blocks = (tag) => [...wad.matchAll(new RegExp(`<${tag} id="([^"]+)">(.*?)</${tag}>`, 'gs'))];

// scenes ---------------------------------------------------------------------
const scenes = {};
for (const [, id, body] of blocks('scene')) scenes[id] = JSON.parse(body).resource;
// the browser client instantiates slot/scene_mobile (gambino.dart.js: c8("slot/scene_mobile"))
const main = opt('--main') || ['slot/scene_mobile.object', 'slot/scene.object'].find((k) => scenes[k]) || Object.keys(scenes).find((k) => k.startsWith('slot/scene')) || Object.keys(scenes)[0];
const backdrop = ['slot_bg/scene.object', 'slot_bg/scene_mobile.object'].find((k) => scenes[k]) || Object.keys(scenes).find((k) => k.startsWith('slot_bg/')) || null;

// sprite frame sheets ----------------------------------------------------------
const sprites = {};
for (const [, id, body] of blocks('sprite')) sprites[id] = JSON.parse(body).resource;

// fonts (BMFont XML) -------------------------------------------------------------
const fonts = {};
for (const [, id, body] of blocks('font')) {
  const common = /<common base="(\d+)" lineHeight="(\d+)"/.exec(body);
  const page = /<page file="([^"]+)"/.exec(body)[1];
  const chars = {};
  for (const m of body.matchAll(/<char ([^>]*)\/>/g)) {
    const a = Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map(([, k, v]) => [k, Number(v)]));
    chars[a.id] = { x: a.x ?? 0, y: a.y ?? 0, w: a.width ?? 0, h: a.height ?? 0, xo: a.xoffset ?? 0, yo: a.yoffset ?? 0, xa: a.xadvance ?? 0 };
  }
  fonts[id] = { base: +common[1], lineHeight: +common[2], page, chars };
}

// textures: wad id (.png) -> local webp -> data URI ---------------------------------
const b64 = (f, mime) => `data:${mime};base64,${fs.readFileSync(f).toString('base64')}`;
// assets/en/low/games/game154/slot/x -> dl/game154/slot/x ; assets/en/low/lobby_next_version/y -> dl/lobby_next_version/y
const localOf = (src) => path.join('dl', src.replace(/^assets\/en\/low\/(games\/)?/, '').replace(/[0-9a-f]{32}\./, ''));
const textures = {};
const maskIds = new Set();
for (const r of Object.values(scenes)) for (const n of r.nodes) if (n.type === 'mask') maskIds.add(n.properties.TextureName);
for (const [, id, body] of blocks('texture')) {
  // ids are logical (slot/jackpot/atlas…); the file lives where the webp <source> says.
  const src = /<source path="([^"]+\.webp)"/.exec(body)?.[1];
  if (!src) { console.warn('no webp source for', id); continue; }
  const local = localOf(src);
  if (!fs.existsSync(local)) { console.warn('missing', local); continue; }
  if (maskIds.has(id)) {
    // The shader multiplies by the mask's red channel; Canvas2D destination-in wants alpha.
    // Bake red -> alpha so the page can composite masks natively.
    const out = path.join(tmp, id.replace(/[\/ ]/g, '_') + '.png');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', local, '-filter_complex',
      '[0:v]format=rgba,split[c][g];[g]format=gray[a];[c][a]alphamerge,format=rgba', out]);
    textures[id] = b64(out, 'image/png');
  } else {
    textures[id] = b64(local, 'image/webp');
  }
}

// first frames of the videos, RGB|alpha halves merged into real transparency ------------
const stills = {};
for (const [, id, body] of blocks('video')) {
  const src = /<webgl path="([^"]+\.webm)"/.exec(body)?.[1];
  if (!src) continue;
  const local = localOf(src); if (!fs.existsSync(local)) { console.warn('missing', local); continue; }
  const base = id.split('/').pop().replace(/\.bik$/, '');
  const png = path.join(stillsDir, base + '.png'), webp = path.join(stillsDir, base + '.webp');
  if (!fs.existsSync(webp)) {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', local, '-filter_complex',
      '[0:v]crop=iw/2:ih:0:0[rgb];[0:v]crop=iw/2:ih:iw/2:0,format=gray[a];[rgb][a]alphamerge,format=rgba', '-frames:v', '1', png]);
    execFileSync('cwebp', ['-quiet', '-q', '85', png, '-o', webp]);
  }
  stills[id] = b64(webp, 'image/webp');
}

const data = { game, title, main, backdrop, scenes, sprites, fonts, textures, stills };
const html = fs.readFileSync('zeus/template.html', 'utf8')
  .replaceAll('__TITLE__', title.replace(/[:].*$/, '').trim())
  .replace('__SUBTITLE__', opt('--wad') ? `${title} · ${path.basename(opt('--wad'))}` : `${title} · ${game} · slot.wad.xml`)
  .replace('/*__DATA__*/null', JSON.stringify(data));
const out = opt('--out') || `zeus/${game}-inspector.html`;
fs.writeFileSync(out, html);
console.log(`${title}: scenes ${Object.keys(scenes).length}, sprites ${Object.keys(sprites).length}, fonts ${Object.keys(fonts).length}, textures ${Object.keys(textures).length}, stills ${Object.keys(stills).length}, main ${main}`);
console.log(out, (html.length / 1048576).toFixed(1), 'MB');
