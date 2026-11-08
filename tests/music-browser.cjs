// Real MP3 decoding and state transitions, including an isolated offline export.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict'), { pathToFileURL } = require('node:url');
const { chromium } = require('./browser-support.cjs'), { createServer } = require('../scripts/serve.cjs');
(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'beach-music-'));
  fs.copyFileSync(path.join(__dirname, '../release/index1.html'), path.join(temp, 'index.html'));
  const server = createServer(); await new Promise(r => server.listen(0, '127.0.0.1', r));
  let browser;
  try {
    browser = await chromium.launch();
    for (const single of [false, true]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, offline: single });
      const page = await context.newPage(), errors = [], failed = [], external = [];
      page.on('pageerror', e => errors.push(e.message)); page.on('requestfailed', r => failed.push(r.url().slice(0, 100)));
      page.on('request', r => { if (/^https?:/.test(r.url()) && new URL(r.url()).hostname !== '127.0.0.1') external.push(r.url()); });
      await page.goto(single ? pathToFileURL(path.join(temp, 'index.html')).href : `http://127.0.0.1:${server.address().port}/`);
      const audio = () => page.locator('audio').evaluateAll(ns => ns.map(n => ({ id: n.id, paused: n.paused, time: n.currentTime, loop: n.loop, volume: n.volume, error: n.error?.code })));
      const playing = async id => {
        await page.waitForFunction(id => { const n = document.getElementById(id); return !n.paused && n.readyState >= 2 && n.currentTime > 0; }, id);
        const states = await audio(); assert.equal(states.filter(s => !s.paused).length, 1); assert.equal(states.find(s => !s.paused).id, id);
        assert.ok(states.every(s => s.loop && s.volume === .22 && !s.error));
      };
      assert.ok((await audio()).every(s => s.paused));
      await page.locator('#settings-button').click(); await playing('theme-music');
      await page.locator('#music-switch').click(); assert.ok((await audio()).every(s => s.paused));
      await page.locator('#sound-switch').click(); assert.ok((await audio()).every(s => s.paused));
      await page.locator('#music-switch').click(); await playing('theme-music');
      await page.evaluate(() => { const b = document.getElementById('music-switch'); b.click(); b.click(); b.click(); b.click(); });
      await playing('theme-music');
      await page.locator('#settings-screen [data-menu]').click(); await page.locator('#select-level-button').click(); await playing('theme-music');
      await page.locator('#level-screen [data-menu]').click(); await page.locator('#start-button').click();
      await playing('level-music'); await page.getByRole('button', { name: '跳过教程', exact: true }).click();
      await page.locator('#level-music').evaluate(n => { n.currentTime = 10; });
      await page.waitForFunction(() => document.getElementById('level-music').currentTime >= 10);
      await page.locator('#pause-button').click(); const paused = (await audio())[1].time;
      assert.ok((await audio()).every(s => s.paused));
      await page.getByRole('button', { name: '继续赶海', exact: true }).click(); await playing('level-music'); assert.ok((await audio())[1].time >= paused);
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
      assert.ok((await audio()).every(s => s.paused));
      assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().state), 'paused');
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
      assert.ok((await audio()).every(s => s.paused)); await page.getByRole('button', { name: '继续赶海', exact: true }).click(); await playing('level-music');
      await page.locator('#pause-button').click(); await page.getByRole('button', { name: '返回选关', exact: true }).click(); await playing('theme-music');
      await page.locator('#level-screen [data-menu]').click(); await page.locator('#start-button').click();
      await playing('level-music'); assert.ok((await audio())[1].time < 3, 'Re-entering the same level must restart its music.');
      await page.getByRole('button', { name: '跳过教程', exact: true }).click();
      const deck = await page.locator('.tile .seaside-item').evaluateAll(ns => ns.map(n => Number(n.dataset.kind)));
      for (const kind of [0, 1, 2]) for (let i = 0; i < deck.length; i++) if (deck[i] === kind) await page.locator('.tile').nth(i).click();
      await page.getByRole('button', { name: '下一关', exact: true }).waitFor();
      await page.locator('#level-music').evaluate(n => { n.currentTime = 20; });
      await page.waitForFunction(() => document.getElementById('level-music').currentTime >= 20);
      await page.locator('#level-music').evaluate(n => {
        window.musicContinuity = { paused: 0, sought: 0 };
        n.addEventListener('pause', () => window.musicContinuity.paused++);
        n.addEventListener('seeking', () => window.musicContinuity.sought++);
      });
      const beforeNext = (await audio())[1].time;
      await page.getByRole('button', { name: '下一关', exact: true }).click(); await playing('level-music');
      assert.equal(await page.evaluate(() => beachDiagnostics.snapshot().levelId), 2);
      assert.ok((await audio())[1].time >= beforeNext);
      assert.deepEqual(await page.evaluate(() => window.musicContinuity), { paused: 0, sought: 0 });
      await page.locator('#pause-button').click(); await page.getByRole('button', { name: '返回选关', exact: true }).click();
      await page.locator('#level-screen [data-menu]').click(); await page.locator('#settings-button').click();
      await page.locator('#unlock-switch').click(); await page.locator('#settings-screen [data-menu]').click();
      await page.locator('#select-level-button').click(); await page.locator('#level-3').click(); await playing('level-music');
      assert.ok((await audio())[1].time < 3, 'Re-entering a different level must restart its music.');
      await page.getByRole('button', { name: '我知道了', exact: true }).click();
      await page.locator('#pause-button').click(); await page.getByRole('button', { name: '返回选关', exact: true }).click(); await playing('theme-music');
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); assert.ok((await audio()).every(s => s.paused));
      await page.evaluate(() => window.dispatchEvent(new Event('pageshow'))); await playing('theme-music');
      assert.deepEqual(errors, []); assert.deepEqual(failed, []); assert.deepEqual(external, []);
      console.log(`PASS ${single ? 'single HTML offline' : 'HTTP source'}: actual MP3 decoding, first interaction, routing/switches, pause/background, same/different level re-entry resets, next-level music continues without pause/seek.`);
      await context.close();
    }
  } finally { if (browser) await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); fs.rmSync(temp, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
