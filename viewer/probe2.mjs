import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) console.log('CONSOLE', m.text().slice(0, 200)); });
// 1. deep link straight to Jackpot City's jackpot popup (auto-entrance should play it)
await page.goto('http://localhost:5173/#game:game103//slot%2Fjackpot%2Fscene_mobile.object');
await page.waitForFunction(() => document.querySelectorAll('.right .st').length > 0, null, { timeout: 60000 });
await page.waitForTimeout(2200);
console.log('player:', await page.textContent('.player .mono'));
await page.screenshot({ path: 'v2-popup.png' });
// 2. assets browser
await page.click('.seg button:nth-child(2)'); await page.waitForTimeout(1500);
await page.screenshot({ path: 'v2-atlases.png' });
await page.click('.atabs button:nth-child(2)'); await page.waitForTimeout(800);
await page.screenshot({ path: 'v2-sprites.png' });
await page.click('.atabs button:nth-child(3)'); await page.waitForTimeout(2500);
await page.screenshot({ path: 'v2-videos.png' });
// 3. tree highlight
await page.click('.seg button:nth-child(1)'); await page.waitForTimeout(500);
await page.click('.tabs button:nth-child(3)'); await page.waitForTimeout(300);
const rows = await page.$$('.trow'); await rows[3].click(); await page.waitForTimeout(300);
await page.screenshot({ path: 'v2-tree.png' });
// 4. sequence on the wheel: sector_3 then win
await page.goto('http://localhost:5173/#lobby:BonusWheel/BonusWheel.wad.xml/lobby%2FBonusWheel%2FsceneBonusWheel.object');
await page.waitForTimeout(800); await page.click('.tabs button:nth-child(2)');
await page.waitForFunction(() => document.querySelectorAll('.right .st').length > 0, null, { timeout: 60000 }); await page.waitForTimeout(1500);
const plus = await page.$$('.st .plus'); const labels = await page.$$eval('.st b', (b) => b.map((x) => x.textContent));
await plus[labels.indexOf('sector_3')].click(); await plus[labels.indexOf('win')].click();
console.log('seq:', await page.textContent('.seqbar span'));
await page.click('.seqbar .gold'); await page.waitForTimeout(900);
await page.screenshot({ path: 'v2-seq.png' });
await browser.close();
