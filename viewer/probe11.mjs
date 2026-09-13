import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:5173/'); await page.waitForTimeout(1200);
await page.click('.lobby-entry'); await page.waitForTimeout(7000);
const hits = await page.$$eval('.hit', (h) => h.map((x) => x.title));
console.log('hit boxes:', hits.length, hits.slice(0, 12).join(', '));
// hover + press the G-WHEEELZ dock button
const gw = await page.$('.hit[title=GWheelsBtn]'); const box = await gw.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(300);
await page.screenshot({ path: 'i-hover.png', clip: { x: 140, y: 30, width: 900, height: 560 } });
await page.mouse.down(); await page.waitForTimeout(200);
await page.screenshot({ path: 'i-down.png', clip: { x: 140, y: 30, width: 900, height: 560 } });
await page.mouse.up(); await page.waitForTimeout(400);
console.log('events:', await page.$$eval('.events div', (d) => d.map((x) => x.textContent).join(' | ')));
// click a tile → should open the game with the wrapper
await page.click('.tile-lobby'); await page.waitForTimeout(8000);
console.log('after tile click:', await page.textContent('.crumb b'), '| compose:', await page.$eval('select[aria-label=Compose]', (s) => s.value));
await page.screenshot({ path: 'i-game.png', clip: { x: 140, y: 30, width: 900, height: 560 } });
// Back button in the top bar → lobby
await page.screenshot({ path: 'i-game.png', clip: { x: 140, y: 30, width: 900, height: 560 } });
const back = await page.$('.hit[title=BackBtn]'); const bb = back && await back.boundingBox(); console.log('back box:', bb && `${Math.round(bb.x)},${Math.round(bb.y)} ${Math.round(bb.width)}x${Math.round(bb.height)}`);
if (bb) { await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(1500); console.log('events after back:', await page.$$eval('.events div', (d) => d.map((x) => x.textContent).join(' | '))); await page.waitForTimeout(5000); console.log('after back:', await page.textContent('.crumb b')); }
await browser.close();
