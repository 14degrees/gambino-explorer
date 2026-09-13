// Run the lobby and save JSON bodies from the game API so we can map gameNNN -> title.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
fs.mkdirSync('api', { recursive: true });
let i = 0;
page.on('response', async (r) => {
  const u = r.url();
  if (!/appspot\.com|gambinoslot\.com|onlinefungames\.net\/browser\/(?!assets)/.test(u)) return;
  const ct = r.headers()['content-type'] || '';
  if (!/json|text|xml/.test(ct)) return;
  try {
    const body = await r.text();
    const name = `api/${String(++i).padStart(3,'0')}_${new URL(u).pathname.replace(/[^a-z0-9]+/gi,'_').slice(0,80)}.txt`;
    fs.writeFileSync(name, `URL: ${u}\n\n${body}`);
  } catch {}
});
await page.goto('https://game.onlinefungames.net/browser/index.html?cid=gbclidf4f7c31cc78ec152', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(30000);
await browser.close();
console.log('saved', i, 'api bodies');
