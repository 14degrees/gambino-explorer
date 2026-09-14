import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
await page.goto('http://localhost:5173/play.html'); await page.waitForFunction(() => !document.querySelector('.loading'), null, { timeout: 90000 }); await page.waitForTimeout(800);
console.log(await page.evaluate(() => {
  const w = window.__play; const id = (rt, n) => rt.scene.nodes.findIndex((x) => x.properties?.Id === n);
  const b0 = id(w.rWheel, 'BonusWin_0'); const S = w.rWheel.scene.states;
  const leaves = (si) => { const st = S[si]; return st.children?.length ? st.children.flatMap(leaves) : [st.id]; };
  const out = [`BonusWin_0 node ${b0} sm=${w.rWheel.scene.nodes[b0].stateMachine} states=${leaves(w.rWheel.scene.nodes[b0].stateMachine)} now=${w.rWheel.stateId(b0)}`];
  out.push('send mega_wheel → ' + w.rWheel.send(b0, 'mega_wheel') + ' now=' + w.rWheel.stateId(b0));
  out.push('wheel log: ' + w.rWheel.log.slice(-3).join(' | '));
  // win popup: panel chain after 'show'
  const p = id(w.rWin, 'panel'); const el = w.win.els[p]; const chain = []; let e = el; while (e && !e.classList.contains('scene')) { chain.push(`${e.dataset.id || e.id} disp=${e.style.display || '-'} op=${e.style.opacity || '-'}`); e = e.parentElement; }
  out.push('panel chain: ' + chain.join(' < '));
  const shellBg = w.shell.els.find((x, i) => x && w.rShell.scene.nodes[i].type === 'sprite' && /Bitmap 35/.test(w.rShell.scene.nodes[i].properties?.SpriteName || ''));
  const bgIdx = w.shell.els.indexOf(shellBg); const n = w.rShell.scene.nodes[bgIdx]; let q = bgIdx; const tints = [];
  const parentOf = (i) => w.rShell.scene.nodes.findIndex((x) => (x.children || []).includes(i));
  while (q >= 0) { const c = w.rShell.scene.nodes[q].properties?.Color; if (c) tints.push(`${w.rShell.scene.nodes[q].properties?.Id || 'n' + q}:${JSON.stringify(c)}`); q = parentOf(q); }
  out.push('shell bg sprite node ' + bgIdx + ' tints up the chain: ' + tints.join(' ; '));
  return out.join('\n');
}));
await browser.close();
