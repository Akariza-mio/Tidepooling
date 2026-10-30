// Functional checks only: no screenshots, previews or packages.
const { chromium } = require('C:/Users/29781/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const level = require('../levels.js').find(level => level.id === 15);
const url = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const snapshot = page => page.evaluate(() => beachDiagnostics.snapshot());
const action = (page, name) => page.getByRole('button', { name, exact: true }).click();
function plan(position, goal, collected) {
  const forbidden = new Set(level.treasures.filter(item => !collected.includes(item.index) && item.index !== goal).map(item => item.index));
  const queue = [[position]], seen = new Set([position]);
  for (const route of queue) {
    const last = route.at(-1);
    if (last === goal) return route.slice(1);
    for (const next of [last - 7, last + 7, last - 1, last + 1]) {
      if (next < 0 || next >= 49 || level.layout[next] < 0 || forbidden.has(next) || seen.has(next)
        || Math.abs(Math.floor(next / 7) - Math.floor(last / 7)) + Math.abs(next % 7 - last % 7) !== 1) continue;
      seen.add(next); queue.push([...route, next]);
    }
  }
  throw Error('No safe path to target');
}
async function walkTo(page, goal) {
  const state = await snapshot(page);
  for (const index of plan(state.journey.position, goal, state.journey.collected)) await page.locator('.journey-cell').nth(index).click();
}
async function win(page) {
  for (let i = (await snapshot(page)).journey.collectedCount; i < 5; i++) {
    const before = await snapshot(page);
    await walkTo(page, before.journey.targetIndex);
    const after = await snapshot(page);
    assert.equal(after.journey.collectedCount, i + 1);
    if (i < 4) {
      assert.notEqual(after.journey.targetKind, before.journey.targetKind);
      assert.ok(after.journey.targetRemaining > 14000);
    }
  }
  assert.equal((await snapshot(page)).state, 'won');
}
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    await page.clock.install();
    await page.addInitScript(() => localStorage.setItem('beach-pairs-unlock-all', 'on'));
    await page.goto(url);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('#select-level-button').click(); await page.locator('#chapter-next').click();
    assert.equal(await page.locator('#level-15').isEnabled(), true);
    assert.equal(await page.locator('#level-31').isDisabled(), true);
    await page.locator('#level-15').click();
    assert.equal((await snapshot(page)).journey.position, 24);
    assert.equal(await page.locator('.journey-cell').count(), 49);
    assert.equal(await page.locator('.journey-cell:enabled').count(), 0);
    assert.equal(await page.locator('#journey-target').isVisible(), true);
    assert.equal(await page.locator('.collection').isVisible(), false);
    assert.equal(await page.locator('#puzzle-controls').isVisible(), false);
    await page.clock.fastForward(90000);
    assert.equal((await snapshot(page)).remaining, 60000);
    await action(page, '我知道了');
    await page.clock.runFor(2000);
    await page.locator('#pause-button').click();
    const preview = (await snapshot(page)).journey.previewSeconds;
    await page.clock.fastForward(30000);
    assert.equal((await snapshot(page)).journey.previewSeconds, preview);
    await action(page, '继续赶海'); await page.clock.runFor(3200);
    assert.equal((await snapshot(page)).journey.phase, 'exploring');
    assert.deepEqual(await page.locator('.journey-cell[data-fog="clear"]').evaluateAll(cells => cells.map(cell => Number(cell.dataset.index))), [17, 23, 24, 25, 31]);
    assert.equal(await page.locator('.journey-cell').nth(1).locator('svg').count(), 0);
    assert.equal(await page.locator('#journey-target-art .seaside-item').count(), 1);
    assert.equal(await page.locator('.journey-catch').count(), 5);
    assert.deepEqual(await page.locator('.journey-catch > span').allTextContents(), ['扇贝', '螃蟹', '小虾', '海螺', '鱼儿']);
    assert.ok(['扇贝','螃蟹','小虾','海螺','鱼儿'].includes(await page.locator('#journey-target-name').innerText()));
    assert.equal(await page.locator('.journey-content .journey-symbol').count(), 1, 'Only footprints, no return bucket.');
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 1280, height: 720 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport); await page.clock.runFor(100);
      const fits = await page.evaluate(() => {
        const rect = id => document.getElementById(id).getBoundingClientRect();
        const target = rect('journey-target'), hint = rect('journey-hint'), board = rect('board'), panel = rect('journey-panel'), app = rect('app');
        return { fits: target.bottom <= hint.top && hint.bottom <= board.top && board.bottom <= panel.top && panel.bottom <= app.bottom + 1
          && board.left >= app.left && board.right <= app.right && panel.width <= app.width,
          target: target.toJSON(), hint: hint.toJSON(), board: board.toJSON(), panel: panel.toJSON(), app: app.toJSON() };
      });
      assert.equal(fits.fits, true, JSON.stringify({ viewport, ...fits }));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.clock.runFor(Math.ceil((await snapshot(page)).journey.targetRemaining - 2800));
    assert.equal(await page.locator('#journey-target').evaluate(element => element.classList.contains('is-urgent')), true);
    assert.equal(await page.locator('#journey-target-seconds').evaluate(element => getComputedStyle(element).animationName), 'target-shake');
    await page.locator('#pause-button').click();
    const paused = await snapshot(page);
    assert.equal(await page.locator('#journey-target-seconds').evaluate(element => getComputedStyle(element).animationPlayState), 'paused');
    await page.clock.fastForward(90000);
    assert.equal((await snapshot(page)).remaining, paused.remaining);
    assert.equal((await snapshot(page)).journey.targetRemaining, paused.journey.targetRemaining);
    await action(page, '继续赶海');
    const beforeMiss = await snapshot(page);
    await page.clock.runFor(Math.ceil(beforeMiss.journey.targetRemaining) + 20);
    assert.equal((await snapshot(page)).journey.penalties, 1);
    assert.notEqual((await snapshot(page)).journey.targetKind, beforeMiss.journey.targetKind);
    assert.ok((await snapshot(page)).journey.targetRemaining > 14000);
    assert.ok((await snapshot(page)).remaining < 25100);
    await page.clock.runFor(500);
    assert.ok((await snapshot(page)).displayedTide > beforeMiss.displayedTide + .25);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.runFor(Math.ceil((await snapshot(page)).journey.targetRemaining) + 20);
    assert.equal((await snapshot(page)).failureReason, 'timeout');
    assert.equal((await snapshot(page)).journey.penalties, 2);
    assert.equal(await page.locator('#modal-art .washed-bucket-art').count(), 1);
    await action(page, '重新挑战'); await action(page, '我知道了'); await page.clock.runFor(5100);
    const target = (await snapshot(page)).journey.targetKind;
    const wrong = level.treasures.find(item => item.kind !== target);
    await walkTo(page, wrong.index);
    assert.equal((await snapshot(page)).failureReason, 'wrongTarget');
    assert.equal(await page.locator('#modal-heading').innerText(), '碰错物品了');
    const names={0:'扇贝',1:'螃蟹',2:'小虾',4:'海螺',5:'鱼儿'};
    assert.ok((await page.locator('#modal-description').innerText()).startsWith('当前目标是'+names[target]+'，却碰到了'+names[wrong.kind]+'。'));
    assert.equal(await page.locator('#modal-art .condition-failure-art').count(), 1);
    assert.ok((await snapshot(page)).displayedTide < .2);
    await action(page, '重新挑战');
    assert.equal((await snapshot(page)).journey.collectedCount, 0);
    assert.equal((await snapshot(page)).journey.penalties, 0);
    await action(page, '我知道了'); await page.clock.runFor(5100);
    await page.clock.runFor(10000);
    const beforeFind = await snapshot(page);
    await walkTo(page, beforeFind.journey.targetIndex);
    const afterFind = await snapshot(page);
    assert.equal(afterFind.bonusTime, 0);
    assert.ok(afterFind.remaining <= beforeFind.remaining);
    assert.ok(afterFind.journey.targetRemaining > 14000);
    assert.equal(await page.locator('#journey-time-gain').count(), 0);
    await page.clock.runFor(600);
    assert.ok((await snapshot(page)).displayedTide >= beforeFind.displayedTide);
    await win(page);
    assert.equal(await page.locator('#modal-heading').innerText(), '目标全部找齐啦！');
    assert.equal(await page.locator('.journey-catch.is-picked').count(), 5);
    assert.equal(await page.locator('.journey-result-items .seaside-item').count(), 5);
    assert.equal(await page.evaluate(() => localStorage.getItem('beach-pairs-completed-levels')), null);
    await action(page, '下一关'); assert.equal(await page.locator('#modal-heading').innerText(), '挑战！');
    await action(page, '我知道了'); await page.locator('#pause-button').click();
    await action(page, '返回选关'); await page.locator('#level-14').click();
    assert.equal(await page.locator('#journey-target').isVisible(), false);
    assert.equal(await page.locator('#journey-panel').isVisible(), false);
    assert.equal(await page.locator('.collection').isVisible(), true);
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    const normal = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await normal.clock.install();
    await normal.addInitScript(() => localStorage.setItem('beach-pairs-completed-levels', '[14]'));
    await normal.goto(url); await normal.emulateMedia({ reducedMotion: 'reduce' });
    await normal.locator('#select-level-button').click(); await normal.locator('#chapter-next').click();
    assert.equal(await normal.locator('#level-15').isDisabled(), true);
    await normal.locator('#level-14').click(); await action(normal, '我知道了');
    const deck = await normal.locator('.tile .seaside-item').evaluateAll(icons => icons.map(icon => Number(icon.dataset.kind)));
    for (const kind of [0, 2, 4, 5, 1]) for (let i = 0; i < deck.length; i++) if (deck[i] === kind) {
      if (await normal.locator('.tile').nth(i).getAttribute('data-fog') === 'covered') await normal.locator('.tile').nth(i).click();
      await normal.locator('.tile').nth(i).click();
    }
    await normal.clock.runFor(800); await action(normal, '下一关'); await action(normal, '我知道了'); await normal.clock.runFor(5100);
    await win(normal);
    assert.deepEqual(await normal.evaluate(() => JSON.parse(localStorage.getItem('beach-pairs-completed-levels'))), [14, 15]);
    console.log('PASS: 7x7 center/cross vision, five viewport layouts, random nonrepeating targets, urgent countdown shake and pause, target miss/tide penalty, wrong-object instant failure, five-object immediate victory, retries, real/test progress and no mode leakage. No images captured.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
