// Inline catalog.json and the thumbnails into the catalogue page.
import fs from 'node:fs';
const c = JSON.parse(fs.readFileSync('catalog/catalog.json', 'utf8'));
const thumbs = {};
for (const g of c.games) if (g.thumb && fs.existsSync(g.thumb)) thumbs[g.id] = 'data:image/webp;base64,' + fs.readFileSync(g.thumb).toString('base64');
// the page does not need per-scene node ids or the thumb path
for (const g of c.games) { delete g.thumb; for (const s of g.scenes) delete s.ids; }
for (const l of c.lobby) for (const s of l.scenes) delete s.ids;
const html = fs.readFileSync('catalog/template.html', 'utf8')
  .replace('__BUILT__', c.built)
  .replace('/*__DATA__*/null', JSON.stringify(c))
  .replace('/*__THUMBS__*/{}', JSON.stringify(thumbs));
fs.writeFileSync('catalog/gambino-catalog.html', html);
console.log('catalog/gambino-catalog.html', (html.length / 1048576).toFixed(1), 'MB,', Object.keys(thumbs).length, 'thumbs');
