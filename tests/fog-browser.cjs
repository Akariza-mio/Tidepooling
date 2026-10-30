// Real browser checks only: no screenshots, previews or packages.
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
    await page.addInitScript(() => localStorage.setItem('beach-pairs-completed-levels', '[10]'));
    await page.goto(pathToFileURL(path.join(process.env.BEACH_GAME_DIR || path.resolve(__dirname, '..'), 'index.html')).href);
    const state = () => page.evaluate(() => beachDiagnostics.snapshot());
    const action = name => page.getByRole('button', { name, exact: true }).click();
    const tile = index => page.locator('.tile').nth(index);
    const values = () => page.locator('.tile .seaside-item').evaluateAll(icons => icons.map(icon => Number(icon.dataset.kind)));
    async function flip(index) {
      if ((await state()).fog[index]?.covered) await tile(index).click();
      await tile(index).click();
    }
    async function collectExcept(excluded = []) {
      const deck = await values();
      for (const kind of [0, 1, 2, 4, 5]) for (let index = 0; index < deck.length; index++) {
        if (deck[index] === kind && !excluded.includes(index)) await flip(index);
      }
    }
    await page.locator('#select-level-button').click();
    await page.locator('#level-10').click();
    await collectExcept();
    await page.clock.runFor(700);
    await action('下一关');
    assert.equal((await state()).levelId, 11);
    assert.equal((await state()).rows, 6);
    assert.equal((await state()).columns, 6);
    assert.equal(await page.locator('#play-chapter').innerText(), '月下独捉');
    assert.equal(await page.locator('#play-number').innerText(), '01');
    assert.equal(await page.locator('#play-night-scene').isVisible(), true);
    assert.equal(await page.locator('#modal-heading').innerText(), '你一直忘我地赶海，不知不觉到了晚上！');
    assert.equal(await page.locator('#modal-description').innerText(), '海边在夜间会起雾，雾可以点击拨开，但是它会在一定时间后恢复\n最好记住雾下面的格子是否已经被配对！');
    assert.equal(await page.locator('#modal-art .fog-art').count(), 1);
    assert.equal(await page.locator('.tile[data-fog="covered"]').count(), 12);
    assert.equal(await page.locator('.board-fog').count(), 1);
    assert.equal(await page.locator('.fog-mask-cell').count(), 12);
    assert.equal(await page.locator('.board-fog ellipse, #modal-art ellipse').count(), 0);
    const feathering = await page.locator('.fog-field-art').evaluate(svg => {
      const filter = svg.querySelector('.fog-edge-filter');
      const mask = svg.querySelector('.fog-field-mask');
      return getComputedStyle(svg).overflow === 'visible'
        && Number(filter.getAttribute('x')) < 0 && Number(filter.getAttribute('width')) > 600
        && Number(mask.getAttribute('x')) < 0 && Number(mask.getAttribute('width')) > 600
        && Number(filter.querySelector('feDisplacementMap').getAttribute('scale')) > 0
        && Number(filter.querySelector('feGaussianBlur').getAttribute('stdDeviation')) > 0
        && svg.querySelector('.fog-mask-shape').getAttribute('filter') === `url(#${filter.id})`
        && [...svg.querySelectorAll('.fog-mask-cell')].every(cell => Number(cell.getAttribute('rx')) > 0);
    });
    assert.equal(feathering, true, 'The joined mask has irregular feathered edges and room for a soft halo.');
    await page.clock.fastForward(90000);
    assert.equal((await state()).elapsed, 0);
    assert.equal((await state()).pairs, 0);
    const authored = await values();
    await action('我知道了');
    await tile(0).click();
    assert.equal((await state()).statuses[0], 'hidden');
    assert.equal((await state()).turns, 0);
    assert.equal(await tile(0).getAttribute('data-fog'), 'clear');
    assert.equal(await page.locator('.fog-mask-cell[data-index="0"]').evaluate(window => getComputedStyle(window).transitionDuration), '0.16s');
    assert.equal(await page.locator('.fog-mask-cell[data-index="0"]').evaluate(window => window.style.opacity), '0');
    assert.equal(await page.locator('.fog-mask-cell[data-index="1"]').evaluate(window => window.style.opacity), '1');
    await tile(0).click();
    await tile(7).click();
    assert.equal((await state()).statuses[7], 'hidden', 'The first click clears fog without flipping sand.');
    await tile(7).click();
    await page.clock.runFor(700);
    assert.equal((await state()).pairs, 1);
    assert.ok((await state()).bonusTime <= 5000);
    await page.clock.runFor(5100);
    assert.equal(await tile(0).getAttribute('data-fog'), 'covered');
    assert.equal(await tile(0).isEnabled(), true, 'A refogged collected position remains inspectable.');
    assert.equal(await tile(0).getAttribute('aria-label').then(text => text.includes('已收集')), false);
    await tile(0).click();
    assert.equal((await state()).statuses[0], 'matched');
    assert.equal((await state()).pairs, 1);
    assert.equal(await tile(0).isDisabled(), true);
    await tile(1).click();
    const windowBeforePause = (await state()).fog[1].until - (await state()).activeTime;
    await page.locator('#pause-button').click();
    const paused = await state();
    await page.clock.fastForward(90000);
    assert.equal((await state()).activeTime, paused.activeTime);
    assert.equal((await state()).remaining, paused.remaining);
    assert.equal((await state()).fog[1].covered, false);
    await action('继续赶海');
    await page.clock.runFor(windowBeforePause + 100);
    assert.equal((await state()).fog[1].covered, true);
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 1280, height: 720 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await page.clock.runFor(300);
      const fits = await page.evaluate(() => {
        const board = document.getElementById('board').getBoundingClientRect();
        const footer = document.querySelector('.collection').getBoundingClientRect();
        const app = document.getElementById('app').getBoundingClientRect();
        const masks = [...document.querySelectorAll('.fog-mask-cell')].map(window => Object.fromEntries(['x', 'y', 'width', 'height'].map(name => [name, Number(window.getAttribute(name))])));
        const field = document.querySelector('.board-fog').getBoundingClientRect();
        const thirdRow = document.querySelector('.tile[data-index="12"]').getBoundingClientRect();
        const joined = masks.every((mask, index) => {
          const horizontal = index % 6 === 5 || mask.x + mask.width >= masks[index + 1].x;
          const vertical = index >= 6 || mask.y + mask.height >= masks[index + 6].y;
          return horizontal && vertical && mask.width > 0 && mask.height > 0;
        });
        const fogBottom = field.top + Math.max(...masks.map(mask => mask.y + mask.height)) * field.height / 600;
        return board.bottom <= footer.top && footer.bottom <= app.bottom + 1 && joined && fogBottom < thirdRow.top;
      });
      assert.equal(fits, true, JSON.stringify(viewport));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#pause-button').click();
    await action('重新开始');
    assert.equal(await page.locator('#modal-art .fog-art').count(), 1);
    assert.equal((await state()).pairs, 0);
    assert.equal(await page.locator('.tile[data-fog="covered"]').count(), 12);
    assert.deepEqual(await values(), authored);
    await action('我知道了');
    await collectExcept([32, 35]);
    await page.clock.runFor(5100);
    assert.equal((await state()).pairs, 17);
    assert.equal(await page.locator('.tile[data-status="matched"][data-fog="covered"]').count(), 12);
    await flip(32); await flip(35);
    await page.clock.runFor(700);
    assert.equal((await state()).state, 'won');
    assert.equal((await state()).pairs, 18);
    assert.equal(await page.locator('#modal-art .bucket-find').count(), 18);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('beach-pairs-completed-levels'))), [10, 11]);
    await action('下一关');
    assert.equal((await state()).levelId, 12);
    assert.equal(await page.locator('#modal-heading').innerText(), '本关胜利条件');
    await action('我知道了');
    await page.locator('#pause-button').click();
    await action('返回选关');
    assert.equal(await page.locator('.chapter-page:visible h1').innerText(), '月下独捉');
    assert.equal(await page.locator('#level-11').isEnabled(), true);
    assert.equal(await page.locator('#level-12').isDisabled(), true);
    await page.locator('#level-11').click();
    await action('我知道了');
    await page.clock.fastForward(61000);
    await page.clock.runFor(700);
    assert.equal((await state()).failureReason, 'timeout');
    await action('返回选关');
    await page.locator('#chapter-previous').click();
    await page.locator('#chapter-pages:not(.is-sliding)').waitFor({ state: 'attached' });
    await page.locator('#level-10').click();
    assert.equal(await page.locator('#play-night-scene').isVisible(), false);
    assert.equal(await page.locator('.board-fog').count(), 0);
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
    console.log('PASS: level 10 → night chapter 01, continuous line fog with irregular feathered edges, joined cell masks in five viewports, independent opening windows/5s restoration, paused windows, retry/reset, victory with covered fog, stored progress/timeout, and no fog/night leakage. No images captured.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
