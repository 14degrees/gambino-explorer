import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('file://' + process.cwd() + '/zeus/game103-inspector.html');
await page.waitForTimeout(2000);
const info = await page.evaluate(() => {
  const r = D.scenes[MAIN]; const ov = initialProps(MAIN);
  const out = {};
  for (const i of [34, 33, 101, 100, 32, 31, 124, 121, 8, 7, 157, 158]) out[i] = { props: r.nodes[i].properties, init: ov[i] || null, sm: r.nodes[i].stateMachine ?? null, acts: r.nodes[i].actions || null };
  return { out, tex: Object.keys(img).filter((k) => k.startsWith('t:slot/atlas')).map((k) => [k, img[k].width, img[k].height]) };
});
console.log(JSON.stringify(info, null, 1));
await page.uncheck('#initial'); await page.waitForTimeout(500);
await page.screenshot({ path: 'zeus/preview-raw.png' });
await browser.close();
