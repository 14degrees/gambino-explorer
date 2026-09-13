import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 })).newPage();
await page.goto('file://' + process.cwd() + '/report/gambino-teardown.html');
await page.waitForTimeout(1500);
await page.screenshot({ path: 'report/preview.png', fullPage: true });
await browser.close();
