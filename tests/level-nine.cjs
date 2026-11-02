// Browser acceptance without screenshots or other generated media.
const { chromium } = require('./browser-support.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    await page.clock.install();
    await page.addInitScript(() => localStorage.setItem('beach-pairs-completed-levels', '[8]'));
    await page.goto(pathToFileURL(path.join(process.env.BEACH_GAME_DIR || path.resolve(__dirname, '..'), 'index.html')).href);
    const state = () => page.evaluate(() => beachDiagnostics.snapshot());
    const action = name => page.getByRole('button', { name, exact: true }).click();
    const progressText = count => `配对失败的次数不得超过 ${count} / 10次`;
    async function collectAll() {
      for (const kind of [0, 1, 2, 4, 5]) {
        const indices = await page.locator('.tile[data-status="hidden"]').evaluateAll((tiles, kind) => tiles.filter(tile => tile.querySelector('.seaside-item').dataset.kind === String(kind)).map(tile => Number(tile.dataset.index)), kind);
        for (const index of indices) await page.locator('.tile').nth(index).click();
      }
      await page.clock.runFor(700);
    }
    async function mistake() {
      await page.locator('.tile').nth(0).click();
      await page.locator('.tile').nth(1).click();
      await page.clock.runFor(550);
    }
    await page.locator('#select-level-button').click();
    await page.locator('#level-8').click();
    await collectAll();
    await action('下一关');
    assert.equal((await state()).levelId, 9);
    assert.equal((await state()).duration, 60000);
    assert.equal((await state()).totalPairs, 12);
    assert.equal(await page.locator('.tile').count(), 24);
    assert.equal(await page.locator('#modal-heading').innerText(), '本关胜利条件');
    assert.equal(await page.locator('#modal-art .notice-board-art').count(), 1);
    assert.equal(await page.locator('#modal-conditions').innerText(), '配对失败的次数不得超过10次');
    await page.clock.fastForward(90000);
    assert.equal((await state()).elapsed, 0);
    assert.equal((await state()).mismatches, 0);
    await action('我知道了');
    assert.equal(await page.locator('#play-conditions').innerText(), progressText(0));
    assert.equal(await page.locator('#play-conditions .condition-item').getAttribute('data-completed'), 'false');
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 1280, height: 720 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await page.clock.runFor(400);
      const fits = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect();
        const app = rect('#app'), header = rect('.play-header'), objectives = rect('#level-objectives'), board = rect('#board'), footer = rect('.collection');
        return header.bottom <= objectives.top && objectives.bottom <= board.top && board.bottom <= footer.top && footer.bottom <= app.bottom + 1 && [...document.querySelectorAll('.tile')].every(button => {
          const box = button.getBoundingClientRect();
          const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          return hit && (hit === button || button.contains(hit));
        });
      });
      assert.equal(fits, true, JSON.stringify(viewport));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (let count = 1; count <= 10; count++) {
      await mistake();
      assert.equal((await state()).mismatches, count);
      assert.equal((await state()).state, 'playing');
      assert.equal(await page.locator('#play-conditions').innerText(), progressText(count));
      if (count === 5) {
        await page.locator('#pause-button').click();
        assert.equal(await page.locator('#modal-conditions').innerText(), progressText(5));
        const remaining = (await state()).remaining;
        await page.clock.fastForward(90000);
        assert.equal((await state()).remaining, remaining);
        await action('继续赶海');
      }
    }
    assert.equal((await state()).conditions[0].failed, false);
    // Four synchronous real button events: start an item flight, then exceed the
    // limit before any RAF or 500 ms cover delay can run.
    await page.evaluate(() => {
      const tiles = document.querySelectorAll('.tile');
      tiles[2].click(); tiles[5].click();
      tiles[0].click(); tiles[1].click();
    });
    const failed = await state();
    assert.equal(failed.mismatches, 11);
    assert.equal(failed.pairs, 1);
    assert.equal(failed.state, 'lost');
    assert.equal(failed.failureReason, 'conditions');
    assert.equal(failed.modalOpen, true);
    assert.ok(failed.flights > 0, 'The failure modal must not wait for active harvest flights.');
    assert.ok(failed.remaining > 0);
    assert.ok(failed.displayedTide < 1);
    assert.equal(await page.locator('#modal-heading').innerText(), '未完成全部的条件');
    assert.equal(await page.locator('#modal-art .condition-failure-art').count(), 1);
    assert.equal(await page.locator('#modal-card').evaluate(card => getComputedStyle(card).animationDelay), '0s');
    assert.match(await page.locator('#modal-description').innerText(), /11 \/ 10次/);
    assert.equal(await page.locator('#play-conditions .condition-item').getAttribute('data-completed'), 'false');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('beach-pairs-completed-levels'))), [8]);
    await action('重新挑战');
    assert.equal((await state()).mismatches, 0);
    assert.equal((await state()).pairs, 0);
    assert.equal(await page.locator('#modal-conditions').innerText(), '配对失败的次数不得超过10次');
    await action('我知道了');
    await collectAll();
    assert.equal((await state()).state, 'won');
    assert.equal((await state()).mismatches, 0);
    assert.equal(await page.locator('#play-conditions .condition-item').getAttribute('data-completed'), 'true');
    assert.equal(await page.locator('#modal-art .bucket-find').count(), 12);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('beach-pairs-completed-levels'))), [8, 9]);
    await action('下一关');
    assert.equal((await state()).levelId, 10);
    assert.equal((await state()).modalOpen, true);
    assert.equal((await state()).conditions[0].type, 'noPairBonus');
    assert.equal(await page.locator('#level-objectives').isVisible(), true);
    await action('我知道了');
    await page.locator('#pause-button').click();
    await action('返回选关');
    assert.equal(await page.locator('#level-9').isEnabled(), true);
    assert.equal(await page.locator('#level-10').isDisabled(), true);
    await page.locator('#level-9').click();
    await action('我知道了');
    await page.clock.fastForward(61000);
    await page.clock.runFor(700);
    assert.equal((await state()).failureReason, 'timeout');
    assert.equal(await page.locator('#modal-art .washed-bucket-art').count(), 1);
    assert.equal((await state()).mismatches, 0);
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
    console.log('PASS: level 8 → 9, untimed entry without counter, live/pause counts, five viewports, ten allowed mismatches, immediate eleventh failure during harvest flights with no animation delay or fake progress, retry/reset, real victory/save, distinct timeout. No images captured.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
