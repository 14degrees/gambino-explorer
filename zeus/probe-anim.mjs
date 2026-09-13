import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('file://' + process.cwd() + '/zeus/game103-inspector.html');
await page.waitForTimeout(2000);
await page.selectOption('#scene', 'slot/jackpot/scene_mobile.object'); await page.waitForTimeout(500);
await page.click('button[data-tab="states"]');
const labels = await page.$$eval('#states .play', (bs) => bs.map((b) => b.dataset.label));
console.log('playable states:', labels);
// play the whole-popup 'jackpot0' state if present, else the first
const idx = Math.max(0, labels.findIndex((l) => l.startsWith('jackpot0')));
await page.$$eval('#states .play', (bs, i) => bs[i].click(), idx);
for (const ms of [0, 1300, 1700, 2600]) { await page.waitForTimeout(ms === 0 ? 50 : ms - (ms === 1300 ? 50 : ms === 1700 ? 1300 : 1700)); await page.screenshot({ path: `zeus/anim-${ms}.png`, clip: { x: 0, y: 60, width: 1000, height: 620 } }); }
console.log(await page.textContent('#playing'));
await browser.close();
