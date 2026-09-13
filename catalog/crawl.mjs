// Fetch every .wad.xml manifest in the asset map (games + lobby) plus each game's lobby tile.
// Manifests only — no atlases, video or audio — so the whole catalogue is ~150 MB.
import fs from 'node:fs';
import path from 'node:path';
const BASE = 'https://game.onlinefungames.net/browser/';
const UA = { 'User-Agent': 'Mozilla/5.0' };
const m = JSON.parse(fs.readFileSync('map.json', 'utf8'));
const localOf = (key) => path.join('dl', key.replace(/^assets\/en\/low\/(games\/)?/, '').replace(/[0-9a-f]{32}\./, ''));
const keys = Object.keys(m).filter((k) => /\.wad\.xml$/.test(k) && /\/games\/game\d+\/|lobby_next_version\//.test(k));
let done = 0, skipped = 0, failed = 0;
async function get(url, dest) {
  if (fs.existsSync(dest)) { skipped++; return null; }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (!r.ok) throw new Error(r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf); done++;
      return buf;
    } catch (e) { if (attempt === 2) { failed++; console.log('FAIL', url, e.message); } else await new Promise((res) => setTimeout(res, 500 * (attempt + 1))); }
  }
  return null;
}
async function job(key) {
  const dest = localOf(key);
  let xml = await get(BASE + m[key], dest);
  if (/icon1x1\.wad\.xml$/.test(key)) { // the lobby tile doubles as the catalogue thumbnail
    xml ||= fs.readFileSync(dest, 'utf8');
    const src = /<source path="([^"]+\.webp)"/.exec(String(xml))?.[1];
    if (src) await get(BASE + src, localOf(src));
  }
}
const queue = [...keys]; const workers = Array.from({ length: 8 }, async () => { while (queue.length) await job(queue.shift()); });
const t0 = Date.now();
const tick = setInterval(() => console.log(`${done} fetched, ${skipped} cached, ${failed} failed, ${queue.length} left, ${((Date.now() - t0) / 1000).toFixed(0)}s`), 15000);
await Promise.all(workers); clearInterval(tick);
console.log(`done: ${done} fetched, ${skipped} cached, ${failed} failed in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
