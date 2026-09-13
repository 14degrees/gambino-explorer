import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
await page.goto('http://localhost:5173/#game:game101//slot%2Fscene_mobile.object'); await page.waitForTimeout(600); await page.click('.tabs button:nth-child(2)');
await page.waitForFunction(() => document.querySelectorAll('.right .st').length > 0, null, { timeout: 90000 }); await page.waitForTimeout(1500);
await page.selectOption('select[aria-label=Compose]', 'ingame'); await page.waitForTimeout(6000);
console.log(await page.evaluate(() => {
  const h = document.querySelector('.hit[title=BackBtn]'); const r = h.getBoundingClientRect(); const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
  const top = document.elementFromPoint(cx, cy); const frame = document.querySelector('.frame').getBoundingClientRect();
  const chain = []; let p = top; while (p && chain.length < 6) { chain.push(`${p.tagName}.${p.className.toString().split(' ')[0]}#${p.dataset?.id || p.id || ''} title=${p.title || ''}`); p = p.parentElement; }
  return `hit centre ${Math.round(cx)},${Math.round(cy)} frame top ${Math.round(frame.y)} → topmost: ${chain.join(' < ')}`;
}));
await browser.close();
