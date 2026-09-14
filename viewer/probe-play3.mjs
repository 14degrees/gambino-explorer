import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
await page.goto('http://localhost:5173/play.html'); await page.waitForFunction(() => !document.querySelector('.loading'), null, { timeout: 90000 }); await page.waitForTimeout(800);
const hit = await page.$('.hit[title=spinBtn]'); const b = await hit.boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.mouse.up();
await page.waitForTimeout(8500);
console.log(await page.evaluate(() => {
  const w = window.__play; const id = (rt, n) => rt.scene.nodes.findIndex((x) => x.properties?.Id === n);
  const chain = (rt, built, name) => { let e = built.els[id(rt, name)]; const out = []; while (e && !e.classList.contains('scene')) { out.push(`${e.dataset.id || e.id}${e.style.display === 'none' ? '(hidden)' : ''}${e.style.opacity && e.style.opacity !== '1' ? '(op ' + e.style.opacity + ')' : ''}`); e = e.parentElement; } return out.join(' < '); };
  const out = ['WheelBonusTxt: ' + chain(w.rWin, w.win, 'WheelBonusTxt')];
  out.push('infoPanel=' + w.rWin.stateId(id(w.rWin, 'infoPanel')) + ' PopupWinStates=' + w.rWin.stateId(id(w.rWin, 'PopupWinStates')) + ' winPanel=' + w.rWin.stateId(id(w.rWin, 'winPanel')));
  const sp = w.win.els[id(w.rWin, 'WheelBonusTxt')].querySelectorAll('.spr').length; out.push('glyphs in WheelBonusTxt: ' + sp);
  out.push('mega icon: ' + (() => { const n = id(w.rWheel, 'BonusWin_0'); const el = w.wheel.els[n]; return [...el.querySelectorAll('.spr')].map((s) => (s.closest('[style*="display: none"]') ? 'hidden' : 'shown') + ':' + (s.style.backgroundPosition)).join(', '); })());
  out.push('win log: ' + w.rWin.log.slice(-6).join(' | '));
  return out.join('\n');
}));
await browser.close();
