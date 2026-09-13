import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:5173/'); await page.waitForTimeout(1200);
await page.click('.lobby-entry'); await page.waitForTimeout(8000);
await page.screenshot({ path: 'c-lobby2.png', clip: { x: 140, y: 30, width: 900, height: 560 } });
await browser.close();
