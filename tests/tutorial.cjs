const { chromium } = require('C:/Users/29781/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    await page.clock.install();
    const root = process.env.BEACH_GAME_DIR || path.resolve(__dirname, '..');
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
    const state = () => page.evaluate(() => beachDiagnostics.snapshot());
    const capture = name => page.screenshot({ path: path.resolve(__dirname, '../preview/' + name), animations: 'disabled' });
    async function guidedClick() {
      assert.equal(await page.locator('.tile:enabled').count(), 1);
      const target = (await state()).tutorialTarget;
      await page.locator('.tile').nth(target).click();
      return target;
    }
    async function layoutCheck() {
      await page.clock.runFor(400);
      const layout = await page.evaluate(() => {
        const app = document.getElementById('app').getBoundingClientRect();
        const coach = document.getElementById('tutorial-coach').getBoundingClientRect();
        const board = document.getElementById('board').getBoundingClientRect();
        const footer = document.querySelector('.collection').getBoundingClientRect();
        const header = document.querySelector('.play-header').getBoundingClientRect();
        return { viewport: [innerWidth, innerHeight], appBottom: app.bottom, footerBottom: footer.bottom,
          noOverlap: coach.top >= header.bottom - 1 && coach.bottom <= board.top + 1 && board.bottom <= footer.top + 1,
          contained: board.left >= app.left - 1 && board.right <= app.right + 1 && footer.bottom <= app.bottom + 1,
          overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.equal(layout.noOverlap, true, JSON.stringify(layout));
      assert.equal(layout.contained, true, JSON.stringify(layout));
      assert.equal(layout.overflow, false);
    }
    await page.locator('#start-button').click();
    assert.equal((await state()).tutorialStep, 'choice');
    await page.clock.fastForward(150000);
    assert.equal((await state()).elapsed, 0);
    assert.equal((await state()).state, 'playing');
    await capture('24-tutorial-choice.png');
    await page.getByRole('button', { name: '开始教学', exact: true }).click();
    await layoutCheck();
    assert.equal(await page.locator('#back-button').count(), 0);
    assert.equal(await page.locator('.play-header button').count(), 1);
    assert.equal(await page.locator('.harvest-rule, #play-hint').count(), 0);
    await capture('25-tutorial-first.png');
    const before = (await state()).statuses;
    await page.locator('.tile').nth(5).evaluate(tile => tile.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    assert.deepEqual((await state()).statuses, before, 'Even dispatched off-target clicks cannot bypass guidance.');
    const first = await guidedClick();
    const second = (await state()).tutorialTarget;
    const kinds = await page.locator('.tile .seaside-item').evaluateAll(icons => icons.map(icon => icon.dataset.kind));
    assert.equal(kinds[first], kinds[second]);
    await guidedClick();
    assert.equal((await state()).tutorialStep, 'success');
    assert.equal((await state()).pairs, 1);
    assert.equal((await state()).bonusTime, 5000);
    assert.equal(await page.locator('.tile:enabled').count(), 0);
    await page.clock.runFor(700);
    assert.equal(await page.locator('#bucket-contents .bucket-find').count(), 1);
    await capture('26-tutorial-match.png');
    await page.locator('#tutorial-next').click();
    const differentA = await guidedClick();
    const differentB = (await state()).tutorialTarget;
    assert.notEqual(kinds[differentA], kinds[differentB]);
    await guidedClick();
    assert.equal((await state()).tutorialStep, 'mismatch');
    assert.equal(await page.locator('.tile[data-status="open"]').count(), 2);
    await page.locator('#pause-button').click();
    await page.clock.fastForward(10000);
    assert.equal(await page.locator('.tile[data-status="open"]').count(), 2);
    assert.equal((await state()).elapsed, 0);
    await page.getByRole('button', { name: '继续赶海', exact: true }).click();
    await page.clock.runFor(600);
    assert.equal((await state()).tutorialStep, 'mismatch-done');
    assert.equal(await page.locator('.tile[data-status="open"]').count(), 0);
    await page.locator('#tutorial-next').click();
    assert.equal((await state()).tutorialStep, 'tide');
    assert.equal(await page.locator('#tutorial-tide-arrow').isVisible(), true);
    await layoutCheck();
    await capture('27-tutorial-tide.png');
    await page.clock.fastForward(150000);
    assert.equal((await state()).elapsed, 0);
    assert.equal((await state()).progress, 0);
    assert.equal((await state()).displayedTide, 0);
    await page.locator('#tutorial-next').click();
    let actual = await state();
    assert.equal(actual.tutorialStep, null);
    assert.equal(actual.timerRunning, true);
    assert.equal(actual.pairs, 1);
    assert.ok(actual.remaining > 64500);
    assert.equal(await page.locator('.tile:enabled').count(), 14);
    await page.clock.runFor(1100);
    assert.ok((await state()).elapsed >= 1000);
    assert.equal(await page.locator('#bucket-contents .bucket-find').count(), 1);
    // Complete the same live board, including the pair earned in the tutorial.
    const groups = {};
    kinds.forEach((kind, index) => { if (index !== first && index !== second) (groups[kind] ||= []).push(index); });
    for (const group of Object.values(groups)) for (const index of group) await page.locator('.tile').nth(index).click();
    await page.clock.runFor(700);
    assert.equal((await state()).state, 'won');
    assert.equal(await page.locator('#bucket-contents .bucket-find').count(), 8);
    await page.getByRole('button', { name: '返回选关', exact: true }).click();
    await page.locator('#level-one').click();
    assert.equal((await state()).tutorialStep, 'choice');
    await page.getByRole('button', { name: '跳过教程', exact: true }).click();
    assert.equal((await state()).pairs, 0);
    assert.equal((await state()).bonusTime, 0);
    assert.equal(await page.locator('.tile:enabled').count(), 16);
    await page.locator('#pause-button').click();
    await page.getByRole('button', { name: '返回选关', exact: true }).click();
    await page.locator('#level-one').click();
    assert.equal((await state()).tutorialStep, 'choice', 'Replay from chapter selection also offers the tutorial.');
    await page.getByRole('button', { name: '开始教学', exact: true }).click();
    await page.locator('#pause-button').click();
    await page.getByRole('button', { name: '重新开始', exact: true }).click();
    assert.equal((await state()).tutorialStep, 'choice');
    await page.getByRole('button', { name: '跳过教程', exact: true }).click();
    await page.locator('#pause-button').click();
    await page.getByRole('button', { name: '返回选关', exact: true }).click();
    await page.locator('#level-screen [data-menu]').click();
    for (const viewport of [{ width: 320, height: 568 }, { width: 430, height: 932 }, { width: 1280, height: 720 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await page.locator('#start-button').click();
      await page.getByRole('button', { name: '开始教学', exact: true }).click();
      await layoutCheck();
      await guidedClick();
      await guidedClick();
      await layoutCheck();
      await capture(`28-tutorial-${viewport.width}x${viewport.height}.png`);
      await page.locator('#tutorial-next').click();
      await guidedClick();
      await guidedClick();
      await page.clock.runFor(650);
      await page.locator('#tutorial-next').click();
      await layoutCheck();
      await page.locator('#tutorial-next').click();
      await page.locator('#pause-button').click();
      await page.getByRole('button', { name: '返回选关', exact: true }).click();
      await page.locator('#level-screen [data-menu]').click();
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
    console.log('PASS: guided real match/mismatch, click restrictions, no countdown/tide rise, pause freezes mismatch, real rewards and bucket, completion/win, repeat/replay/restart offers, skip, five viewport layouts, zero JS errors or external requests.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
