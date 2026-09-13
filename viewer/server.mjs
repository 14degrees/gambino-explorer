// Asset server for the viewer. /cdn/<path> serves a file from ../dl if we already have it,
// otherwise fetches it once from Gambino's CDN and keeps it. Also serves the catalogue, the
// asset map, thumbnails, and (with --serve-dist) the built client.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..');
const BASE = 'https://game.onlinefungames.net/browser/';
const UA = { 'User-Agent': 'Mozilla/5.0' };
const app = express();
const localOf = (p) => path.join(ROOT, 'dl', p.replace(/^assets\/en\/low\/(games\/)?/, '').replace(/[0-9a-f]{32}\./, ''));
const types = { '.xml': 'application/xml', '.webp': 'image/webp', '.png': 'image/png', '.webm': 'video/webm', '.mp4': 'video/mp4', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.ttf': 'font/ttf', '.json': 'application/json' };
const inflight = new Map();
app.get(/^\/cdn\/(.+)$/, async (req, res) => {
  const rel = decodeURIComponent(req.params[0]); if (rel.includes('..')) return res.status(400).end();
  const local = localOf(rel);
  if (!fs.existsSync(local)) {
    const key = local;
    if (!inflight.has(key)) inflight.set(key, (async () => {
      const r = await fetch(BASE + rel, { headers: UA });
      if (!r.ok) throw new Error(`${r.status} ${rel}`);
      fs.mkdirSync(path.dirname(local), { recursive: true });
      fs.writeFileSync(local, Buffer.from(await r.arrayBuffer()));
      console.log('cached', rel);
    })().finally(() => inflight.delete(key)));
    try { await inflight.get(key); } catch (e) { return res.status(502).send(String(e.message)); }
  }
  res.type(types[path.extname(local).toLowerCase()] || 'application/octet-stream');
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  fs.createReadStream(local).pipe(res);
});
app.get('/catalog.json', (_, res) => res.sendFile(path.join(ROOT, 'catalog', 'catalog.json')));
app.get('/map.json', (_, res) => res.sendFile(path.join(ROOT, 'map.json')));
app.use('/thumbs', express.static(path.join(ROOT, 'catalog', 'thumbs'), { immutable: true, maxAge: '1y' }));
if (process.argv.includes('--serve-dist')) app.use(express.static(path.join(import.meta.dirname, 'dist')));
app.listen(8787, () => console.log('asset server on http://localhost:8787' + (process.argv.includes('--serve-dist') ? ' (serving dist/)' : '')));
