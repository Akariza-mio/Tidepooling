// Browser functionality only. No screenshots, previews or packages.
const { chromium } = require('./browser-support.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.clock.install();
    await page.addInitScript(() => localStorage.setItem('beach-pairs-unlock-all', 'on'));
    await page.goto(pathToFileURL(path.join(__dirname, '..', 'index.html')).href);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const state = () => page.evaluate(() => beachDiagnostics.snapshot());
    const action = name => page.getByRole('button', { name, exact: true }).click();
    const tile = index => page.locator('.tile').nth(index);
    const condition = (container, id) => page.locator(`#${container} [data-condition="${id}"]`);
    await page.locator('#select-level-button').click(); await page.locator('#chapter-next').click();
    assert.equal(await page.locator('#level-19').isEnabled(), true);
    assert.equal(await page.locator('#level-35').isDisabled(), false);
    await page.locator('#level-19').click();
    assert.equal((await state()).levelId, 19);
    assert.equal(await page.locator('#play-number').innerText(), '09');
    assert.equal(await page.locator('#modal-art .notice-board-art').count(), 1);
    assert.equal(await page.locator('#modal-conditions .condition-item').count(), 2);
    assert.equal(await condition('modal-conditions', 'mismatch-limit').innerText(), '配对失败的次数不得超过20次');
    assert.equal(await condition('modal-conditions', 'penultimate-conch').innerText(), '倒数第二对配对必须是海螺');
    assert.equal(await page.locator('#modal-conditions .condition-item-icon .seaside-item[data-kind="4"]').count(), 1);
    const fog = [0, 1, 2, 15, 16, 17, 24, 25, 26];
    assert.deepEqual(await page.locator('.tile[data-fog="covered"]').evaluateAll(tiles => tiles.map(tile => Number(tile.dataset.index))), fog);
    const deck = await page.locator('.tile .seaside-item').evaluateAll(icons => icons.map(icon => Number(icon.dataset.kind)));
    const pairs = [0, 1, 2, 4, 5].flatMap(kind => {
      const cells = deck.flatMap((value, i) => value === kind ? [i] : []);
      return Array.from({ length: cells.length / 2 }, (_, i) => ({ kind, cells: cells.slice(i * 2, i * 2 + 2) }));
    });
    const conch = pairs.find(pair => pair.kind === 4), fish = pairs.find(pair => pair.kind === 5);
    const firstSixteen = pairs.filter(pair => pair !== conch && pair !== fish);
    const match = async pair => {
      for (const index of pair.cells) {
        if ((await state()).fog[index]?.covered) await tile(index).click();
        await tile(index).click();
      }
    };
    await page.clock.fastForward(90000); assert.equal((await state()).remaining, 60000);
    await action('我知道了');
    await tile(0).click(); assert.equal((await state()).statuses[0], 'hidden');
    await page.locator('#pause-button').click();
    assert.equal(await condition('modal-conditions', 'mismatch-limit').innerText(), '配对失败的次数不得超过 0 / 20次');
    const paused = await state(); await page.clock.fastForward(30000);
    assert.equal((await state()).remaining, paused.remaining); assert.equal((await state()).fog[0].covered, false);
    await action('继续赶海'); await page.clock.runFor(5100);
    assert.equal((await state()).fog[0].covered, true);
    for (let i = 0; i < 20; i++) {
      await tile(6).click(); await tile(7).click(); await page.clock.runFor(500);
    }
    assert.equal((await state()).state, 'playing'); assert.equal((await state()).mismatches, 20);
    assert.equal(await condition('play-conditions', 'mismatch-limit').innerText(), '配对失败的次数不得超过 20 / 20次');
    await tile(6).click(); await tile(7).click();
    assert.equal((await state()).state, 'lost'); assert.equal((await state()).mismatches, 21);
    assert.ok((await state()).remaining > 0);
    assert.equal(await page.locator('#modal-heading').innerText(), '未完成全部的条件');
    assert.equal(await page.locator('#modal-art .condition-failure-art').count(), 1);
    await action('重新挑战');
    assert.equal((await state()).mismatches, 0);
    assert.deepEqual(await page.locator('.tile .seaside-item').evaluateAll(icons => icons.map(icon => Number(icon.dataset.kind))), deck);
    await action('我知道了');
    for (const pair of firstSixteen) await match(pair);
    await match(fish);
    assert.equal((await state()).state, 'playing');
    assert.equal(await condition('play-conditions', 'penultimate-conch').getAttribute('data-completed'), 'false');
    await match(conch); await page.clock.runFor(800);
    assert.equal((await state()).pairs, 18); assert.equal((await state()).failureReason, 'conditions');
    assert.match(await page.locator('#modal-description').innerText(), /倒数第二对配对必须是海螺/);
    await action('重新挑战'); await action('我知道了');
    for (const pair of firstSixteen) await match(pair);
    assert.equal(await condition('play-conditions', 'penultimate-conch').getAttribute('data-completed'), 'false');
    await match(conch);
    assert.equal((await state()).pairs, 17);
    assert.equal(await condition('play-conditions', 'penultimate-conch').getAttribute('data-completed'), 'true');
    await page.locator('#pause-button').click();
    assert.equal(await condition('modal-conditions', 'penultimate-conch').getAttribute('data-completed'), 'true');
    assert.equal(await page.locator('#modal-conditions .condition-item-icon .seaside-item[data-kind="4"]').count(), 1);
    await action('继续赶海'); await match(fish); await page.clock.runFor(800);
    assert.equal((await state()).state, 'won');
    assert.ok((await state()).conditions.every(condition => condition.completed));
    assert.equal(await page.evaluate(() => localStorage.getItem('beach-pairs-completed-levels')) ,'[19]');
    await action('下一关');
    assert.equal((await state()).levelId, 20);
    assert.equal((await state()).modalOpen, false);
    assert.equal((await state()).conditions.length, 0);
    assert.equal(await page.locator('.tile[data-fog="covered"]').count(), 36);
    assert.deepEqual(errors, []);
    console.log('PASS: night-nine fixed half-row fog in nine cells, two conditions and conch icons in all placements, pause, 20/21 mistake boundary, reset, wrong-order failure and correct penultimate-pair victory. No images captured.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
