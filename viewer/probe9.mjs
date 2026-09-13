import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
await page.goto('http://localhost:5173/#game:game101//slot%2Fscene_mobile.object');
await page.waitForTimeout(600); await page.click('.tabs button:nth-child(2)');
await page.waitForFunction(() => document.querySelectorAll('.right .st').length > 0, null, { timeout: 90000 }); await page.waitForTimeout(1500);
await page.selectOption('select[aria-label=Compose]', 'lobby'); await page.waitForTimeout(6000);
console.log(await page.evaluate(() => {
  const t = document.querySelector('.tile-lobby'); const r = t.getBoundingClientRect(); const cs = getComputedStyle(t);
  const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  const chain = []; let p = t; while (p && !p.classList.contains('design')) { const c = getComputedStyle(p); chain.push(`${p.className.split(' ')[0]}#${p.dataset?.id || p.id || ''} z=${c.zIndex} disp=${c.display} op=${c.opacity} mask=${c.maskImage !== 'none'} ovf=${c.overflow} tf=${c.transform.slice(0, 30)}`); p = p.parentElement; }
  return `tile rect ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)} bg=${cs.backgroundImage.slice(0, 50)}\ntopmost at centre: ${top?.className} #${top?.dataset?.id || top?.id}\nancestors:\n  ${chain.join('\n  ')}`;
}));
await browser.close();
