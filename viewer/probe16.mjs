import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:5173/#lobby:BonusWheel/BonusWheel.wad.xml/lobby%2FBonusWheel%2FsceneFreeWheel.object'); await page.waitForTimeout(800); await page.click('.tabs button:nth-child(2)');
await page.waitForFunction(() => document.querySelectorAll('.right .st').length > 0, null, { timeout: 60000 }); await page.waitForTimeout(2500);
const rows = await page.$$eval('.right .st', (els) => els.map((e) => e.querySelector('b').textContent + ' / ' + e.querySelector('small').textContent.split(' ·')[0] + ' / ' + e.querySelector('.dur').textContent));
console.log(rows.filter((r) => /lamps/.test(r)).join('\n'));
const i = rows.findIndex((r) => /^spin \/ #lamps/.test(r)); const plays = await page.$$('.right .st .play'); await plays[i].click();
for (const t of [300, 700]) { await page.waitForTimeout(t); await page.screenshot({ path: `lamps-${t}.png`, clip: { x: 300, y: 70, width: 560, height: 520 } }); }
await browser.close();
