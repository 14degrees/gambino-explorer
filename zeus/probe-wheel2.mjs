import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('file://' + process.cwd() + '/zeus/bonuswheel-inspector.html');
await page.waitForTimeout(2000);
await page.click('button[data-tab="states"]');
console.log(await page.$eval('#states .empty', (e) => e.textContent));
console.log((await page.$$eval('#states .st', (els) => els.slice(0, 8).map((e) => e.querySelector('b').textContent + ' ' + e.querySelector('.dur').textContent))).join('\n'));
await page.click('#states .st.has-anim .play'); // first animated state
await page.waitForTimeout(400); await page.screenshot({ path: 'zeus/w1.png', clip: { x: 10, y: 60, width: 700, height: 420 } });
await page.waitForTimeout(900); await page.screenshot({ path: 'zeus/w2.png', clip: { x: 10, y: 60, width: 700, height: 420 } });
console.log(await page.textContent('#playing'));
await browser.close();
