import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
for (const [hash, out] of [['#lobby:lobby/lobby.wad.xml/lobby%2FPanels%2FTop%2Fscene16x9.object', 'lobby-top.png'], ['#lobby:LobbyMain/LobbyMain.wad.xml/LobbyMain%2FsceneGames16x9.object', 'lobby-games.png'], ['#lobby:login/login.wad.xml/lobby%2Flogin%2FsceneLoginScreen16x9.object', 'lobby-login.png']]) {
  await page.goto('http://localhost:5173/' + hash); await page.waitForTimeout(600); await page.click('.tabs button:nth-child(2)');
  await page.waitForFunction(() => document.querySelectorAll('.right .st').length > 0 || /failed/.test(document.querySelector('.crumb span')?.textContent || ''), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(4000);
  console.log(hash.split('/').pop(), '→', await page.textContent('.crumb span'), '|', await page.textContent('.player .mono'));
  await page.screenshot({ path: out, clip: { x: 140, y: 30, width: 900, height: 560 } });
}
await browser.close();
