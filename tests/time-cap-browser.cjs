// Functional checks only. No screenshots, previews or archives.
const { chromium } = require('./browser-support.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-10-29T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-29T00:00:01Z'));
    await page.addInitScript(() => localStorage.setItem('beach-pairs-unlock-all', 'on'));
    await page.goto(pathToFileURL(path.join(__dirname, '..', 'index.html')).href);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const state = () => page.evaluate(() => beachDiagnostics.snapshot());
    await page.locator('#select-level-button').click(); await page.locator('#level-2').click();
    const deck = await page.locator('.tile .seaside-item').evaluateAll(items => items.map(item => Number(item.dataset.kind)));
    const used = new Set();
    const match = async () => {
      const a = deck.findIndex((_, i) => !used.has(i));
      const b = deck.findIndex((value, i) => i !== a && !used.has(i) && value === deck[a]);
      for (const index of [a,b]) { await page.locator('.tile').nth(index).click(); used.add(index); }
    };
    await page.clock.runFor(1000);
    await match(); assert.equal((await state()).remaining, 60000);
    assert.equal(await page.locator('#time-reward').innerText(), '+1 秒');
    await match(); await match(); assert.equal((await state()).remaining, 60000);
    await page.clock.runFor(1000);
    assert.ok(Math.abs((await state()).remaining - 59000) < 20);
    await page.locator('#pause-button').click(); const paused = await state();
    await page.clock.fastForward(100000); assert.equal((await state()).remaining, paused.remaining);
    await page.getByRole('button', {name:'继续赶海',exact:true}).click();
    await page.clock.runFor(7000);
    const before = await state(); await match(); const after = await state();
    assert.equal(after.bonusTime - before.bonusTime, 5000);
    assert.ok(after.remaining <= after.duration);
    await page.clock.fastForward(1); await match(); assert.equal((await state()).remaining, 60000);
    await page.clock.fastForward(60001);
    assert.equal((await state()).failureReason, 'timeout');
    await page.getByRole('button', {name:'重新挑战',exact:true}).click();
    assert.equal((await state()).remaining, 60000); assert.equal((await state()).bonusTime, 0);
    assert.deepEqual(errors, []);
    console.log('PASS: 59-to-60 cap, actual reward feedback, rapid matches without hidden time, full reward below cap, pause, exact timeout and retry. No images captured.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
