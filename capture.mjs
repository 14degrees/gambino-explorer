// Load the game in headless Chrome and log every request it makes.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
const seen = [];
page.on('response', async (r) => {
  const req = r.request();
  const h = r.headers();
  seen.push({
    url: r.url(),
    status: r.status(),
    type: req.resourceType(),
    ct: h['content-type'] || '',
    len: h['content-length'] || '',
  });
});
page.on('console', (m) => {
  const t = m.text();
  if (/MapJson|wad|atlas|Loading|load/i.test(t)) console.log('[console]', t.slice(0, 200));
});
await page.goto('https://game.onlinefungames.net/browser/index.html?cid=gbclidf4f7c31cc78ec152', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(45000);
await page.screenshot({ path: 'shot1.png' });
fs.writeFileSync('requests.json', JSON.stringify(seen, null, 2));
console.log('captured', seen.length, 'responses');
await browser.close();
