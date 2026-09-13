import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto('http://localhost:5173/#game:game101//slot%2Fscene_mobile.object'); await page.waitForTimeout(600); await page.click('.tabs button:nth-child(2)');
await page.waitForFunction(() => document.querySelectorAll('.right .st').length > 0, null, { timeout: 90000 }); await page.waitForTimeout(1500);
await page.selectOption('select[aria-label=Compose]', 'ingame'); await page.waitForTimeout(6000);
console.log(await page.evaluate(() => {
  const rts = window.__rt; const top = rts.find((r) => r.name.includes('Top'));
  if (!top) return 'runtimes: ' + rts.map((r) => r.name).join(', ');
  const byId = (id) => top.scene.nodes.findIndex((n) => n.properties?.Id === id);
  const tpm = byId('TopPanelMode'), lbs = byId('LeftBtnStates');
  const before = `TopPanelMode[${tpm}]=${top.stateId(tpm)} LeftBtnStates[${lbs}]=${top.stateId(lbs)}`;
  const ok1 = top.send(tpm, 'game'), ok2 = top.send(lbs, 'btn_back');
  return `${before}\nsend game → ${ok1} now ${top.stateId(tpm)}; send btn_back → ${ok2} now ${top.stateId(lbs)}\nlog: ${top.log.slice(-4).join(' | ')}\nBackBtn display: ${document.querySelector('[data-id=BackBtn]')?.style.display}`;
}));
await page.waitForTimeout(800);
console.log('BackBtn display after 800ms:', await page.$eval('[data-id=BackBtn]', (e) => e.style.display + ' / hit visible=' + !!e.querySelector('.hit')?.offsetParent));
await browser.close();
