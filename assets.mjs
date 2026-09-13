// Browse Gambino's asset tree from the public map.json + .wad.xml manifests.
//
//   node assets.mjs games                 list game ids present in the map
//   node assets.mjs list game117          list a game's wads and the files each references
//   node assets.mjs fetch game117 slot    download game117/slot.wad.xml + every file it references
//   node assets.mjs get <map key>         download any wad by logical path (lobby features etc.)
//
// Everything is fetched from the same public paths the browser client uses.
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://game.onlinefungames.net/browser/';
const MAP = 'assets/en.low.master_1438c33c6a97863445a7b44a76a92d819a0ddb8e.map.json';
const UA = { 'User-Agent': 'Mozilla/5.0' };

async function map() {
  if (!fs.existsSync('map.json')) {
    fs.writeFileSync('map.json', await (await fetch(BASE + MAP, { headers: UA })).text());
  }
  return JSON.parse(fs.readFileSync('map.json', 'utf8'));
}

// A wad is XML wrapping JSON blobs; we only need the <source path=""> / <webgl path=""> refs.
function refsInWad(xml) {
  const out = new Set();
  for (const m of xml.matchAll(/<(?:source|webgl) path="([^"]+)" type="([^"]+)"/g)) out.add(m[1] + '\t' + m[2]);
  return [...out].map((s) => { const [p, t] = s.split('\t'); return { path: p, type: t }; });
}

const [cmd, gameId, wadName] = process.argv.slice(2);
const m = await map();

if (cmd === 'games') {
  const g = {};
  for (const k of Object.keys(m)) { const x = k.match(/games\/(game\d+)\//); if (x) g[x[1]] = (g[x[1]] || 0) + 1; }
  for (const [id, n] of Object.entries(g).sort((a, b) => b[1] - a[1])) console.log(id.padEnd(10), n, 'entries');
} else if (cmd === 'list' && gameId) {
  const prefix = `assets/en/low/games/${gameId}/`;
  const wads = Object.keys(m).filter((k) => k.startsWith(prefix) && k.endsWith('.wad.xml'));
  for (const w of wads) {
    const xml = await (await fetch(BASE + m[w], { headers: UA })).text();
    const refs = refsInWad(xml);
    console.log(`\n${w.slice(prefix.length)}  (${refs.length} files)`);
    for (const r of refs) console.log('  ', r.type.padEnd(12), r.path.slice(prefix.length));
  }
} else if (cmd === 'get' && gameId) {
  // download any wad by its logical map key, e.g. lobby_next_version/Features/WheelOfWins/WheelOfWins.wad.xml
  const key = 'assets/en/low/' + gameId;
  if (!m[key]) { console.error('no such key in map:', key); process.exit(1); }
  const outDir = path.join('dl', path.dirname(gameId));
  fs.mkdirSync(outDir, { recursive: true });
  const xml = await (await fetch(BASE + m[key], { headers: UA })).text();
  fs.writeFileSync(path.join(outDir, path.basename(gameId)), xml);
  const refs = refsInWad(xml).filter((r) => /webp|webm|ogg|ttf/.test(r.type) || /\.(webp|webm|ogg|ttf)$/.test(r.path));
  for (const r of refs) {
    const rel = r.path.replace('assets/en/low/', '').replace(/[0-9a-f]{32}\./, '');
    const dest = path.join('dl', rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const res = await fetch(BASE + r.path, { headers: UA });
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    console.log(res.status, rel);
  }
} else if (cmd === 'fetch' && gameId && wadName) {
  const key = `assets/en/low/games/${gameId}/${wadName}.wad.xml`;
  if (!m[key]) { console.error('no such wad in map:', key); process.exit(1); }
  const outDir = path.join('dl', gameId);
  fs.mkdirSync(outDir, { recursive: true });
  const xml = await (await fetch(BASE + m[key], { headers: UA })).text();
  fs.writeFileSync(path.join(outDir, `${wadName}.wad.xml`), xml);
  // Prefer the webp/webm variant when a file is offered in several encodings.
  const refs = refsInWad(xml).filter((r) => /webp|webm|ogg|ttf/.test(r.type) || /\.(webp|webm|ogg|ttf)$/.test(r.path));
  for (const r of refs) {
    const rel = r.path.replace(`assets/en/low/games/${gameId}/`, '').replace(/[0-9a-f]{32}\./, '');
    const dest = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const res = await fetch(BASE + r.path, { headers: UA });
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    console.log(res.status, rel);
  }
} else {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(0, 8).join('\n'));
}
