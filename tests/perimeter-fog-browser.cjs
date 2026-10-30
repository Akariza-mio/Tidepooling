// Functional checks only; no screenshots or packages.
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
      localStorage.setItem('beach-pairs-completed-levels', '[11]');
    });
    await page.goto(pathToFileURL(path.join(__dirname, '..', 'index.html')).href);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const state = () => page.evaluate(() => beachDiagnostics.snapshot());
    const action = name => page.getByRole('button', { name, exact: true }).click();
    const tile = index => page.locator('.tile').nth(index);
    const deck = () => page.locator('.tile .seaside-item').evaluateAll(icons => icons.map(icon => Number(icon.dataset.kind)));
    await page.locator('#select-level-button').click();
    await page.locator('#chapter-next').click();
    assert.equal(await page.locator('#level-12').isEnabled(), true);
    assert.equal(await page.locator('#level-13').isEnabled(), true);
    assert.equal(await page.locator('#level-31').isDisabled(), true);
    await page.locator('#level-12').click();
    assert.equal((await state()).levelId, 12);
    assert.equal((await state()).duration, 60000);
    assert.equal(await page.locator('#play-number').innerText(), '02');
    assert.equal(await page.locator('#modal-art .notice-board-art').count(), 1);
    assert.equal(await page.locator('#modal-conditions').innerText(), '最后一对配对必须是鱼儿');
    assert.equal(await page.locator('#modal-conditions .seaside-item[data-kind="5"]').count(), 1);
    assert.equal(await page.locator('.fog-mask-cell').count(), 20);
    assert.equal(await page.locator('.tile[data-fog="covered"]').count(), 20);
    for (const index of [7, 8, 9, 10, 13, 14, 15, 16, 19, 20, 21, 22, 25, 26, 27, 28]) {
      assert.equal((await state()).fog[index], null);
    }
    const original = await deck();
    await page.reload();
    await page.locator('#select-level-button').click();
    await page.locator('#chapter-next').click();
    await page.locator('#level-12').click();
    assert.deepEqual(await deck(), original, 'Reloading must preserve every item position.');
    assert.deepEqual([0, 1, 2, 4, 5].map(kind => original.filter(value => value === kind).length), [8, 8, 8, 6, 6]);
    await page.clock.fastForward(90000);
    assert.equal((await state()).remaining, 60000);
    await action('我知道了');
    assert.equal(await page.locator('#play-conditions .seaside-item[data-kind="5"]').count(), 1);
    await tile(35).click();
    assert.equal((await state()).statuses[35], 'hidden');
    await page.locator('#pause-button').click();
    assert.equal(await page.locator('#modal-conditions .condition-item').getAttribute('data-completed'), 'false');
    assert.equal(await page.locator('#modal-conditions .seaside-item[data-kind="5"]').count(), 1);
    await page.clock.fastForward(10000);
    assert.equal((await state()).fog[35].covered, false);
    await action('继续赶海');
    await page.clock.runFor(5100);
    assert.equal((await state()).fog[35].covered, true);
    await page.locator('#pause-button').click();
    await action('重新开始');
    assert.deepEqual(await deck(), original);
    assert.equal(await page.locator('.tile[data-fog="covered"]').count(), 20);
    await action('我知道了');
    async function finish(lastKind) {
      const values = await deck();
      for (const kind of [0, 1, 2, 4, 5].filter(kind => kind !== lastKind).concat(lastKind)) {
        for (let index = 0; index < values.length; index++) if (values[index] === kind) {
          if ((await state()).fog[index]?.covered) await tile(index).click();
          await tile(index).click();
        }
      }
      await page.clock.runFor(800);
    }
    await finish(0);
    assert.equal((await state()).state, 'lost');
    assert.equal((await state()).failureReason, 'conditions');
    assert.equal(await page.locator('#modal-heading').innerText(), '未完成全部的条件');
    assert.equal(await page.locator('#modal-art .condition-failure-art').count(), 1);
    await action('重新挑战');
    await action('我知道了');
    await finish(5);
    assert.equal((await state()).state, 'won');
    assert.equal((await state()).lastMatchedKind, 5);
    assert.equal(await page.locator('#modal-art .bucket-find').count(), 18);
    assert.equal(await page.evaluate(() => localStorage.getItem('beach-pairs-completed-levels')), '[11]');
    await action('下一关');
    assert.equal((await state()).levelId, 13);
    assert.equal(await page.locator('#modal-heading').innerText(), '本关胜利条件');
    await action('我知道了');
    await page.locator('#pause-button').click();
    await action('返回选关');
    await page.locator('#level-12').click();
    assert.deepEqual(await deck(), original, 'Re-entering keeps the authored positions.');
    await action('我知道了');
    await page.clock.fastForward(61000);
    await page.clock.runFor(800);
    assert.equal((await state()).failureReason, 'timeout');
    assert.deepEqual(errors, []);
    console.log('PASS: chapter 2 level 2 selection, balanced fixed entries/restarts/reloads, 20-cell fog ring and clear center, frozen entry/pause, fish condition in three locations, wrong-last-pair failure, fish-last victory, unlock progress isolation and timeout. No images captured.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
