import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:5173/#game:game101//slot%2Fscene_mobile.object'); // Big 5 Africa, like the screenshot
await page.waitForTimeout(600); await page.click('.tabs button:nth-child(2)');
await page.waitForFunction(() => document.querySelectorAll('.right .st').length > 0, null, { timeout: 90000 }); await page.waitForTimeout(2000);
await page.selectOption('select[aria-label=Compose]', 'ingame'); await page.waitForTimeout(6000);
await page.screenshot({ path: 'c-ingame.png', clip: { x: 140, y: 30, width: 900, height: 560 } });
await page.selectOption('select[aria-label=Compose]', 'lobby'); await page.waitForTimeout(6000);
await page.screenshot({ path: 'c-lobby.png', clip: { x: 140, y: 30, width: 900, height: 560 } });
await browser.close();
