// Functional verification only; no screenshots or packages.
const { chromium } = require('./browser-support.cjs');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const Game = require('../journey.js');
const level = require('../levels.js').find(level => level.id === 16);
const snapshot = page => page.evaluate(() => beachDiagnostics.snapshot());
const action = (page, name) => page.getByRole('button', { name, exact: true }).click();
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
    await page.locator('#select-level-button').click(); await page.locator('#chapter-next').click();
    assert.equal(await page.locator('#level-16').isEnabled(), true);
    assert.equal(await page.locator('#level-35').isDisabled(), false);
    await page.locator('#level-16').click();
    assert.equal(await page.locator('#modal-heading').innerText(), '挑战！');
    assert.equal(await page.locator('#modal-description').innerText(), '这次走过的格子将不能重复踏入');
    assert.equal(await page.locator('#modal-description strong').count(), 0);
    assert.equal(await page.locator('.journey-cell').count(), 49);
    await page.clock.fastForward(90000);
    assert.equal((await snapshot(page)).remaining, 60000);
    assert.equal((await snapshot(page)).journey.phase, 'intro');
    await action(page, '我知道了'); await page.clock.runFor(2000);
    await page.locator('#pause-button').click();
    const preview = (await snapshot(page)).journey.previewSeconds;
    await page.clock.fastForward(30000);
    assert.equal((await snapshot(page)).journey.previewSeconds, preview);
    await action(page, '继续赶海'); await page.clock.runFor(3100);
    assert.equal((await snapshot(page)).journey.phase, 'exploring');
    await page.locator('.journey-cell').nth(17).click();
    const spawn = page.locator('.journey-cell').nth(24);
    assert.equal(await spawn.isDisabled(), true);
    assert.equal(await spawn.evaluate(cell => cell.classList.contains('is-spent')), true);
    assert.match(await spawn.getAttribute('aria-label'), /已经走过的灰格/);
    assert.equal(await spawn.evaluate(cell => getComputedStyle(cell).zIndex), '7');
    const beforeInvalid = await snapshot(page);
    await spawn.evaluate(cell => cell.click());
    await page.locator('.journey-cell').nth(16).click();
    assert.equal((await snapshot(page)).turns, beforeInvalid.turns);
    assert.deepEqual((await snapshot(page)).journey.visited, [24, 17]);
    await page.locator('#pause-button').click();
    const paused = await snapshot(page);
    await page.clock.fastForward(30000);
    assert.equal((await snapshot(page)).remaining, paused.remaining);
    await action(page, '重新开始');
    assert.equal(await page.locator('#modal-heading').innerText(), '挑战！');
    assert.deepEqual((await snapshot(page)).journey.visited, [24]);
    assert.equal(await page.locator('.journey-cell.is-spent').count(), 0);
    await action(page, '我知道了'); await page.clock.runFor(5100);
    for (let found = 0; found < 5; found++) {
      const state = await snapshot(page);
      const mirror = new Game({ level }); mirror.start(0);
      mirror.position = state.journey.position;
      mirror.visited = new Set(state.journey.visited);
      mirror.collected = new Set(state.journey.collected);
      const route = mirror.completionRoute(state.journey.targetIndex);
      assert.ok(route, 'The selected target leaves a full completion route.');
      for (const index of route) {
        assert.equal(state.journey.visited.includes(index), false);
        await page.locator('.journey-cell').nth(index).click();
        if ((await snapshot(page)).journey.collectedCount > found) break;
      }
      assert.equal((await snapshot(page)).journey.collectedCount, found + 1);
    }
    const won = await snapshot(page);
    assert.equal(won.state, 'won'); assert.equal(won.bonusTime, 0);
    assert.equal(won.journey.visited.length, won.turns + 1);
    assert.equal(await page.locator('#modal-heading').innerText(), '目标全部找齐啦！');
    assert.equal(await page.evaluate(() => localStorage.getItem('beach-pairs-completed-levels')) ,'[16]');
    await action(page, '下一关');
    assert.equal((await snapshot(page)).levelId, 17);
    assert.equal(await page.locator('#modal-conditions').innerText(), '配对失败会导致潮水上涨');
    assert.equal(await page.locator('#journey-target').isVisible(), false);
    assert.equal(await page.locator('.collection').isVisible(), true);
    assert.deepEqual(errors, []);
    console.log('PASS: sixth-level notice, frozen intro/preview, gray disabled trail, obstacle rejection, pause, retry reset, five-item non-repeating completion and test progress isolation. No images captured.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
