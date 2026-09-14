import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) console.log('CONSOLE', m.text().slice(0, 200)); });
await page.goto('http://localhost:5173/play.html');
await page.waitForFunction(() => !document.querySelector('.loading'), null, { timeout: 90000 }); await page.waitForTimeout(1500);
await page.screenshot({ path: 'play-0.png' });
const hit = await page.$('.hit[title=spinBtn]'); const b = await hit.boundingBox(); console.log('spin hit box:', b && `${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}`);
await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.mouse.up();
await page.waitForTimeout(1500); await page.screenshot({ path: 'play-1.png' });
await page.waitForTimeout(3500); await page.screenshot({ path: 'play-2.png' });
await page.waitForTimeout(3200); await page.screenshot({ path: 'play-3.png' });
console.log('hud:', await page.textContent('.hud'));
const c = await page.$('.hit[title=CollectBtn]'); const cb = c && await c.boundingBox(); console.log('collect box:', cb && `${Math.round(cb.x)},${Math.round(cb.y)}`);
if (cb) { await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(800); await page.screenshot({ path: 'play-4.png' }); console.log('hud:', await page.textContent('.hud')); }
await browser.close();
