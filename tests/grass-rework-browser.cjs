// Fixtures are injected only into this isolated test page. They are not authored levels.
// No screenshots, previews or archives are generated.
const { chromium } = require('./browser-support.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const url = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
  try {
    const normal = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await normal.addInitScript(() => {
      localStorage.setItem('beach-pairs-unlock-all', 'on');
      if (!sessionStorage.getItem('grass-fixture-seeded')) {
        localStorage.setItem('beach-pairs-completed-levels', '[1,12,20,21,22]');
        sessionStorage.setItem('grass-fixture-seeded', 'yes');
      }
    });
    await normal.goto(url); await normal.emulateMedia({ reducedMotion: 'reduce' });
    assert.deepEqual(await normal.evaluate(() => JSON.parse(localStorage.getItem('beach-pairs-completed-levels'))), [1,12,20]);
    assert.equal(await normal.evaluate(() => BeachLevels.length), 32);
    await normal.locator('#select-level-button').click();
    await normal.locator('#chapter-next').click(); await normal.locator('#chapter-next').click();
    assert.equal(await normal.locator('#chapter-3 .chapter-level:enabled').count(), 10);
    assert.equal(await normal.locator('#chapter-reef-scene').isVisible(), true);
    assert.equal(await normal.locator('#chapter-3 .chapter-progress').innerText(), '已通关 0 / 10');
    // The migration runs once, so future remade levels may save new progress.
    await normal.evaluate(() => localStorage.setItem('beach-pairs-completed-levels', '[1,12,20,21]'));
    await normal.reload();
    assert.deepEqual(await normal.evaluate(() => JSON.parse(localStorage.getItem('beach-pairs-completed-levels'))), [1,12,20,21]);
    await normal.close();

    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.clock.install();
    await page.addInitScript(() => {
      localStorage.setItem('beach-pairs-unlock-all', 'on');
      let definitions;
      Object.defineProperty(window, 'BeachLevels', { configurable: true,
        get: () => definitions,
        set: levels => { definitions = [...levels.filter(level => level.id !== 21), { id: 21, rows: 4, columns: 4, duration: 60000, pairBonus: 5000,
          intro: 'seagrass', seagrass: { cells: [5] }, layout: [0,1,2,3,0,1,2,3,2,3,0,1,2,3,0,1] }]; }
      });
    });
    await page.goto(url); await page.emulateMedia({ reducedMotion: 'reduce' });
    const state = () => page.evaluate(() => beachDiagnostics.snapshot());
    const action = name => page.getByRole('button', { name, exact: true }).click();
    const tile = index => page.locator('.tile').nth(index);
    await page.locator('#select-level-button').click();
    await page.locator('#chapter-next').click(); await page.locator('#chapter-next').click();
    await page.locator('#level-21').click();
    assert.equal(await page.locator('#modal-heading').innerText(), '当太阳升起，你发现自己到了礁石岸边！');
    assert.match(await page.locator('#modal-description').innerText(), /如果配对失败，一段时间内该格将被海草缠绕，不可再翻开，且四面相邻的格子都会被海草覆盖/);
    await page.clock.fastForward(30000); assert.equal((await state()).remaining, 60000);
    await action('我知道了');
    assert.equal(await tile(5).isEnabled(), true);
    await tile(5).click();
    assert.equal(await tile(5).locator('.seagrass-cover').evaluate(element => getComputedStyle(element).opacity), '0');
    await tile(4).click();
    assert.equal((await state()).statuses[5], 'open');
    assert.deepEqual((await state()).seagrass.flatMap((card, i) => card.grass ? [i] : []), [1,5,6,9]);
    assert.equal(await tile(5).locator('.seagrass-cover').evaluate(element => getComputedStyle(element).opacity), '0');
    await page.clock.runFor(520);
    assert.equal((await state()).statuses[5], 'hidden');
    assert.equal(await tile(5).isDisabled(), true); assert.equal(await tile(4).isEnabled(), true);
    assert.equal(await tile(5).locator('.locked-seagrass-art').evaluate(element => getComputedStyle(element).display), 'block');
    assert.equal(await tile(5).locator('.seagrass-art').evaluate(element => getComputedStyle(element).display), 'none');
    assert.match(await tile(5).getAttribute('aria-label'), /紫色交叉海草/);
    await tile(5).evaluate(element => element.click()); assert.equal((await state()).turns, 1);
    await page.locator('#pause-button').click(); const paused = await state();
    await page.clock.fastForward(30000);
    assert.equal((await state()).activeTime, paused.activeTime); assert.equal((await state()).seagrass[5].locked, true);
    await action('继续赶海');
    const remaining = (await state()).seagrass[5].until - (await state()).activeTime;
    await page.clock.runFor(Math.max(0, Math.floor(remaining - 100)));
    assert.equal((await state()).seagrass[5].locked, true);
    await page.clock.runFor(150);
    assert.equal(await tile(5).isEnabled(), true); assert.match(await tile(5).getAttribute('aria-label'), /绿色海草格/);
    assert.equal(await tile(5).locator('.locked-seagrass-art').evaluate(element => getComputedStyle(element).display), 'none');
    await tile(9).click(); await tile(2).click(); await page.clock.runFor(520);
    assert.equal((await state()).seagrass[9].locked, true);
    assert.equal((await state()).seagrass[2].grass, false); assert.equal((await state()).seagrass[8].grass, true);
    assert.equal(await tile(8).isEnabled(), true);
    await page.locator('#pause-button').click(); await action('重新开始');
    assert.equal(await page.locator('.tile.is-tangled').count(), 1);
    assert.equal(await page.locator('.tile.is-grass-locked').count(), 0);
    assert.equal(await page.locator('#modal-heading').innerText(), '当太阳升起，你发现自己到了礁石岸边！');
    assert.deepEqual(errors, []);
    console.log('PASS: remade first reef level available, old progress invalidated once, theme retained; synthetic fixture verifies directly playable green grass, one-ring propagation, newly infected behavior, purple X lock, ten-second recovery, pause and retry. No images captured.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
