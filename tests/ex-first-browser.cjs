// Isolated file/HTTP checks using existing Chrome; no screenshots.
const { chromium } = require('./browser-support.cjs');
const assert = require('node:assert/strict'), path = require('node:path');
const { pathToFileURL } = require('node:url'), { createServer } = require('../scripts/serve.cjs');
const label = '配对失败的次数不得超过1次';
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
        localStorage.setItem('beach-pairs-completed-levels', '[40]');
        if (testing) localStorage.setItem('beach-pairs-unlock-all', 'on');
      }, testing);
      await page.goto(url);
      const state = () => page.evaluate(() => beachDiagnostics.snapshot());
      const action = name => page.getByRole('button', { name, exact: true }).click();
      const tile = index => page.locator('.tile').nth(index);
      const pair = async (a, b) => { await tile(a).click(); await tile(b).click(); };
      const deck = () => page.locator('.tile .seaside-item').evaluateAll(nodes => nodes.map(node => Number(node.dataset.kind)));
      const collect = async () => {
        const values = await deck(), snap = await state();
        for (const kind of [...new Set(values)]) for (let i = 0; i < values.length; i++) if (values[i] === kind && snap.statuses[i] === 'hidden') await tile(i).click();
      };
      await page.locator('#select-level-button').click();
      for (let i = 0; i < 4; i++) await page.locator('#chapter-next').click();
      assert.equal(await page.locator('#chapter-5 .chapter-level:enabled').count(), testing ? 10 : 0);
      assert.equal(await page.locator('#level-50').isDisabled(), !testing);
      await page.locator('#chapter-previous').click(); await page.locator('#level-40').click();
      await action('我知道了'); await collect(); await page.clock.runFor(1000); await action('下一关');
      assert.equal((await state()).levelId, 41); assert.equal((await state()).mode, 'matching');
      assert.equal(await page.locator('#play-number').innerText(), '01');
      assert.equal(await page.locator('#modal-conditions').innerText(), label);
      assert.equal(await page.locator('#play-conditions').innerText(), '配对失败的次数不得超过 0 / 1次');
      const values = await deck(); assert.equal(values.length, 16);
      assert.deepEqual([0, 1, 2, 4].map(kind => values.filter(value => value === kind).length), [4, 4, 4, 4]);
      assert.equal((await state()).surf, null); assert.equal((await state()).seagrass, null);
      await page.clock.fastForward(90000); assert.equal((await state()).remaining, 60000);
      await action('我知道了'); await tile(0).click(); await tile(0).dispatchEvent('click');
      assert.equal((await state()).mismatches, 0); await tile(1).click(); await tile(3).dispatchEvent('click');
      assert.equal((await state()).mismatches, 1); assert.equal((await state()).state, 'playing');
      await page.clock.runFor(550); await page.locator('#pause-button').click();
      assert.equal(await page.locator('#modal-conditions').innerText(), '配对失败的次数不得超过 1 / 1次');
      const paused = await state(); await page.clock.fastForward(30000); assert.equal((await state()).remaining, paused.remaining);
      await action('继续赶海'); await pair(2, 5); assert.ok((await state()).flights > 0);
      await pair(0, 1); assert.equal((await state()).mismatches, 2);
      assert.equal((await state()).failureReason, 'conditions'); assert.ok((await state()).remaining > 0);
      assert.equal(await page.locator('#modal-art .condition-failure-art').count(), 1);
      assert.equal(await page.locator('#modal-heading').innerText(), '未完成全部的条件');
      await action('重新挑战'); assert.equal((await state()).remaining, 60000); assert.equal((await state()).mismatches, 0);
      assert.deepEqual(await deck(), values); assert.equal(await page.locator('#modal-conditions').innerText(), label);
      await action('我知道了');
      for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
        await page.setViewportSize(viewport); await page.clock.runFor(30);
        const bounds = await page.evaluate(() => {
          const r = document.querySelector('#play-screen').getBoundingClientRect();
          return [...document.querySelectorAll('.tile,#level-objectives,.collection')].flatMap(node => {
            const b = node.getBoundingClientRect();
            return b.width > 0 && b.height > 0 && b.left >= r.left - 1 && b.right <= r.right + 1 && b.top >= r.top - 1 && b.bottom <= r.bottom + 1 ? [] : [{node:node.className,box:b.toJSON(),screen:r.toJSON()}];
          });
        });
        assert.deepEqual(bounds, [], JSON.stringify(viewport));
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await pair(0, 1); await page.clock.runFor(550); await collect();
      assert.equal((await state()).state, 'won'); assert.equal((await state()).pairs, 8);
      assert.equal((await state()).conditions[0].completed, true); await page.clock.runFor(1000);
      assert.equal(await page.evaluate(() => localStorage.getItem('beach-pairs-completed-levels')), testing ? '[40]' : '[40,41]');
      await action('下一关'); assert.equal((await state()).levelId, 42); assert.equal(await page.locator('#modal-conditions').innerText(), '在15秒内完成18次配对'); await action('我知道了'); await page.locator('#pause-button').click();
      await action('返回选关'); assert.equal(await page.locator('#level-41').isEnabled(), true);
      assert.equal(await page.locator('#level-50').isDisabled(), !testing);
      assert.equal(await page.locator('#chapter-5 .chapter-level:enabled').count(), testing ? 10 : 1);
      assert.deepEqual(errors, []); await context.close();
    }
    console.log('PASS: EX first level file/HTTP, chapter-four handoff, selection permissions, all condition placements, one allowed/two immediate failure, retry/pause, responsive board, victory and real/test progress isolation. No screenshots.');
  } finally {
    if (browser) await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
