// Functional acceptance only; no preview images or screenshots.
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
    await page.addInitScript(() => localStorage.setItem('beach-pairs-completed-levels', '[9]'));
    const url = pathToFileURL(path.join(process.env.BEACH_GAME_DIR || path.resolve(__dirname, '..'), 'index.html')).href;
    await page.goto(url);
    const state = () => page.evaluate(() => beachDiagnostics.snapshot());
    const action = name => page.getByRole('button', { name, exact: true }).click();
    const values = () => page.locator('.tile .seaside-item').evaluateAll(icons => icons.map(icon => Number(icon.dataset.kind)));
    async function collectAll() {
      for (const kind of [0, 1, 2, 4, 5]) {
        const indices = await page.locator('.tile[data-status="hidden"]').evaluateAll((tiles, kind) => tiles.filter(tile => tile.querySelector('.seaside-item').dataset.kind === String(kind)).map(tile => Number(tile.dataset.index)), kind);
        for (const index of indices) await page.locator('.tile').nth(index).click();
      }
      await page.clock.runFor(700);
    }
    await page.locator('#select-level-button').click();
    await page.locator('#level-9').click();
    await action('我知道了');
    await collectAll();
    await action('下一关');
    const initial = await state();
    assert.equal(initial.levelId, 10);
    assert.equal(initial.rows, 8);
    assert.equal(initial.columns, 8);
    assert.equal(initial.totalPairs, 32);
    assert.equal(initial.duration, 120000);
    assert.equal(initial.modalOpen, true);
    assert.equal(initial.timerRunning, false);
    assert.equal(initial.conditions[0].type, 'noPairBonus');
    const rule = '此关配对成功将不会奖励时间';
    assert.equal(await page.locator('#modal-art .notice-board-art').count(), 1);
    assert.equal(await page.locator('#modal-conditions').innerText(), rule);
    assert.doesNotMatch(await page.locator('#modal-description').innerText(), /2分钟|2 分钟|120/);
    await page.clock.fastForward(30000); assert.equal((await state()).remaining, 120000);
    await action('我知道了');
    assert.equal(await page.locator('.tile').count(), 64);
    assert.equal(await page.locator('#play-number').innerText(), '10');
    assert.equal(await page.locator('#level-objectives').isVisible(), true);
    assert.equal(await page.locator('#puzzle-controls').isVisible(), false);
    const authored = await values();
    assert.deepEqual([...new Set(authored)].sort(), [0, 1, 2, 4, 5]);
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 1280, height: 720 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await page.clock.runFor(400);
      const layout = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect();
        const app = rect('#app'), header = rect('.play-header'), board = rect('#board'), footer = rect('.collection');
        const tiles = [...document.querySelectorAll('.tile')];
        return {
          contained: header.bottom <= board.top && board.bottom <= footer.top && footer.bottom <= app.bottom + 1 && board.left >= app.left && board.right <= app.right && document.documentElement.scrollWidth <= innerWidth,
          hits: tiles.every(button => {
            const box = button.getBoundingClientRect();
            const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
            return hit && (hit === button || button.contains(hit));
          }),
          tileWidth: tiles[0].getBoundingClientRect().width
        };
      });
      assert.equal(layout.contained, true, JSON.stringify({ viewport, layout }));
      assert.equal(layout.hits, true, JSON.stringify({ viewport, layout }));
      if (viewport.height > viewport.width) assert.ok(layout.tileWidth >= 30, JSON.stringify({ viewport, layout }));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#pause-button').click();
    assert.equal(await page.locator('#modal-description').innerText(), '游戏已暂停\n当前已收集 0 / 32 对');
    assert.equal(await page.locator('#modal-objectives').isVisible(), true);
    const remaining = (await state()).remaining;
    await page.clock.fastForward(90000);
    assert.equal((await state()).remaining, remaining);
    await action('重新开始');
    assert.equal((await state()).modalOpen, true);
    assert.equal(await page.locator('#modal-conditions').innerText(), rule);
    await action('我知道了');
    const restarted = await state();
    assert.equal(restarted.duration, 120000);
    assert.ok(restarted.remaining > 119000 && restarted.remaining <= 120000, 'An immediate-start level may already have rendered its first timer frame.');
    assert.deepEqual(await values(), authored);
    for (let i = 0; i < 11; i++) {
      await page.locator('.tile').nth(0).click();
      await page.locator('.tile').nth(1).click();
      await page.clock.runFor(550);
    }
    assert.equal((await state()).mismatches, 11);
    assert.equal((await state()).state, 'playing', 'Level nine must not leak its limit into level ten.');
    const beforeMatch = await state();
    const pair = authored.flatMap((value, i) => value === authored[0] ? [i] : []).slice(0, 2);
    for (const index of pair) await page.locator('.tile').nth(index).click();
    const afterMatch = await state();
    assert.equal(afterMatch.bonusTime, 0);
    assert.ok(Math.abs(beforeMatch.remaining - afterMatch.remaining - (afterMatch.activeTime - beforeMatch.activeTime)) < 1);
    assert.equal(await page.locator('#time-reward').isHidden(), true);
    assert.equal(await page.locator('#play-conditions').innerText(), rule);
    await collectAll();
    assert.equal((await state()).state, 'won');
    assert.equal((await state()).pairs, 32);
    assert.equal((await state()).bonusTime, 0);
    assert.equal((await state()).conditions[0].completed, true);
    assert.equal(await page.locator('#bucket-contents .bucket-find').count(), 32);
    assert.equal(await page.locator('#modal-art .bucket-find').count(), 32);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('beach-pairs-completed-levels'))), [9, 10]);
    await action('下一关');
    assert.equal((await state()).levelId, 11);
    assert.equal(await page.locator('#modal-art .fog-art').count(), 1);
    await action('我知道了');
    await page.locator('#pause-button').click();
    await action('返回选关');
    await page.locator('#chapter-previous').click();
    await page.locator('#chapter-pages:not(.is-sliding)').waitFor({ state: 'attached' });
    assert.equal(await page.locator('#level-10').isEnabled(), true);
    assert.equal(await page.locator('#level-11').isDisabled(), true);
    await page.locator('#level-10').click();
    await action('我知道了');
    await page.clock.fastForward(121000);
    await page.clock.runFor(700);
    assert.equal((await state()).failureReason, 'timeout');
    assert.equal(await page.locator('#modal-heading').innerText(), '潮水先到了一步');
    // The existing test-mode switch should also permit direct entry into level ten.
    await action('返回主菜单');
    await page.locator('#settings-button').click();
    await page.locator('#unlock-switch').click();
    await page.locator('#settings-screen [data-menu]').click();
    await page.locator('#select-level-button').click();
    assert.equal(await page.locator('.chapter-level:enabled').count(), 30);
    await page.locator('#level-10').click();
    assert.equal((await state()).levelId, 10);
    assert.equal((await state()).totalPairs, 32);
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
    console.log('PASS: level 9 → 10, fixed 8x8/five-kind/120s board, 64 hit targets in five viewports, pause/retry, no time rewards, three rule placements, 32-pair victory/full bucket/saved progress, timeout and direct unlock entry. No images captured.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
