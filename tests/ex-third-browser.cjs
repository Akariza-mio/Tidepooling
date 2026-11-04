// Combined fog/grass checks using existing Chrome, without screenshots.
const { chromium } = require('./browser-support.cjs');
const assert = require('node:assert/strict'), path = require('node:path');
const { pathToFileURL } = require('node:url'), { createServer } = require('../scripts/serve.cjs');
(async () => {
  const root = path.resolve(__dirname, '..'), server = createServer(root);
  await new Promise(r => server.listen(0, '127.0.0.1', r)); let browser;
  try {
    browser = await chromium.launch();
    for (const [url, testing] of [[pathToFileURL(path.join(root, 'index.html')).href, true], [`http://127.0.0.1:${server.address().port}/`, false]]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.clock.install({ time: new Date('2026-11-04T00:00:00Z') }); await page.clock.pauseAt(new Date('2026-11-04T00:00:01Z'));
      await page.addInitScript(testing => { localStorage.setItem('beach-pairs-completed-levels', '[42]'); if (testing) localStorage.setItem('beach-pairs-unlock-all', 'on'); }, testing);
      await page.goto(url);
      const state = () => page.evaluate(() => beachDiagnostics.snapshot());
      const action = name => page.getByRole('button', { name, exact: true }).click(), tile = i => page.locator('.tile').nth(i);
      const reveal = async i => { if ((await state()).fog[i].covered) await tile(i).click(); await tile(i).click(); };
      await page.locator('#select-level-button').click(); for (let i = 0; i < 4; i++) await page.locator('#chapter-next').click();
      assert.equal(await page.locator('#chapter-5 .chapter-level:enabled').count(), testing ? 8 : 1); assert.equal(await page.locator('#level-49').isDisabled(), true);
      await page.locator('#level-42').click(); assert.equal(await page.locator('#modal-conditions').innerText(), '在15秒内完成18次配对'); await action('我知道了');
      for (let i = 0; i < 36; i++) await tile(i).click(); await page.clock.runFor(1000); await action('下一关');
      let snap = await state(); assert.equal(snap.levelId, 43); assert.equal(snap.modalOpen, false); assert.equal(snap.remaining, 60000);
      assert.equal(snap.rows, 6); assert.equal(snap.columns, 6); assert.deepEqual(snap.conditions, []);
      assert.deepEqual(snap.seagrass.flatMap((c,i) => c.grass ? [i] : []), [9,10,14,16,18,31]); assert.equal(snap.fog.filter(c => c.covered).length, 36);
      assert.equal(await page.locator('.fog-mask-cell').count(), 36); assert.equal(await page.locator('#level-objectives').isVisible(), false);
      const deck = await page.locator('.tile .seaside-item').evaluateAll(ns => ns.map(n => Number(n.dataset.kind)));
      assert.deepEqual([0,1,2,4].map(kind => deck.filter(k => k === kind).length), [10,10,8,8]);
      assert.match(await tile(9).getAttribute('aria-label'), /雾遮蔽/); assert.doesNotMatch(await tile(9).getAttribute('aria-label'), /海草/);
      await reveal(9); await reveal(10); await page.clock.runFor(550); snap = await state();
      assert.equal(snap.mismatches, 1); assert.equal(snap.seagrass[9].locked, true);
      for (const i of [3,4,8,11,15]) { assert.equal(snap.seagrass[i].grass, true); assert.equal(snap.fog[i].covered, true); assert.match(await tile(i).getAttribute('aria-label'), /雾遮蔽/); }
      await reveal(0); await reveal(4); assert.equal((await state()).pairs, 1);
      await page.clock.fastForward(5100); assert.equal((await state()).fog[9].covered, true); assert.equal((await state()).seagrass[9].locked, true);
      assert.equal(await tile(9).isEnabled(), true); await tile(9).click();
      assert.equal((await state()).fog[9].covered, false); assert.equal(await tile(9).isDisabled(), true); assert.match(await tile(9).getAttribute('aria-label'), /紫色交叉海草/);
      assert.equal(await tile(0).isEnabled(), true); await tile(0).click(); assert.equal((await state()).statuses[0], 'matched'); assert.equal((await state()).pairs, 1);
      await page.locator('#pause-button').click(); const paused = await state(); await page.clock.fastForward(30000);
      assert.equal((await state()).activeTime, paused.activeTime); assert.deepEqual((await state()).fog, paused.fog); assert.deepEqual((await state()).seagrass, paused.seagrass);
      await action('继续赶海'); await page.clock.fastForward(5000); assert.equal((await state()).seagrass[9].locked, false);
      await page.locator('#pause-button').click(); await action('重新开始'); snap = await state();
      assert.equal(snap.remaining, 60000); assert.equal(snap.pairs, 0); assert.equal(snap.mismatches, 0);
      assert.equal(snap.fog.filter(c => c.covered).length, 36); assert.deepEqual(snap.seagrass.flatMap((c,i) => c.grass ? [i] : []), [9,10,14,16,18,31]);
      assert.deepEqual(await page.locator('.tile .seaside-item').evaluateAll(ns => ns.map(n => Number(n.dataset.kind))), deck);
      for (const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]) {
        await page.setViewportSize(viewport); await page.clock.runFor(30);
        assert.equal(await page.evaluate(() => { const r = document.querySelector('#play-screen').getBoundingClientRect(); return [...document.querySelectorAll('.tile,.collection')].every(n => { const b = n.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.left >= r.left-1 && b.right <= r.right+1 && b.top >= r.top-1 && b.bottom <= r.bottom+1; }); }), true, JSON.stringify(viewport));
      }
      await page.setViewportSize({width:390,height:844});
      for (const kind of [0,1,2,4]) for (let i = 0; i < 36; i++) if (deck[i] === kind) await reveal(i);
      assert.equal((await state()).state, 'won'); assert.equal((await state()).pairs, 18); await page.clock.runFor(1000);
      assert.equal(await page.evaluate(() => localStorage.getItem('beach-pairs-completed-levels')), testing ? '[42]' : '[42,43]');
      await action('下一关'); assert.equal((await state()).levelId,44); assert.equal((await state()).modalOpen,false); assert.equal((await state()).timerRunning,true); await page.locator('#pause-button').click(); await action('返回选关');
      assert.equal(await page.locator('#level-43').isEnabled(), true); assert.equal(await page.locator('#level-49').isDisabled(), true);
      assert.deepEqual(errors, []); await context.close();
    }
    console.log('PASS: EX third file/HTTP, 42→43, full fog/six fixed scattered grass cells, covered spread, independent locks and refog, hidden-state labels and clickable refogged holes/locks, pause/retry, viewports, victory and progress isolation. No screenshots.');
  } finally { if (browser) await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
