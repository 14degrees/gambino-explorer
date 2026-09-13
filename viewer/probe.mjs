import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
await page.goto('http://localhost:5173/'); await page.waitForTimeout(1500);
const target = process.argv[2] || 'Saving Christmas';
await page.fill('.side-search input', target); await page.waitForTimeout(300);
await page.click('.item'); 
await page.waitForFunction(() => document.querySelectorAll('.right .st').length > 0, null, { timeout: 60000 });
await page.waitForTimeout(2500);
console.log('status:', await page.textContent('header .mono'));
await page.screenshot({ path: "shot-rest.png" }); if (process.argv[3]) { await page.selectOption("header select[aria-label=Scene]", process.argv[3]); await page.waitForTimeout(2500); await page.screenshot({ path: "shot-rest.png" }); }
const first = await page.$('.right .st:not(.instant) .play');
if (first) { await first.click(); await page.waitForTimeout(700); await page.screenshot({ path: 'shot-anim.png' }); console.log('playing:', await page.textContent('.bar .mono')); }
await browser.close();
