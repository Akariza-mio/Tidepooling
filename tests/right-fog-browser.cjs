// Functional verification only; no screenshots, previews or packages.
const { chromium } = require('./browser-support.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install();
    await page.addInitScript(() => localStorage.setItem('beach-pairs-unlock-all', 'on'));
    await page.goto(pathToFileURL(path.join(__dirname, '..', 'index.html')).href);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const state = () => page.evaluate(() => beachDiagnostics.snapshot());
    const action = name => page.getByRole('button', { name, exact: true }).click();
    const tile = index => page.locator('.tile').nth(index);
    const label = '配对失败会导致潮水上涨';
    await page.locator('#select-level-button').click(); await page.locator('#chapter-next').click();
    assert.equal(await page.locator('#level-17').isEnabled(), true);
    assert.equal(await page.locator('#level-35').isDisabled(), true);
    await page.locator('#level-17').click();
    assert.equal((await state()).levelId, 17);
    assert.equal(await page.locator('#play-number').innerText(), '07');
    assert.equal(await page.locator('#modal-heading').innerText(), '本关胜利条件');
    assert.equal(await page.locator('#modal-art .notice-board-art').count(), 1);
    assert.equal(await page.locator('#modal-conditions').innerText(), label);
    assert.doesNotMatch(await page.locator('#modal-card').innerText(), /3\s*秒|三秒|-3/);
    assert.equal(await page.locator('#modal-conditions .condition-item').getAttribute('data-completed'), 'false');
    const deck = await page.locator('.tile .seaside-item').evaluateAll(icons => icons.map(icon => Number(icon.dataset.kind)));
    assert.equal(deck.length, 36);
    assert.deepEqual(await page.locator('.tile[data-fog="covered"]').evaluateAll(tiles => tiles.map(tile => Number(tile.dataset.index))),
      Array.from({ length: 36 }, (_, i) => i).filter(i => i % 6 >= 3));
    await page.clock.fastForward(90000);
    assert.equal((await state()).remaining, 60000);
    await action('我知道了');
    assert.equal(await page.locator('#play-conditions').innerText(), label);
    await tile(3).click();
    assert.equal((await state()).statuses[3], 'hidden'); assert.equal((await state()).mismatches, 0);
    await page.locator('#pause-button').click();
    assert.equal(await page.locator('#modal-conditions').innerText(), label);
    assert.doesNotMatch(await page.locator('#modal-card').innerText(), /3\s*秒|三秒|-3/);
    const paused = await state(); await page.clock.fastForward(30000);
    assert.equal((await state()).remaining, paused.remaining);
    assert.equal((await state()).fog[3].covered, false);
    await action('继续赶海'); await page.clock.runFor(5100);
    assert.equal((await state()).fog[3].covered, true);
    const before = await state();
    await tile(0).click(); await tile(1).click();
    const failed = await state();
    assert.equal(failed.mismatches, 1); assert.equal(failed.state, 'playing');
    assert.ok(Math.abs(before.remaining - failed.remaining - (failed.activeTime - before.activeTime) - 3000) < 1);
    assert.equal(failed.statuses[0], 'open'); assert.equal(failed.statuses[1], 'open');
    await page.clock.runFor(400);
    assert.ok((await state()).displayedTide > before.displayedTide + .04);
    assert.equal((await state()).statuses[0], 'open');
    await page.clock.runFor(120); assert.equal((await state()).statuses[0], 'hidden');
    assert.equal(await page.locator('#time-reward').isVisible(), false);
    await page.locator('#pause-button').click(); await action('重新开始');
    assert.equal((await state()).remaining, 60000); assert.equal((await state()).mismatches, 0);
    assert.deepEqual(await page.locator('.tile .seaside-item').evaluateAll(icons => icons.map(icon => Number(icon.dataset.kind))), deck);
    assert.equal(await page.locator('.tile[data-fog="covered"]').count(), 18);
    await action('我知道了'); await page.clock.runFor(58000);
    await tile(0).click(); await tile(1).click();
    assert.equal((await state()).state, 'lost'); assert.equal((await state()).failureReason, 'timeout');
    assert.equal((await state()).remaining, 0);
    assert.equal(await page.locator('#modal-heading').innerText(), '潮水先到了一步');
    await action('重新挑战'); await action('我知道了');
    // A previous mistake must not create a hidden objective that prevents victory.
    await tile(0).click(); await tile(1).click(); await page.clock.runFor(520);
    for (const kind of [0, 1, 2, 4, 5]) for (let index = 0; index < deck.length; index++) if (deck[index] === kind) {
      if ((await state()).fog[index]?.covered) await tile(index).click();
      await tile(index).click();
    }
    await page.clock.runFor(800);
    assert.equal((await state()).state, 'won'); assert.equal((await state()).pairs, 18);
    assert.ok((await state()).bonusTime <= 90000); assert.equal((await state()).mismatches, 1);
    assert.equal((await state()).conditions[0].completed, true);
    assert.equal(await page.locator('#modal-art .bucket-find').count(), 18);
    assert.equal(await page.evaluate(() => localStorage.getItem('beach-pairs-completed-levels')), null);
    await action('下一关');
    assert.equal((await state()).levelId, 18);
    assert.equal(await page.locator('#modal-heading').innerText(), '本关胜利条件');
    assert.equal(await page.locator('#modal-conditions').innerText(), '在5秒内完成3组配对');
    assert.deepEqual(errors, []);
    console.log('PASS: night-seven entry, fixed right-half fog, all three number-free rule placements, penalty/tide animation, pause, retry, penalty timeout, matching bonuses and full victory. No images captured.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
