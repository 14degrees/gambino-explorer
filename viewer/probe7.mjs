import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
const errs = []; page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
await page.goto('http://localhost:5173/#game:game101//slot%2Fscene_mobile.object');
await page.waitForTimeout(600); await page.click('.tabs button:nth-child(2)');
await page.waitForFunction(() => document.querySelectorAll('.right .st').length > 0, null, { timeout: 90000 }); await page.waitForTimeout(1500);
await page.selectOption('select[aria-label=Compose]', 'lobby'); await page.waitForTimeout(6000);
console.log(await page.evaluate(() => {
  const info = (sel) => { const el = document.querySelector(sel); if (!el) return sel + ': MISSING'; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return `${sel}: kids=${el.children.length} display=${cs.display} mask=${cs.maskImage.slice(0, 40)} rect=${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`; };
  return [info('[data-id=GamesScrollingArea]'), info('[data-id=maskScrollSize]'), info('[data-id=TopPanelContainer]'), info('.tile-lobby'), 'tiles=' + document.querySelectorAll('.tile-lobby').length, 'scenes=' + document.querySelectorAll('.design > .scene').length].join('\n');
}));
console.log('errors:', [...new Set(errs)].slice(0, 6).join('\n'));
await page.selectOption('select[aria-label=Compose]', 'ingame'); await page.waitForTimeout(5000);
console.log(await page.evaluate(() => { const sc = [...document.querySelectorAll('.design > .scene')]; return sc.map((s) => { const r = s.getBoundingClientRect(); const ids = [...s.querySelectorAll('[data-id]')].slice(0, 3).map((e) => e.dataset.id); return `scene z=${s.style.zIndex} sprites=${s.querySelectorAll('.spr').length} visible=${[...s.querySelectorAll('.spr')].filter((e) => e.getBoundingClientRect().width > 0 && !e.closest('[style*="display: none"]')).length} ids=${ids}`; }).join('\n'); }));
await browser.close();
