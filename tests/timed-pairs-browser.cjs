// Functional checks only. No screenshots, previews or archives.
const { chromium } = require('C:/Users/29781/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
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
    const condition = page.locator('#play-conditions .condition-item');
    const label = '在5秒内完成3组配对';
    await page.locator('#select-level-button').click(); await page.locator('#chapter-next').click();
    assert.equal(await page.locator('#level-18').isEnabled(), true);
    assert.equal(await page.locator('#level-31').isDisabled(), true);
    await page.locator('#level-18').click();
    assert.equal((await state()).levelId, 18);
    assert.equal(await page.locator('#play-number').innerText(), '08');
    assert.equal(await page.locator('#modal-art .notice-board-art').count(), 1);
    assert.equal(await page.locator('#modal-conditions').innerText(), label);
    const fog = [2, 3, 7, 10, 14, 15, 19, 22, 25, 28, 32, 33];
    assert.deepEqual(await page.locator('.tile[data-fog="covered"]').evaluateAll(tiles => tiles.map(tile => Number(tile.dataset.index))), fog);
    const deck = await page.locator('.tile .seaside-item').evaluateAll(icons => icons.map(icon => Number(icon.dataset.kind)));
    const pairs = [0, 1, 2, 4, 5].flatMap(kind => {
      const indices = deck.flatMap((value, i) => value === kind ? [i] : []);
      return Array.from({ length: indices.length / 2 }, (_, i) => indices.slice(i * 2, i * 2 + 2));
    });
    const match = async number => {
      for (const index of pairs[number]) {
        if ((await state()).fog[index]?.covered) await tile(index).click();
        await tile(index).click();
      }
    };
    await page.clock.fastForward(90000); assert.equal((await state()).remaining, 60000);
    await action('我知道了');
    // It is an opportunity anywhere in the run, not an opening five-second deadline.
    await page.clock.runFor(7000);
    await match(0); await page.clock.runFor(1000); await match(1);
    assert.equal(await condition.getAttribute('data-completed'), 'false');
    await page.locator('#pause-button').click();
    assert.equal(await page.locator('#modal-conditions').innerText(), label);
    assert.equal(await page.locator('#modal-conditions .condition-item').getAttribute('data-completed'), 'false');
    const paused = await state(); await page.clock.fastForward(30000);
    assert.equal((await state()).remaining, paused.remaining);
    await action('继续赶海'); await page.clock.runFor(1000); await match(2);
    assert.equal(await condition.getAttribute('data-completed'), 'true');
    assert.equal(await condition.evaluate(element => element.classList.contains('is-completed')), true);
    await page.clock.runFor(6000);
    assert.equal(await condition.getAttribute('data-completed'), 'true');
    await page.locator('#pause-button').click();
    assert.equal(await page.locator('#modal-conditions .condition-item').getAttribute('data-completed'), 'true');
    await action('继续赶海');
    for (let i = 3; i < pairs.length; i++) await match(i);
    await page.clock.runFor(800);
    assert.equal((await state()).state, 'won'); assert.equal((await state()).pairs, 18);
    assert.equal(await page.evaluate(() => localStorage.getItem('beach-pairs-completed-levels')), null);
    await action('下一关');
    assert.equal((await state()).levelId, 19);
    assert.equal(await page.locator('#modal-conditions .condition-item').count(), 2);
    await action('我知道了'); await page.locator('#pause-button').click();
    await action('返回选关'); await page.locator('#level-18').click();
    assert.equal(await condition.getAttribute('data-completed'), 'false');
    assert.deepEqual(await page.locator('.tile .seaside-item').evaluateAll(icons => icons.map(icon => Number(icon.dataset.kind))), deck);
    await action('我知道了');
    // Deliberately finish every pair too far apart to ever meet the rolling window.
    for (let i = 0; i < pairs.length; i++) {
      if (i) await page.clock.runFor(3100);
      await match(i);
    }
    await page.clock.runFor(800);
    assert.equal((await state()).pairs, 18); assert.equal((await state()).state, 'lost');
    assert.equal((await state()).failureReason, 'conditions');
    assert.equal(await page.locator('#modal-heading').innerText(), '未完成全部的条件');
    assert.match(await page.locator('#modal-description').innerText(), /在5秒内完成3组配对/);
    assert.equal(await page.locator('#modal-art .condition-failure-art').count(), 1);
    await action('重新挑战');
    assert.equal((await state()).pairs, 0); assert.equal((await state()).conditions[0].completed, false);
    assert.equal(await page.locator('.tile[data-fog="covered"]').count(), 12);
    assert.equal(await page.locator('#modal-conditions').innerText(), label);
    assert.deepEqual(errors, []);
    console.log('PASS: exact 12 reference fog cells, all condition placements, late rolling-window completion, immediate persistent checkmark, pause exclusion, fixed retries, victory and unmet-condition red-cross failure. No images captured.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
