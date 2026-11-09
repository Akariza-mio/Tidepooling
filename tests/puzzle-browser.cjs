// Functional browser acceptance only: this script never captures screenshots.
const { chromium } = require('./browser-support.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const url = pathToFileURL(path.join(process.env.BEACH_GAME_DIR || path.resolve(__dirname, '..'), 'index.html')).href;
const solution = [0, 1, 2, 4, 2, 4, 0, 1, 4, 2, 1, 0, 1, 0, 4, 2];
const sixthSolution = [0, 2, 5, 1, 4, 1, 4, 0, 2, 5, 2, 5, 1, 4, 0, 4, 0, 2, 5, 1, 5, 1, 4, 0, 2];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [], externalRequests = [];
  const setup = async (init) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) externalRequests.push(request.url()); });
    await page.clock.install();
    if (init) await page.addInitScript(init);
    await page.goto(url);
    return page;
  };
  const snapshot = page => page.evaluate(() => beachDiagnostics.snapshot());
  const action = (page, name) => page.getByRole('button', { name, exact: true }).click();
  const tool = (page, kind) => page.locator(`.puzzle-tool[data-kind="${kind}"]`).click();
  const fill = async (page, values = solution) => {
    const { fixed } = await snapshot(page);
    for (const kind of [...new Set(values)]) {
      await tool(page, kind);
      for (let i = 0; i < values.length; i++) {
        if (values[i] === kind && !fixed[i]) await page.locator('.puzzle-cell').nth(i).click();
      }
    }
    await page.clock.runFor(700);
  };
  try {
    const page = await setup(() => localStorage.setItem('beach-pairs-completed-levels', '[1,2,3,4]'));
    await page.locator('#select-level-button').click();
    assert.equal(await page.locator('.chapter-level.is-minigame').count(), 10);
    const markedCorrectly = await page.locator('.chapter-level').evaluateAll(buttons => buttons.every(button => {
      const slot = (Number(button.dataset.level) - 1) % 10;
      return button.classList.contains('is-minigame') === (slot === 4 || slot === 5);
    }));
    assert.equal(markedCorrectly, true);
    const redCards = async () => page.locator('.chapter-level.is-minigame').evaluateAll(buttons => buttons.every(button => {
      const [red, green, blue] = getComputedStyle(button).backgroundColor.match(/[\d.]+/g).map(Number);
      return red > green + 10 && red > blue + 10;
    }));
    assert.equal(await redCards(), true, 'All five chapters use coral cards, including unopened slots.');
    await page.locator('#level-4').click();
    await action(page, '我知道了');
    // Real normal-mode progression from the fourth matching level into the fifth.
    for (const kind of [0, 1, 2, 4]) {
      const indices = await page.locator('.tile').evaluateAll((tiles, kind) => tiles.filter(tile => tile.querySelector('.seaside-item').dataset.kind === String(kind)).map(tile => Number(tile.dataset.index)), kind);
      for (const index of indices) await page.locator('.tile').nth(index).click();
    }
    await page.clock.runFor(700);
    await action(page, '下一关');
    assert.equal((await snapshot(page)).levelId, 5);
    assert.equal(await page.locator('#modal-heading').innerText(), '挑战！');
    assert.equal(await page.locator('#modal-description').innerText(), '在涨潮前选择物品填满棋盘，让每行，每列和对角线都不重复，即可完成挑战！');
    await page.clock.fastForward(90000);
    assert.equal((await snapshot(page)).elapsed, 0);
    assert.equal((await snapshot(page)).displayedTide, 0);
    assert.equal((await snapshot(page)).filledCount, 2);
    assert.equal((await snapshot(page)).duration, 60000);
    assert.equal(await page.locator('.puzzle-cell:disabled').count(), 2);
    assert.equal(await page.locator('.puzzle-status, #puzzle-progress').count(), 0);
    assert.equal(await page.locator('#puzzle-controls').innerText().then(text => text.includes('预放格不可修改')), false);
    const backgrounds = await page.locator('.puzzle-cell').evaluateAll(cells => cells.map(cell => getComputedStyle(cell).backgroundImage));
    assert.equal(backgrounds[0], backgrounds[15]);
    assert.notEqual(backgrounds[0], backgrounds[1]);
    assert.equal(await page.locator('.puzzle-tool').count(), 5);
    assert.equal(await page.locator('.puzzle-diagonal').count(), 8);
    assert.equal(await page.locator('#puzzle-sand-background').isVisible(), true);
    assert.equal(await page.locator('#puzzle-sand-background use').count(), 8);
    await action(page, '我知道了');
    assert.equal((await snapshot(page)).timerRunning, true);
    assert.equal(await page.locator('.collection').isVisible(), false);
    assert.equal(await page.locator('#level-objectives').isVisible(), false);
    // No screenshot output: measure containment, overlap and actual pointer targets.
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 1280, height: 720 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await page.clock.runFor(400);
      const layout = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect();
        const app = rect('#app'), header = rect('.play-header'), rules = rect('#puzzle-rules'), board = rect('#board'), controls = rect('#puzzle-controls');
        return {
          ordered: header.bottom <= rules.top && rules.bottom <= board.top && board.bottom <= controls.top,
          contained: controls.bottom <= app.bottom && board.left >= app.left && board.right <= app.right && document.documentElement.scrollWidth <= innerWidth,
          drawingsVisible: [...document.querySelectorAll('.sand-matrices-art > g > g')].every(group => {
            const box = group.getBoundingClientRect();
            const middle = box.top + box.height / 2;
            return middle > board.bottom && middle < controls.top;
          }),
          hits: [...document.querySelectorAll('.puzzle-cell:not(:disabled), .puzzle-tool')].every(button => {
            const box = button.getBoundingClientRect();
            const target = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
            return target && (target === button || button.contains(target));
          })
        };
      });
      assert.deepEqual(layout, { ordered: true, contained: true, drawingsVisible: true, hits: true }, JSON.stringify({ viewport, layout }));
      await page.locator('#pause-button').click();
      await page.clock.runFor(400);
      const fits = await page.locator('#modal-card').evaluate(card => {
        const box = card.getBoundingClientRect();
        return box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth;
      });
      assert.equal(fits, true, JSON.stringify(viewport));
      assert.equal(await page.locator('#modal-description').innerText(), '游戏已暂停\n当前已填 2 / 16 格');
      await action(page, '继续赶海');
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await tool(page, 0);
    await page.locator('.puzzle-cell').nth(1).click();
    assert.deepEqual((await snapshot(page)).conflicts, [0, 1]);
    assert.equal(await page.locator('.puzzle-conflict').count(), 2);
    await tool(page, 'erase');
    await page.locator('.puzzle-cell').nth(1).click();
    assert.equal((await snapshot(page)).filledCount, 2);
    assert.equal(await page.locator('.puzzle-conflict').count(), 0);
    await tool(page, 1);
    await page.locator('.puzzle-cell').nth(1).click();
    await page.locator('#pause-button').click();
    const paused = await snapshot(page);
    await page.clock.fastForward(60000);
    assert.equal((await snapshot(page)).remaining, paused.remaining);
    assert.equal((await snapshot(page)).filledCount, 3);
    await action(page, '重新开始');
    assert.equal(await page.locator('#modal-heading').innerText(), '挑战！');
    assert.equal((await snapshot(page)).filledCount, 2);
    assert.equal((await snapshot(page)).remaining, 60000);
    await action(page, '我知道了');
    await fill(page);
    assert.equal((await snapshot(page)).state, 'won');
    assert.equal((await snapshot(page)).bonusTime, 0);
    assert.equal((await snapshot(page)).bucketPairs, 0);
    assert.equal(await page.locator('#modal-heading').innerText(), '挑战成功！');
    assert.equal(await page.locator('.puzzle-complete-art .seaside-item').count(), 16);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('beach-pairs-completed-levels')).includes(5)), true);
    await action(page, '下一关');
    assert.equal((await snapshot(page)).levelId, 6);
    assert.equal(await page.locator('#modal-heading').innerText(), '新品种增加 —— 鱼儿');
    assert.equal(await page.locator('#modal-art .seaside-item[data-kind="5"]').count(), 1);
    assert.equal(await page.locator('#modal-card').evaluate(card => card.classList.contains('species-card')), true);
    assert.equal((await snapshot(page)).filledCount, 4);
    assert.equal((await snapshot(page)).duration, 90000);
    assert.equal(await page.locator('.puzzle-cell').count(), 25);
    assert.equal(await page.locator('.puzzle-cell:disabled').count(), 4);
    assert.equal(await page.locator('.puzzle-diagonal').count(), 9);
    assert.equal(await page.locator('.puzzle-tool').count(), 6);
    assert.equal(await page.locator('.puzzle-tool[data-kind="5"]').innerText(), '鱼儿');
    assert.equal(await page.locator('#puzzle-sand-background').isVisible(), true);
    await page.clock.fastForward(120000);
    assert.equal((await snapshot(page)).remaining, 90000);
    assert.equal((await snapshot(page)).displayedTide, 0);
    await action(page, '我知道了');
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 1280, height: 720 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await page.clock.runFor(400);
      const usable = await page.evaluate(() => {
        const app = document.getElementById('app').getBoundingClientRect();
        const board = document.getElementById('board').getBoundingClientRect();
        const controls = document.getElementById('puzzle-controls').getBoundingClientRect();
        return board.bottom <= controls.top && controls.bottom <= app.bottom && [...document.querySelectorAll('.puzzle-cell:not(:disabled), .puzzle-tool')].every(button => {
          const box = button.getBoundingClientRect();
          const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          return hit && (hit === button || button.contains(hit));
        });
      });
      assert.equal(usable, true, JSON.stringify(viewport));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await tool(page, 5);
    await page.locator('.puzzle-cell').nth(2).click();
    assert.equal((await snapshot(page)).values[2], 5);
    await page.locator('#pause-button').click();
    assert.equal(await page.locator('#modal-description').innerText(), '游戏已暂停\n当前已填 5 / 25 格');
    const sixthPaused = await snapshot(page);
    await page.clock.fastForward(100000);
    assert.equal((await snapshot(page)).remaining, sixthPaused.remaining);
    await action(page, '重新开始');
    assert.equal(await page.locator('#modal-heading').innerText(), '新品种增加 —— 鱼儿');
    assert.equal((await snapshot(page)).filledCount, 4);
    await action(page, '我知道了');
    await fill(page, sixthSolution);
    assert.equal((await snapshot(page)).state, 'won');
    assert.equal(await page.locator('.puzzle-complete-art .seaside-item').count(), 25);
    assert.equal(await page.locator('.puzzle-complete-art').evaluate(board => getComputedStyle(board).gridTemplateColumns.split(' ').length), 5);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('beach-pairs-completed-levels')).includes(6)), true);
    await action(page, '下一关');
    assert.equal((await snapshot(page)).levelId, 7);
    assert.equal((await snapshot(page)).mode, 'matching');
    assert.equal((await snapshot(page)).modalOpen, false);
    assert.equal(await page.locator('#puzzle-controls').isVisible(), false);
    assert.equal(await page.locator('.collection').isVisible(), true);
    assert.equal(await page.locator('#level-objectives').isVisible(), false);
    assert.equal(await page.locator('#puzzle-sand-background').isVisible(), false);
    assert.equal((await snapshot(page)).duration, 60000);
    for (const kind of [0, 1, 2, 4, 5]) {
      const indices = await page.locator('.tile').evaluateAll((tiles, kind) => tiles.filter(tile => tile.querySelector('.seaside-item').dataset.kind === String(kind)).map(tile => Number(tile.dataset.index)), kind);
      for (const index of indices) await page.locator('.tile').nth(index).click();
    }
    await page.clock.runFor(700);
    assert.equal((await snapshot(page)).state, 'won');
    assert.equal((await snapshot(page)).pairs, 12);
    assert.ok((await snapshot(page)).bonusTime <= 60000);
    assert.equal(await page.locator('#modal-art .bucket-find').count(), 12);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('beach-pairs-completed-levels')).includes(7)), true);
    await action(page, '下一关');
    assert.equal((await snapshot(page)).levelId, 8);
    assert.equal((await snapshot(page)).rows, 6);
    assert.equal((await snapshot(page)).columns, 6);
    assert.equal((await snapshot(page)).totalPairs, 18);
    assert.equal((await snapshot(page)).duration, 60000);
    assert.equal((await snapshot(page)).modalOpen, false);
    assert.deepEqual((await snapshot(page)).conditions, []);
    assert.equal(await page.locator('.tile').count(), 36);
    const eighthLayout = await page.locator('.tile .seaside-item').evaluateAll(icons => icons.map(icon => icon.dataset.kind));
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 1280, height: 720 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await page.clock.runFor(400);
      const usable = await page.evaluate(() => {
        const app = document.getElementById('app').getBoundingClientRect();
        const board = document.getElementById('board').getBoundingClientRect();
        const footer = document.querySelector('.collection').getBoundingClientRect();
        const header = document.querySelector('.play-header').getBoundingClientRect();
        return header.bottom <= board.top && board.bottom <= footer.top && footer.bottom <= app.bottom + 1 && board.left >= app.left && board.right <= app.right && [...document.querySelectorAll('.tile')].every(button => {
          const box = button.getBoundingClientRect();
          const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          return hit && (hit === button || button.contains(hit));
        });
      });
      assert.equal(usable, true, JSON.stringify({ level: 8, viewport }));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.tile').nth(0).click();
    await page.locator('.tile').nth(1).click();
    // The 500 ms rule resolves on the next 60 Hz render, so allow a frame margin.
    await page.clock.runFor(550);
    assert.equal((await snapshot(page)).pairs, 0);
    assert.equal(await page.locator('.tile[data-status="hidden"]').count(), 36);
    await page.locator('#pause-button').click();
    assert.equal(await page.locator('#modal-description').innerText(), '游戏已暂停\n当前已收集 0 / 18 对');
    await action(page, '重新开始');
    assert.equal((await snapshot(page)).modalOpen, false);
    assert.deepEqual(await page.locator('.tile .seaside-item').evaluateAll(icons => icons.map(icon => icon.dataset.kind)), eighthLayout);
    for (const kind of [0, 1, 2, 4, 5]) {
      const indices = await page.locator('.tile').evaluateAll((tiles, kind) => tiles.filter(tile => tile.querySelector('.seaside-item').dataset.kind === String(kind)).map(tile => Number(tile.dataset.index)), kind);
      for (const index of indices) await page.locator('.tile').nth(index).click();
    }
    await page.clock.runFor(700);
    assert.equal((await snapshot(page)).state, 'won');
    assert.equal((await snapshot(page)).pairs, 18);
    assert.ok((await snapshot(page)).bonusTime <= 90000);
    assert.equal(await page.locator('#modal-art .bucket-find').count(), 18);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('beach-pairs-completed-levels')).includes(8)), true);
    await action(page, '下一关');
    assert.equal((await snapshot(page)).levelId, 9);
    assert.equal(await page.locator('#modal-heading').innerText(), '本关胜利条件');
    await action(page, '我知道了');
    await page.locator('#pause-button').click();
    await action(page, '返回选关');
    assert.equal(await page.locator('#level-5').isEnabled(), true);
    assert.equal(await page.locator('#level-6').isEnabled(), true);
    assert.equal(await page.locator('#level-7').isEnabled(), true);
    assert.equal(await page.locator('#level-8').isEnabled(), true);
    assert.equal(await page.locator('#level-9').isDisabled(), false);
    assert.equal(await redCards(), true, 'Completed minigames retain the coral design.');
    await page.locator('#level-6').click();
    await action(page, '我知道了');
    await page.clock.fastForward(60001);
    assert.equal((await snapshot(page)).state, 'playing');
    await page.clock.fastForward(30001);
    await page.clock.runFor(700);
    assert.equal((await snapshot(page)).failureReason, 'timeout');
    await action(page, '返回选关');
    await page.locator('#level-5').click();
    await action(page, '我知道了');
    await page.clock.fastForward(30001);
    assert.equal((await snapshot(page)).state, 'playing', 'The fifth level must remain playable after 30 seconds.');
    await page.clock.fastForward(30001);
    await page.clock.runFor(700);
    assert.equal((await snapshot(page)).failureReason, 'timeout');
    assert.equal(await page.locator('#modal-heading').innerText(), '潮水先到了一步');
    assert.match(await page.locator('#modal-description').innerText(), /2 \/ 16 格/);
    await action(page, '返回选关');
    await page.locator('#level-2').click();
    assert.equal((await snapshot(page)).mode, 'matching');
    assert.equal(await page.locator('#puzzle-controls').isVisible(), false);
    assert.equal(await page.locator('#puzzle-rules').isVisible(), false);
    assert.equal(await page.locator('#puzzle-sand-background').isVisible(), false);
    assert.equal(await page.locator('.collection').isVisible(), true);
    await page.locator('.tile').nth(0).click();
    await page.locator('.tile').nth(3).click();
    assert.equal((await snapshot(page)).pairs, 1);
    assert.ok((await snapshot(page)).bonusTime <= 5000);
    await page.close();

    const testing = await setup(() => {
      localStorage.setItem('beach-pairs-unlock-all', 'on');
      localStorage.setItem('beach-pairs-completed-levels', '[1]');
    });
    await testing.locator('#select-level-button').click();
    assert.equal(await testing.locator('.chapter-level:enabled').count(), 50);
    assert.equal(await testing.locator('#level-5').evaluate(button => button.classList.contains('is-unlocked') && getComputedStyle(button).backgroundColor !== getComputedStyle(document.getElementById('level-7')).backgroundColor), true);
    await testing.locator('#level-5').click();
    await action(testing, '我知道了');
    await fill(testing);
    assert.deepEqual(await testing.evaluate(() => JSON.parse(localStorage.getItem('beach-pairs-completed-levels'))), [1]);
    await action(testing, '下一关');
    await action(testing, '我知道了');
    await fill(testing, sixthSolution);
    assert.equal((await snapshot(testing)).state, 'won');
    assert.deepEqual(await testing.evaluate(() => JSON.parse(localStorage.getItem('beach-pairs-completed-levels'))), [1]);
    await testing.close();
    assert.deepEqual(errors, []);
    assert.deepEqual(externalRequests, []);
    console.log('PASS: progression through level 8, coral minigame cards, puzzle rules, 6x6 board in five viewports, 500ms mismatch, fixed-layout retry, 18 pairs/full bucket/bonus/saved win, separate test progress, offline/no browser errors. No images captured.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
