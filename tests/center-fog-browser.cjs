// Browser functionality only; no screenshots, previews or packages.
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
    await page.addInitScript(() => {
      localStorage.setItem('beach-pairs-unlock-all', 'on');
      localStorage.setItem('beach-pairs-completed-levels', '[12]');
    });
    await page.goto(pathToFileURL(path.join(__dirname, '..', 'index.html')).href);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const state = () => page.evaluate(() => beachDiagnostics.snapshot());
    const action = name => page.getByRole('button', { name, exact: true }).click();
    const tile = index => page.locator('.tile').nth(index);
    const deck = () => page.locator('.tile .seaside-item').evaluateAll(icons => icons.map(icon => Number(icon.dataset.kind)));
    await page.locator('#select-level-button').click();
    await page.locator('#chapter-next').click();
    assert.equal(await page.locator('#level-13').isEnabled(), true);
    assert.equal(await page.locator('#level-14').isDisabled(), true);
    await page.locator('#level-13').click();
    assert.equal((await state()).levelId, 13);
    assert.equal(await page.locator('#play-number').innerText(), '03');
    assert.equal((await state()).duration, 60000);
    assert.equal(await page.locator('#modal-art .notice-board-art').count(), 1);
    assert.equal(await page.locator('#modal-conditions').innerText(), '配对失败的次数不得超过20次');
    assert.equal(await page.locator('.fog-mask-cell').count(), 4);
    assert.deepEqual(await page.locator('.tile[data-fog="covered"]').evaluateAll(tiles => tiles.map(tile => Number(tile.dataset.index))), [14, 15, 20, 21]);
    const original = await deck();
    assert.deepEqual([0, 1, 2, 4, 5].map(kind => original.filter(value => value === kind).length), [8, 8, 8, 6, 6]);
    await page.clock.fastForward(90000);
    assert.equal((await state()).remaining, 60000);
    await action('我知道了');
    assert.equal(await page.locator('#play-conditions').innerText(), '配对失败的次数不得超过 0 / 20次');
    await tile(14).click();
    assert.equal((await state()).statuses[14], 'hidden');
    assert.equal((await state()).mismatches, 0);
    await page.locator('#pause-button').click();
    assert.equal(await page.locator('#modal-conditions').innerText(), '配对失败的次数不得超过 0 / 20次');
    await page.clock.fastForward(10000);
    assert.equal((await state()).fog[14].covered, false);
    await action('继续赶海');
    await page.clock.runFor(5100);
    assert.equal((await state()).fog[14].covered, true);
    const a = 0, b = original.findIndex((value, index) => ![14, 15, 20, 21].includes(index) && value !== original[a]);
    for (let i = 0; i < 20; i++) {
      await tile(a).click(); await tile(b).click();
      await page.clock.runFor(500);
    }
    assert.equal((await state()).state, 'playing');
    assert.equal(await page.locator('#play-conditions').innerText(), '配对失败的次数不得超过 20 / 20次');
    await page.locator('#pause-button').click();
    assert.equal(await page.locator('#modal-conditions').innerText(), '配对失败的次数不得超过 20 / 20次');
    await action('继续赶海');
    await tile(a).click(); await tile(b).click();
    assert.equal((await state()).state, 'lost');
    assert.equal((await state()).mismatches, 21);
    assert.equal(await page.locator('#modal-heading').innerText(), '未完成全部的条件');
    assert.equal(await page.locator('#modal-art .condition-failure-art').count(), 1);
    await action('重新挑战');
    assert.notDeepEqual(await deck(), original);
    assert.equal((await state()).mismatches, 0);
    assert.equal(await page.locator('.tile[data-fog="covered"]').count(), 4);
    await action('我知道了');
    const values = await deck();
    // End with scallops to verify this level does not inherit the fish-last rule.
    for (const kind of [1, 2, 4, 5, 0]) for (let index = 0; index < values.length; index++) if (values[index] === kind) {
      if ((await state()).fog[index]?.covered) await tile(index).click();
      await tile(index).click();
    }
    await page.clock.runFor(800);
    assert.equal((await state()).state, 'won');
    assert.equal((await state()).lastMatchedKind, 0);
    assert.equal(await page.locator('#modal-art .bucket-find').count(), 18);
    assert.equal(await page.evaluate(() => localStorage.getItem('beach-pairs-completed-levels')), '[12]');
    await action('下一关');
    assert.equal(await page.locator('#modal-heading').innerText(), '下一关即将开放');
    assert.deepEqual(errors, []);
    console.log('PASS: chapter 2 level 3 selection, central 2x2 fog, balanced random restarts, frozen entry/pause, live 20-mismatch limit in three locations, immediate 21st failure, retry reset, victory without fish-last constraint and unlock progress isolation. No images captured.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
