import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
await page.goto('http://localhost:5173/play.html'); await page.waitForFunction(() => !document.querySelector('.loading'), null, { timeout: 90000 }); await page.waitForTimeout(800);
const hit = await page.$('.hit[title=spinBtn]'); const b = await hit.boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.mouse.up();
await page.waitForTimeout(9500);
console.log(await page.evaluate(() => {
  const w = window.__play; const id = (rt, n) => rt.scene.nodes.findIndex((x) => x.properties?.Id === n);
  const info = (name) => { const el = w.win.els[id(w.rWin, name)]; const g = el.querySelector('.spr'); const r = g ? g.getBoundingClientRect() : null; const cs = g ? getComputedStyle(g) : null; return `${name}: rect=${r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : '-'} vis=${cs?.visibility} op=${cs?.opacity} bg=${cs?.backgroundImage.slice(0, 40)} top=${g ? document.elementFromPoint(r.x + 2, r.y + 2)?.className : '-'}`; };
  return [info('WheelBonusTxt'), info('TotalWinTxt'), info('TierBonusTxt'), 'panel node props: ' + JSON.stringify(w.rWin.scene.nodes[id(w.rWin, 'panel')].properties), 'n174 props: ' + JSON.stringify(w.rWin.scene.nodes[174].properties)].join('\n');
}));
await page.screenshot({ path: 'play-win.png', clip: { x: 300, y: 380, width: 760, height: 260 } });
await browser.close();
