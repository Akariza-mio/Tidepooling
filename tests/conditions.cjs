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
    // Existing legitimate progress permits replay of level three in normal mode.
    await page.evaluate(() => {
      localStorage.setItem('beach-pairs-completed-levels', '[1,2,3]');
      localStorage.setItem('beach-pairs-level-one', 'won');
    });
    await page.reload();
    const state = () => page.evaluate(() => beachDiagnostics.snapshot());
    const capture = name => process.env.BEACH_CAPTURE_PREVIEWS === '1' ? page.screenshot({ path: path.resolve(__dirname, '../preview/' + name), animations: 'disabled' }) : Promise.resolve();
    async function collectKinds(kinds) {
      for (const kind of kinds) {
        const indices = await page.locator('.tile[data-status="hidden"]').evaluateAll((tiles, kind) => tiles.filter(tile => tile.querySelector('.seaside-item').dataset.kind === kind).map(tile => Number(tile.dataset.index)), String(kind));
        for (const index of indices) await page.locator('.tile').nth(index).click();
      }
    }
    async function checkModal() {
      await page.clock.runFor(400);
      const bounds = await page.locator('#modal-card').evaluate(card => {
        const rect = card.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, height: innerHeight, contained: rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth };
      });
      assert.equal(bounds.contained, true, JSON.stringify(bounds));
    }
    await page.locator('#select-level-button').click();
    await page.locator('#level-3').click();
    await page.getByRole('button', { name: '我知道了', exact: true }).click();
    await collectKinds([0, 1, 2, 4]);
    await page.clock.runFor(700);
    await page.getByRole('button', { name: '下一关', exact: true }).click();
    assert.equal((await state()).levelId, 4);
    assert.equal(await page.locator('#modal-heading').innerText(), '本关胜利条件');
    assert.equal(await page.locator('#modal-conditions .condition-item').count(), 1);
    assert.equal(await page.locator('#modal-conditions .condition-item').getAttribute('data-completed'), 'false');
    assert.ok((await page.locator('#modal-conditions').innerText()).includes('最后一对配对必须是海螺'));
    await page.clock.fastForward(90000);
    assert.equal((await state()).elapsed, 0);
    assert.equal((await state()).displayedTide, 0);
    await capture('40-condition-entry.png');
    await page.getByRole('button', { name: '我知道了', exact: true }).click();
    assert.equal(await page.locator('#level-objectives').isVisible(), true);
    assert.equal(await page.locator('#play-conditions .condition-item').getAttribute('data-completed'), 'false');
    await capture('41-condition-board.png');
    for (const viewport of [{ width: 320, height: 568 }, { width: 430, height: 932 }, { width: 1280, height: 720 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await page.clock.runFor(400);
      const layout = await page.evaluate(() => {
        const app = document.getElementById('app').getBoundingClientRect();
        const heading = document.querySelector('.play-header').getBoundingClientRect();
        const objectives = document.getElementById('level-objectives').getBoundingClientRect();
        const board = document.getElementById('board').getBoundingClientRect();
        const footer = document.querySelector('.collection').getBoundingClientRect();
        return { ordered: heading.bottom <= objectives.top && objectives.bottom <= board.top && board.bottom <= footer.top,
          contained: footer.bottom <= app.bottom + 1 && board.left >= app.left && board.right <= app.right && document.documentElement.scrollWidth <= innerWidth };
      });
      assert.equal(layout.ordered, true, JSON.stringify({ viewport, layout }));
      assert.equal(layout.contained, true, JSON.stringify({ viewport, layout }));
      await page.locator('#pause-button').click();
      assert.equal(await page.locator('#modal-conditions .condition-item').getAttribute('data-completed'), 'false');
      await checkModal();
      await page.getByRole('button', { name: '继续赶海', exact: true }).click();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.tile').nth(0).click();
    await page.locator('.tile').nth(4).click();
    await page.clock.runFor(700);
    assert.equal((await state()).pairs, 1);
    assert.equal((await state()).conditions[0].completed, false);
    await page.locator('#pause-button').click();
    assert.equal(await page.locator('#modal-description').innerText(), '游戏已暂停\n当前已收集 1 / 12 对');
    assert.equal(await page.locator('#modal-conditions .condition-item').getAttribute('data-completed'), 'false');
    await capture('42-condition-pause.png');
    await page.getByRole('button', { name: '继续赶海', exact: true }).click();
    await collectKinds([4]);
    assert.equal((await state()).state, 'playing');
    assert.equal((await state()).conditions[0].completed, false);
    await collectKinds([0, 1, 2]);
    assert.equal((await state()).state, 'lost');
    assert.equal((await state()).failureReason, 'conditions');
    await page.clock.runFor(700);
    assert.equal(await page.locator('#modal-heading').innerText(), '未完成全部的条件');
    assert.equal(await page.locator('#modal-art .condition-failure-art').count(), 1);
    assert.equal(await page.locator('#modal-art .washed-bucket-art').count(), 0);
    assert.ok((await state()).remaining > 0);
    assert.ok((await state()).displayedTide < 1);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('beach-pairs-completed-levels'))), [1, 2, 3]);
    await capture('43-condition-failure.png');
    await page.getByRole('button', { name: '重新挑战', exact: true }).click();
    assert.equal((await state()).failureReason, null);
    assert.equal((await state()).conditions[0].completed, false);
    assert.equal(await page.locator('#modal-conditions .condition-item').getAttribute('data-completed'), 'false');
    await page.getByRole('button', { name: '我知道了', exact: true }).click();
    await collectKinds([0, 1, 2, 4]);
    assert.equal((await state()).state, 'won');
    assert.equal(await page.locator('#play-conditions .condition-item').getAttribute('data-completed'), 'true');
    await page.clock.runFor(700);
    assert.equal(await page.locator('#modal-heading').innerText(), '海的礼物，收好啦。');
    assert.equal(await page.locator('#bucket-contents .bucket-find').count(), 12);
    assert.equal(await page.locator('#modal-art .bucket-find').count(), 12);
    assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('beach-pairs-completed-levels')).includes(4)));
    await capture('44-condition-victory.png');
    await page.getByRole('button', { name: '返回选关', exact: true }).click();
    assert.equal(await page.locator('#level-4').isEnabled(), true);
    await page.locator('#level-4').click();
    await page.getByRole('button', { name: '我知道了', exact: true }).click();
    await page.clock.fastForward(61000);
    await page.clock.runFor(700);
    assert.equal((await state()).failureReason, 'timeout');
    assert.equal(await page.locator('#modal-heading').innerText(), '潮水先到了一步。');
    assert.equal(await page.locator('#modal-art .washed-bucket-art').count(), 1);
    await page.getByRole('button', { name: '返回选关', exact: true }).click();
    await page.locator('#level-2').click();
    assert.equal(await page.locator('#level-objectives').isVisible(), false);
    await page.locator('#pause-button').click();
    assert.equal(await page.locator('#modal-objectives').isVisible(), false);
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
    console.log('PASS: real level-three-to-four progression; frozen entry and three condition displays; unchecked after early conches and while paused; five layouts; red-cross condition loss with time remaining and no saved completion; reset; conch-last victory with saved completion; distinct timeout; no condition leakage or browser errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
