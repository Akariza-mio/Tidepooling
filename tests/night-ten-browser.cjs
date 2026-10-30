// Functional checks only: no screenshots, previews or packages.
const { chromium } = require('C:/Users/29781/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
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
    const reveal = async index => {
      // A fog window can expire between reading its state and clicking it.
      for (let attempt = 0; attempt < 3; attempt++) {
        await tile(index).click();
        const current = await state();
        if (current.statuses[index] !== 'hidden' || current.state !== 'playing') return;
      }
      throw Error('The selected cell did not open after clearing its fog.');
    };
    await page.locator('#select-level-button').click(); await page.locator('#chapter-next').click();
    assert.equal(await page.locator('#chapter-2 .chapter-level:enabled').count(), 10);
    assert.equal(await page.locator('#level-22').isDisabled(), true);
    await page.locator('#level-20').click();
    const initial = await state();
    assert.equal(initial.levelId, 20); assert.equal(initial.rows, 6); assert.equal(initial.columns, 6);
    assert.equal(initial.duration, 60000); assert.equal(initial.totalPairs, 18);
    assert.equal(initial.modalOpen, false); assert.equal(initial.timerRunning, true);
    assert.deepEqual(initial.conditions, []);
    assert.equal(await page.locator('#play-number').innerText(), '10');
    assert.equal(await page.locator('#level-objectives').isVisible(), false);
    assert.equal(await page.locator('.tile').count(), 36);
    assert.equal(await page.locator('.fog-mask-cell').count(), 36);
    assert.equal(await page.locator('.tile[data-fog="covered"]').count(), 36);
    const deck = await page.locator('.tile .seaside-item').evaluateAll(icons => icons.map(icon => Number(icon.dataset.kind)));
    assert.deepEqual([0, 1, 2, 4, 5].map(kind => deck.filter(value => value === kind).length), [8, 8, 8, 6, 6]);
    await tile(0).click();
    assert.equal((await state()).statuses[0], 'hidden'); assert.equal((await state()).mismatches, 0);
    await page.locator('#pause-button').click();
    assert.equal(await page.locator('#modal-objectives').isVisible(), false);
    const paused = await state(); await page.clock.fastForward(30000);
    assert.equal((await state()).remaining, paused.remaining); assert.equal((await state()).fog[0].covered, false);
    await action('继续赶海'); await page.clock.runFor(5100);
    assert.equal((await state()).fog[0].covered, true);
    await page.locator('#pause-button').click(); await action('重新开始');
    assert.equal((await state()).modalOpen, false);
    assert.equal(await page.locator('.tile[data-fog="covered"]').count(), 36);
    assert.deepEqual(await page.locator('.tile .seaside-item').evaluateAll(icons => icons.map(icon => Number(icon.dataset.kind))), deck);
    // A late match still adds time, and the extended tide deadline still ends the run.
    await page.clock.runFor(58000);
    const beforeMatch = await state(); await reveal(0); await reveal(9);
    const afterMatch = await state();
    assert.equal(afterMatch.pairs, 1); assert.equal(afterMatch.bonusTime, 5000);
    assert.ok(Math.abs(afterMatch.remaining - beforeMatch.remaining - 5000 + afterMatch.activeTime - beforeMatch.activeTime) < 1);
    await page.clock.runFor(Math.ceil(afterMatch.remaining) + 40);
    assert.equal((await state()).failureReason, 'timeout');
    await action('重新挑战');
    assert.equal((await state()).modalOpen, false);
    // No inherited mistake limit, time penalty or required final/penultimate kind.
    for (let i = 0; i < 21; i++) {
      await reveal(0); await reveal(1); await page.clock.runFor(500);
    }
    assert.equal((await state()).mismatches, 21); assert.equal((await state()).state, 'playing');
    assert.equal((await state()).elapsed, (await state()).activeTime);
    for (const kind of [4, 2, 1, 5, 0]) for (let i = 0; i < deck.length; i++) if (deck[i] === kind) await reveal(i);
    await page.clock.runFor(800);
    assert.equal((await state()).state, 'won'); assert.equal((await state()).pairs, 18);
    assert.ok((await state()).bonusTime <= 90000);
    assert.equal(await page.locator('#modal-art .bucket-find').count(), 18);
    assert.equal(await page.evaluate(() => localStorage.getItem('beach-pairs-completed-levels')), null);
    await action('下一关');
    assert.equal((await state()).levelId, 21);
    assert.equal(await page.locator('#modal-heading').innerText(), '当太阳升起，你发现自己到了礁石岸边！');
    assert.equal(await page.locator('.tile.is-tangled').count(), 12);
    assert.deepEqual(errors, []);
    console.log('PASS: night-ten 6x6 fixed five-kind board, 36 fog masks, direct timed start, pause/refog, retry, bonus deadline, no inherited conditions, full victory and entry to the remade reef chapter. No images captured.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
