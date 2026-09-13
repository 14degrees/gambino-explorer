import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
await page.goto('http://localhost:5173/#game:game101//slot%2Fscene_mobile.object'); await page.waitForTimeout(600); await page.click('.tabs button:nth-child(2)');
await page.waitForFunction(() => document.querySelectorAll('.right .st').length > 0, null, { timeout: 90000 }); await page.waitForTimeout(1500);
await page.selectOption('select[aria-label=Compose]', 'ingame'); await page.waitForTimeout(6000);
console.log(await page.evaluate(() => {
  const st = document.querySelector('.stage').getBoundingClientRect(); const k = 1366 / st.width; const out = [];
  for (const id of ['BackBtn', 'ProfileBtn', 'piggyHolder', 'PiggyBankBtn', 'coinsHolder', 'balanceBtn', 'BuyBtn', 'DealBtn', 'XPBoostBtn', 'ProgressBarBtn', 'InboxBtn', 'MenuBtn']) {
    const el = document.querySelector(`[data-id=${id}]`); if (!el) { out.push(id + ': -'); continue; }
    const sp = [...el.querySelectorAll('.spr')].filter((e) => e.getBoundingClientRect().width > 0 && !e.closest('[style*="display: none"]')); if (!sp.length) { out.push(id + ': hidden'); continue; }
    let x0 = 1e9, x1 = -1e9; for (const e of sp) { const r = e.getBoundingClientRect(); x0 = Math.min(x0, r.left); x1 = Math.max(x1, r.right); }
    out.push(`${id}: ${Math.round((x0 - st.left) * k)}..${Math.round((x1 - st.left) * k)}`);
  }
  return out.join('\n');
}));
await browser.close();
