import { chromium } from 'playwright-core';
const [file, ...times] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)); });
await page.goto('file://' + process.cwd() + '/' + file);
await page.waitForTimeout(1500);
await page.click('#replay');
let last = 0;
for (const t of times.map(Number)) { await page.waitForTimeout(t - last); last = t; await page.screenshot({ path: file.replace('.html', `-${t}.png`), clip: { x: 0, y: 60, width: 1200, height: 800 } }); }
await browser.close();
