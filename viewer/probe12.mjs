import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:5173/#game:game101//slot%2Fscene_mobile.object'); await page.waitForTimeout(600); await page.click('.tabs button:nth-child(2)');
await page.waitForFunction(() => document.querySelectorAll('.right .st').length > 0, null, { timeout: 90000 }); await page.waitForTimeout(1500);
await page.selectOption('select[aria-label=Compose]', 'ingame'); await page.waitForTimeout(6000);
console.log(await page.evaluate(() => {
  const el = [...document.querySelectorAll('[data-id=BackBtn]')][0]; if (!el) return 'no BackBtn element';
  const chain = []; let p = el; while (p && !p.classList.contains('design')) { chain.push(`${p.dataset.id || p.id || p.className.split(' ')[0]} disp=${p.style.display || '-'} op=${p.style.opacity || '-'}`); p = p.parentElement; }
  return chain.join('\n');
}));
console.log('events:', await page.$$eval('.events div', (d) => d.map((x) => x.textContent).join(' | ')));
await browser.close();
