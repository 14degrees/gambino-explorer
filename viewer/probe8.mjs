import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
await page.goto('http://localhost:5173/#game:game101//slot%2Fscene_mobile.object');
await page.waitForTimeout(600); await page.click('.tabs button:nth-child(2)');
await page.waitForFunction(() => document.querySelectorAll('.right .st').length > 0, null, { timeout: 90000 }); await page.waitForTimeout(1500);
await page.selectOption('select[aria-label=Compose]', 'ingame'); await page.waitForTimeout(5000);
console.log(await page.evaluate(() => {
  const st = document.querySelector('.stage').getBoundingClientRect(); const k = 1366 / st.width;
  return [...document.querySelectorAll('.design > .scene')].map((s) => { const vis = [...s.querySelectorAll('.spr')].filter((e) => e.getBoundingClientRect().width > 0 && !e.closest('[style*="display: none"]')); if (!vis.length) return 'z=' + s.style.zIndex + ' none';
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const e of vis) { const r = e.getBoundingClientRect(); x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); }
    return `z=${s.style.zIndex} visible bbox in stage px: x ${Math.round((x0 - st.left) * k)}..${Math.round((x1 - st.left) * k)} y ${Math.round((y0 - st.top) * k)}..${Math.round((y1 - st.top) * k)}`; }).join('\n');
}));
await browser.close();
