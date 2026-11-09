// Real file/HTTP UI checks in isolated Chrome contexts, without screenshots.
const { chromium } = require('./browser-support.cjs');
const assert = require('node:assert/strict'), path = require('node:path');
const { pathToFileURL } = require('node:url'), { createServer } = require('../scripts/serve.cjs');
const label = '在15秒内完成18次配对';
(async () => {
  const root = path.resolve(__dirname, '..'), server = createServer(root);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch();
    for (const [url, testing] of [[pathToFileURL(path.join(root, 'index.html')).href, true], [`http://127.0.0.1:${server.address().port}/`, false]]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.install({ time: new Date('2026-11-04T00:00:00Z') });
      await page.clock.pauseAt(new Date('2026-11-04T00:00:01Z'));
      await page.addInitScript(testing => {
        localStorage.setItem('beach-pairs-completed-levels', '[41]');
        if (testing) localStorage.setItem('beach-pairs-unlock-all', 'on');
      }, testing);
      await page.goto(url);
      const state = () => page.evaluate(() => beachDiagnostics.snapshot());
      const action = name => page.getByRole('button', { name, exact: true }).click();
      const tile = index => page.locator('.tile').nth(index);
      const collect = async (start = 0) => { for (let i = start; i < 36; i++) await tile(i).click(); };
      await page.locator('#select-level-button').click();
      for (let i = 0; i < 4; i++) await page.locator('#chapter-next').click();
      assert.equal(await page.locator('#chapter-5 .chapter-level:enabled').count(), 10);
      assert.equal(await page.locator('#level-50').isDisabled(), false);
      await page.locator('#level-41').click(); await action('我知道了');
      const values = await page.locator('.tile .seaside-item').evaluateAll(nodes => nodes.map(n => Number(n.dataset.kind)));
      for (const kind of [0, 1, 2, 4]) for (let i = 0; i < 16; i++) if (values[i] === kind) await tile(i).click();
      await page.clock.runFor(1000); await action('下一关');
      assert.equal((await state()).levelId, 42); assert.equal(await page.locator('#play-number').innerText(), '02');
      assert.equal((await state()).duration, 60000); assert.equal((await state()).totalPairs, 18);
      assert.deepEqual((await state()).conditions.map(c => c.type), ['timedPairs']);
      assert.equal(await page.locator('#modal-conditions').innerText(), label);
      assert.equal(await page.locator('#play-conditions').innerText(), label);
      assert.equal(await page.locator('.tile').count(), 36);
      assert.ok((await page.locator('.tile .seaside-item').evaluateAll(nodes => nodes.map(n => Number(n.dataset.kind)))).every(kind => kind === 1));
      assert.equal((await state()).surf, null); assert.equal((await state()).seagrass, null);
      await page.clock.fastForward(90000); assert.equal((await state()).remaining, 60000);
      await action('我知道了'); await tile(0).click(); await tile(1).click();
      await page.clock.fastForward(15050); await collect(2); await page.clock.runFor(1000);
      assert.equal((await state()).failureReason, 'conditions'); assert.equal((await state()).pairs, 18);
      assert.ok((await state()).remaining > 0); assert.equal(await page.locator('#modal-art .condition-failure-art').count(), 1);
      await action('重新挑战'); assert.equal((await state()).pairs, 0); assert.equal((await state()).remaining, 60000);
      assert.equal((await state()).conditions[0].completed, false); await action('我知道了');
      for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
        await page.setViewportSize(viewport); await page.clock.runFor(30);
        assert.equal(await page.evaluate(() => {
          const r = document.querySelector('#play-screen').getBoundingClientRect();
          return [...document.querySelectorAll('.tile,#level-objectives,.collection')].every(node => {
            const b = node.getBoundingClientRect();
            return b.width > 0 && b.height > 0 && b.left >= r.left - 1 && b.right <= r.right + 1 && b.top >= r.top - 1 && b.bottom <= r.bottom + 1;
          });
        }), true, JSON.stringify(viewport));
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await tile(0).click(); await tile(1).click(); await page.locator('#pause-button').click();
      assert.equal(await page.locator('#modal-conditions').innerText(), label);
      const paused = await state(); await page.clock.fastForward(30000); assert.equal((await state()).activeTime, paused.activeTime);
      await action('继续赶海'); await collect(2); assert.equal((await state()).state, 'won');
      assert.equal((await state()).conditions[0].completed, true); await page.clock.runFor(1000);
      assert.equal(await page.evaluate(() => localStorage.getItem('beach-pairs-completed-levels')), '[41,42]');
      await action('下一关'); assert.equal((await state()).levelId, 43); assert.equal((await state()).fog.filter(Boolean).length, 36); assert.equal((await state()).seagrass.filter(c => c.grass).length, 6); await page.locator('#pause-button').click();
      await action('返回选关'); assert.equal(await page.locator('#level-42').isEnabled(), true);
      assert.equal(await page.locator('#level-50').isDisabled(), false);
      assert.deepEqual(errors, []); await context.close();
    }
    console.log('PASS: EX second file/HTTP, first-to-second handoff, one-kind board, three condition placements, slow completion failure, pause/retry, responsive layout, fast completion victory and normal/test progress isolation. No screenshots.');
  } finally {
    if (browser) await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
