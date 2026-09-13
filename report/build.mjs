// Inline the figures as data URIs so the page ships as one file.
import fs from 'node:fs';
const b64 = (f, mime) => `data:${mime};base64,${fs.readFileSync(f).toString('base64')}`;
let html = fs.readFileSync('report/template.html', 'utf8')
  .replace('{{ATLAS}}', b64('report/atlas.webp', 'image/webp'))
  .replace('{{FRAME}}', b64('report/frame.jpg', 'image/jpeg'))
  .replace('{{AEICONS}}', b64('report/ae-icons.webp', 'image/webp'));
fs.writeFileSync('report/gambino-teardown.html', html);
console.log('wrote', (html.length / 1024).toFixed(0), 'KB');
