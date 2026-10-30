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
    const layout = () => page.locator('.tile').evaluateAll(tiles => tiles.map(tile => ({ index: Number(tile.dataset.index), kind: tile.querySelector('.seaside-item')?.dataset.kind ?? null })));
    async function collectAll() {
      const groups = new Map();
      for (const tile of await page.locator('.tile[data-status="hidden"]').evaluateAll(tiles => tiles.map(tile => ({ index: Number(tile.dataset.index), kind: tile.querySelector('.seaside-item').dataset.kind })))) {
        if (!groups.has(tile.kind)) groups.set(tile.kind, []);
        groups.get(tile.kind).push(tile.index);
      }
      for (const indices of groups.values()) for (const index of indices) await page.locator('.tile').nth(index).click();
      await page.clock.runFor(700);
    }
    await page.locator('#select-level-button').click();
    assert.equal(await page.locator('#level-2').isDisabled(), true);
    await page.locator('#level-screen [data-menu]').click();
    await page.locator('#start-button').click();
    await page.getByRole('button', { name: '跳过教程', exact: true }).click();
    await collectAll();
    await page.getByRole('button', { name: '下一关', exact: true }).click();
    assert.equal((await state()).levelId, 2);
    assert.equal((await state()).tutorialStep, null);
    assert.equal((await state()).duration, 60000);
    assert.equal((await state()).totalPairs, 12);
    assert.equal(await page.locator('#play-chapter').innerText(), '初入浅滩');
    assert.equal(await page.locator('#play-number').innerText(), '02');
    assert.equal(await page.locator('#board').getAttribute('aria-label'), '4行6列赶海配对棋盘');
    assert.equal(await page.locator('#board').evaluate(board => getComputedStyle(board).gridTemplateColumns.split(' ').length), 6);
    assert.equal(await page.locator('.tile').count(), 24);
    assert.equal(await page.locator('button.tile').count(), 24);
    const initial = await layout();
    const kinds = initial.filter(tile => tile.kind !== null).map(tile => tile.kind);
    assert.equal(new Set(kinds).size, 3);
    assert.deepEqual([...new Set(kinds)].map(kind => kinds.filter(item => item === kind).length), [8, 8, 8]);
    assert.equal((await state()).pairs, 0);
    await page.clock.runFor(1000);
    assert.ok((await state()).elapsed >= 1000);
    await page.screenshot({ path: path.resolve(__dirname, '../preview/34-level-two.png'), animations: 'disabled' });
    await page.locator('.tile').nth(0).click();
    await page.locator('.tile').nth(1).click();
    assert.equal(await page.locator('.tile[data-status="open"]').count(), 2);
    await page.clock.runFor(600);
    assert.equal(await page.locator('.tile[data-status="hidden"]').count(), 24);
    await page.locator('.tile').nth(0).click();
    await page.locator('.tile').nth(4).click();
    await page.clock.runFor(700);
    assert.equal((await state()).pairs, 1);
    assert.ok((await state()).bonusTime <= 5000);
    await page.locator('#pause-button').click();
    assert.equal(await page.locator('#modal-description').innerText(), '游戏已暂停\n当前已收集 1 / 12 对');
    const remaining = (await state()).remaining;
    await page.clock.fastForward(10000);
    assert.equal((await state()).remaining, remaining);
    await page.getByRole('button', { name: '重新开始', exact: true }).click();
    assert.equal((await state()).levelId, 2);
    assert.equal((await state()).pairs, 0);
    assert.equal((await state()).tutorialStep, null);
    assert.deepEqual(await layout(), initial);
    for (const viewport of [{ width: 320, height: 568 }, { width: 430, height: 932 }, { width: 1280, height: 720 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await page.clock.runFor(400);
      const contained = await page.evaluate(() => {
        const app = document.getElementById('app').getBoundingClientRect();
        const board = document.getElementById('board').getBoundingClientRect();
        const footer = document.querySelector('.collection').getBoundingClientRect();
        const header = document.querySelector('.play-header').getBoundingClientRect();
        return board.top >= header.bottom && board.bottom <= footer.top && footer.bottom <= app.bottom + 1 && board.left >= app.left && board.right <= app.right && document.documentElement.scrollWidth <= innerWidth;
      });
      assert.equal(contained, true, JSON.stringify(viewport));
      await page.screenshot({ path: path.resolve(__dirname, `../preview/35-level-two-${viewport.width}x${viewport.height}.png`), animations: 'disabled' });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await collectAll();
    assert.equal((await state()).state, 'won');
    assert.equal((await state()).pairs, 12);
    assert.ok((await state()).statuses.every(status => status === 'matched'));
    assert.equal(await page.locator('#bucket-contents .bucket-find').count(), 12);
    assert.equal(await page.locator('#modal-art .bucket-find').count(), 12);
    await page.getByRole('button', { name: '下一关', exact: true }).click();
    assert.equal(await page.locator('#modal-heading').innerText(), '新品种增加 —— 海螺');
    assert.equal((await state()).levelId, 3);
    await page.getByRole('button', { name: '我知道了', exact: true }).click();
    await page.locator('#pause-button').click();
    await page.getByRole('button', { name: '返回选关', exact: true }).click();
    assert.equal(await page.locator('#level-2').isEnabled(), true);
    assert.equal(await page.locator('#chapter-1 .chapter-progress').innerText(), '已通关 2 / 10');
    await page.reload();
    await page.locator('#select-level-button').click();
    assert.equal(await page.locator('#level-2').isEnabled(), true);
    await page.locator('#level-2').click();
    assert.deepEqual(await layout(), initial);
    await page.clock.fastForward(61000);
    await page.clock.runFor(700);
    assert.equal((await state()).state, 'lost');
    assert.ok((await page.locator('#modal-description').innerText()).includes('0 / 12'));
    await page.getByRole('button', { name: '返回主菜单', exact: true }).click();
    await page.locator('#start-button').click();
    assert.equal((await state()).levelId, 1);
    assert.equal(await page.getByRole('button', { name: '开始教学', exact: true }).isVisible(), true);
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
    console.log('PASS: first-to-second progression, fixed 4×6 layout, 24 items/three kinds/12 pairs, normal timer/mismatch/rewards, retry/pause, five layouts, progression to third-level intro, persisted replay, timeout, main start, no external requests or JS errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
