// cold-open a popup for a game whose art is NOT cached yet and confirm the entrance plays visibly
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
const [gameId, sceneId] = [process.argv[2] || 'game165', process.argv[3] || 'slot/popups/start_freespins/scene_mobile.object'];
await page.goto(`http://localhost:5173/#game:${gameId}//${encodeURIComponent(sceneId)}`);
await page.waitForTimeout(600); await page.click('.tabs button:nth-child(2)');
const t0 = Date.now();
await page.waitForFunction(() => /·/.test(document.querySelector('.player .mono')?.textContent || '') && !/loading/.test(document.querySelector('.crumb span')?.textContent || ''), null, { timeout: 90000 });
console.log('ready after', Date.now() - t0, 'ms →', await page.textContent('.crumb span'));
await page.waitForFunction(() => /once/.test(document.querySelector('.player .mono')?.textContent || ''), null, { timeout: 30000 }).catch(() => console.log('no auto-entrance'));
console.log('player:', await page.textContent('.player .mono'));
await page.waitForTimeout(500); await page.screenshot({ path: 'v4-a.png', clip: { x: 140, y: 30, width: 900, height: 560 } });
await page.waitForTimeout(1200); await page.screenshot({ path: 'v4-b.png', clip: { x: 140, y: 30, width: 900, height: 560 } });
await browser.close();
